import 'dotenv/config';
import { registerAgent, sendIntent } from './a2aClient';
import express, { Request, Response, Application } from 'express';
import { generateWithGemini } from './llmAdapter';
import { createBranch, commitFiles, openDraftPR } from './githubClient';
import { launchPreview, ProjectFile } from './previewService';
import { startOtel } from './otel';
import { recordError, recordIntentLatency } from './otelMetrics';
import { runPhase0ProductDiscovery } from './phases/phase0_discovery';
import { runPhase1Plan } from './phases/phase1_plan';
import { runPhase2Codegen } from './phases/phase2_codegen';
import { runPhase4TestGen } from './phases/phase4_testgen';
import { runPhaseReview } from './phases/phase_review';
import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import { trace, Span } from '@opentelemetry/api';
import { mcp_supabase_generate_typescript_types } from './mcp_client';
import fetch from 'node-fetch';
import type { Request as ExRequest, Response as ExResponse } from 'express';
import { waitUntil } from '@vercel/functions';
import { E2BSandboxService } from './e2bSandboxService';

const logger = pino({
  name: 'app-builder',
  level: process.env.LOG_LEVEL || 'info',
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4001;
const TARGET_REPO = process.env.TARGET_REPO; // e.g. 'org/repo'
const BASE_BRANCH = 'main';

console.log('App-Builder agent starting...');
console.log('A2A_ROUTER_URL:', process.env.A2A_ROUTER_URL);

// Initialise OTEL and the Express app exactly once, then reuse for all requests.
const initPromise = (async () => {
  try {
    await startOtel();
  } catch (err) {
    console.error('OTEL init failed', err);
    // Continue startup even if metrics fail to avoid taking down the function.
  }
  await main();
})();

// For Vercel: hold a reference to the express app so we can export a handler
let serverlessApp: Application | undefined;

async function main() {
  // Register the agent with the A2A router
  try {
    console.log('Registering agent with A2A router at', process.env.A2A_ROUTER_URL);
    const endpointUrl = process.env.APP_BUILDER_PUBLIC_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`);

    const regResult = await registerAgent({
      agent_name: 'App-Builder',
      version: 'v1.0.0',
      capabilities: ['app.compose', 'app.preview'],
      endpoint_url: endpointUrl,
      supports_mcp: true,
    });
    console.log('Registration result:', regResult);
    logger.info({ event: 'a2a.register', regResult }, 'Registered with A2A router');
  } catch (err) {
    console.error('Registration failed:', err);
    logger.error({ event: 'a2a.register.error', err }, 'Failed to register with A2A router');
    process.exit(1);
  }

  // Start HTTP server to receive intents
  const app = express();
  // Respect JSON_LIMIT env var (default 25mb)
  const jsonLimit = process.env.JSON_LIMIT || '25mb';
  app.use(express.json({ limit: jsonLimit }));

  // Health check endpoint
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // ---- Helper: synchronous discovery phase ----
  async function runDiscoveryPhase(body: any, conversationId?: string) {
    const { userInput } = body;
    let incomingSpec = body.appSpec;

    // Highest priority: If the caller is explicitly confirming the spec, accept it and exit.
    if (body.confirm == true && incomingSpec) {
      return { awaiting: false, confirmedSpec: { ...incomingSpec, isConfirmed: true } } as const;
    }

    // If the spec has already been confirmed in a previous turn, bypass the LLM entirely.
    if (incomingSpec?.isConfirmed) {
      return { awaiting: false, confirmedSpec: incomingSpec } as const;
    }

    const discoveryResult: DiscoveryResponse = await runPhase0ProductDiscovery(
      userInput,
      incomingSpec,
      conversationId ?? '',
      body.history || []
    );

    // If the user's text is a confirmation (e.g. "yes"), accept the spec from the LLM.
    const positiveConfirmation = userInput?.toLowerCase().trim().match(/^(yes|proceed)/);
    if (positiveConfirmation && incomingSpec) {
      return { awaiting: false, confirmedSpec: { ...discoveryResult.updatedAppSpec, isConfirmed: true } } as const;
    }

    // Otherwise return the draft from the LLM and ask for confirmation.
    const specForConfirmation = { ...discoveryResult.updatedAppSpec, isConfirmed: false };
    return {
      awaiting: true,
      responseToUser: discoveryResult.responseToUser,
      updatedAppSpec: specForConfirmation,
      needsConfirmation: discoveryResult.isComplete, // Let UI know to show a "Confirm" button.
    } as const;
  }

  app.post('/intent', async (req: Request, res: Response) => {
    const { intent, trace_id, jwt, skip_github = false } = req.body;
    const conversationId = req.body.conversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    // Run the synchronous discovery/confirmation phase.
    const discovery = await runDiscoveryPhase(req.body, conversationId);

    // If discovery needs more user input, return 200 and wait for the next user message.
    if (discovery.awaiting) {
      await sendProgress(conversationId, 'discovery', 50, discovery.responseToUser || '', 'in_progress');
      res.status(200).json({
        status: 'AWAITING_USER_INPUT',
        responseToUser: discovery.responseToUser,
        conversationId,
        updatedAppSpec: discovery.updatedAppSpec,
        needsConfirmation: discovery.needsConfirmation,
      });
      return;
    }

    // Discovery is complete. Immediately respond 202 to the caller.
    res.status(202).json({ ok: true, status: 'queued', conversationId });

    // Use Vercel's waitUntil for proper background task handling
    waitUntil((async () => {
      try {
        logger.info({ event: 'background.task.start.waitUntil' }, 'Starting background processing with waitUntil');
        await handleAppComposeIntent(
          { ...req.body, appSpec: discovery.confirmedSpec, conversationId }, 
          trace_id, 
          jwt
        );
        logger.info({ event: 'background.task.success.waitUntil' }, 'Background processing completed successfully');
      } catch (err: any) {
        logger.error({ event: 'background.task.error.waitUntil', err }, 'Error in background processing');
        await sendProgress(conversationId, 'error', 100, err?.message || 'An unknown error occurred.', 'error');
      }
    })());
  });

  // Assign for serverless export
  serverlessApp = app;

  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      logger.info({ event: 'startup', port: PORT }, `App-Builder agent listening on port ${PORT}`);
    });
  }
}

// Add ensureDirSync helper
function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeAppFromScaffold(
  generatedFiles: { filePath: string; content: string }[],
  dependencies: string[] = []
) {
  const outDir = path.resolve(__dirname, '../generated-app');
  const scaffoldDir = path.resolve(__dirname, 'scaffold-templates');
  logger.info({ event: 'scaffold.write.start', outDir, scaffoldDir }, 'Writing generated app from scaffold...');

  // 1. Clean output directory
  await fs.emptyDir(outDir);

  // 1b. Manually copy scaffold files to outDir to ensure a true copy
  const scaffoldFiles = await fs.readdir(scaffoldDir);
  for (const fileName of scaffoldFiles) {
    const srcPath = path.join(scaffoldDir, fileName);
    const destPath = path.join(outDir, fileName);
    const content = await fs.readFile(srcPath, 'utf8');
    await fs.writeFile(destPath, content, 'utf8');
  }
  logger.info({ event: 'scaffold.copied' }, 'Copied scaffold templates to output directory.');

  // Helper to remove ``` fences possibly added by the LLM
  const stripCodeFence = (src: string): string => {
    const match = src.match(/^```[a-z0-9]*\n([\s\S]*?)\n```$/i);
    return match ? match[1] : src;
  };

  // 2. Write AI-generated files
  for (const file of generatedFiles) {
    const cleanPath = file.filePath.replace(/^"|"$/g, '');
    
    // Defensive check: Do not allow the LLM to overwrite the template package.json
    if (path.basename(cleanPath) === 'package.json') {
      logger.warn({ event: 'disk.write.skip', filePath: cleanPath }, `Skipping LLM-generated package.json to preserve template.`);
      continue;
    }

    const fullPath = path.join(outDir, cleanPath);
    ensureDirSync(path.dirname(fullPath));
    const cleanContent = stripCodeFence(file.content);
    fs.writeFileSync(fullPath, cleanContent, 'utf8');
    logger.info({ event: 'disk.write.file', filePath: fullPath }, `Wrote AI-generated file`);
  }

  // 3. Update package.json with new dependencies
  if (dependencies.length > 0) {
    const pkgJsonPath = path.join(outDir, 'package.json');
    try {
      const pkgJson = await fs.readJson(pkgJsonPath);
      dependencies.forEach(dep => {
        // Naive parser for dep@version, assumes format is correct
        const parts = dep.split('@');
        const name = parts[0];
        const version = parts.length > 1 ? `^${parts.slice(1).join('@')}` : 'latest';
        pkgJson.dependencies[name] = version;
      });
      await fs.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
      logger.info({ event: 'scaffold.pkg.updated', dependencies }, 'Updated package.json with new dependencies.');
    } catch (err) {
      logger.error({ event: 'scaffold.pkg.error', err }, 'Failed to update package.json with dependencies.');
    }
  }

  logger.info({ event: 'scaffold.write.complete' }, 'Finished writing generated app from scaffold.');
}

// Helper to push progress updates to the A2A-router for Supabase Realtime broadcasting
async function sendProgress(
  conversationId: string | undefined,
  phase: string,
  percent: number,
  message: string | Record<string, any>,
  status: 'in_progress' | 'completed' | 'error' = 'in_progress'
) {
  if (!conversationId) return;
  
  logger.info({ event: 'progress.send.attempt', conversationId, phase, url: `${process.env.A2A_ROUTER_URL}/a2a/progress` }, 'Attempting to send progress update');
  
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.A2A_API_KEY) headers['x-api-key'] = process.env.A2A_API_KEY;
    
    // Use Promise.race for reliable timeout in serverless environment
    const fetchPromise = fetch(`${process.env.A2A_ROUTER_URL}/a2a/progress`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversationId, phase, percent, message, status }),
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );
    
    await Promise.race([fetchPromise, timeoutPromise]);
    logger.info({ event: 'progress.send.success', conversationId, phase }, 'Progress update sent successfully');
  } catch (err: any) {
    if (err.message === 'TIMEOUT') {
      logger.warn({ event: 'progress.send.timeout', conversationId, phase }, 'Progress update timed out after 5 seconds');
    } else {
      logger.warn({ event: 'progress.send.error', err, conversationId, phase }, 'Failed to send progress update');
    }
    // Don't throw - just log and continue. Progress updates are non-critical.
  }
}

// Handler for app.compose intents
export async function handleAppComposeIntent(
  requestBody: any,
  trace_id?: string,
  jwt?: string,
  parentSpan?: Span
) {
  logger.info({ event: 'handleAppComposeIntent.entry', requestBody }, 'Entering app compose handler');
  const tracer = trace.getTracer('app-builder');
  const { userInput, conversationId, skip_github } = requestBody;
  let incomingSpec = requestBody.appSpec;

  // If caller explicitly confirms, mark spec as confirmed immediately.
  if (requestBody.confirm === true && incomingSpec && !incomingSpec.isConfirmed) {
    incomingSpec.isConfirmed = true;
    logger.info({ event: 'intent.confirm_shortcut' }, 'Spec marked confirmed via confirm flag');
  }

  // The spec MUST be confirmed to proceed. This is now an assertion.
  if (!incomingSpec?.isConfirmed) {
    logger.error({ event: 'handleAppComposeIntent.unexpected_unconfirmed_spec' }, 'handleAppComposeIntent called with an unconfirmed spec. This should not happen.');
    throw new Error('handleAppComposeIntent requires a confirmed spec to proceed.');
  }

  // The user has confirmed with 'yes', and the spec is confirmed.
  const appSpec: AppSpec = incomingSpec;
  logger.info({ event: 'phase.discovery.confirmed', appSpec }, 'Product discovery complete and confirmed by user.');

  // Send initial progress update
  logger.info({ event: 'progress.send.before', conversationId, phase: 'plan' }, 'Attempting to send initial progress update...');
  await sendProgress(conversationId, 'plan', 0, 'Planning application');
  logger.info({ event: 'progress.send.after', conversationId, phase: 'plan' }, 'Initial progress update sent successfully.');

  // MCP Integration: Fetch dynamic context before generation
  let dbSchemaTypes = '';
  try {
    // In a real scenario, you might have logic to select the correct project.
    // For now, we'll hardcode the one we identified as most likely.
    const projectId = 'ktodzuolttfqrkozlsae'; 
    logger.info({ event: 'mcp.supabase.project_selected', projectId }, 'Selected Supabase project');

    const typesResult = await mcp_supabase_generate_typescript_types({ projectId });
    dbSchemaTypes = typesResult.types;
    logger.info({ event: 'mcp.supabase.types_fetched' }, 'Successfully fetched Supabase DB types');
  } catch(err) {
    logger.warn({ event: 'mcp.supabase.types_error', err }, 'Could not fetch Supabase DB types. Proceeding without them.');
    dbSchemaTypes = 'Error: Could not fetch database schema from Supabase.';
  }

  const startTime = Date.now();
  const labels: Record<string, string> = {
    service: 'app-builder',
    trace_id: trace_id || '',
    workspace_id: appSpec?.workspace_id || '',
    request_id: appSpec?.request_id || '',
  };
  try {
    // Phase 1: Planning & Classification
    const planResult = await runPhase1Plan(appSpec);
    let actionPlan = planResult.actionPlan;
    logger.info({ event: 'phase.plan.complete', actionPlan });

    // Send progress update
    await sendProgress(conversationId, 'plan', 20, 'Plan complete');

    // Phase 2: Codegen
    await sendProgress(conversationId, 'codegen', 25, 'Generating application code');
    const codegenResult = await runPhase2Codegen({
        actionPlan,
        brief: JSON.stringify(appSpec, null, 2),
        dbSchema: dbSchemaTypes,
    });
    const generatedFiles = codegenResult.files;
    const dependencies = codegenResult.dependencies;
    logger.info({ event: 'phase.codegen.complete', files: generatedFiles.map(f => f.filePath) });
    
    // Send progress update
    await sendProgress(conversationId, 'codegen', 60, 'Code generation complete');

    // Phase 3: Code Review – ensure each generated file follows guidelines
    await sendProgress(conversationId, 'review', 65, 'Reviewing generated code');
    const reviewResults = await runPhaseReview(generatedFiles, appSpec);
    logger.info({ event: 'phase.review.complete', results: reviewResults }, 'Completed code review for generated files');

    // Send progress update
    await sendProgress(conversationId, 'review', 75, 'Review complete');

    // Phase 4: Test Generation
    await sendProgress(conversationId, 'testgen', 80, 'Generating tests');
    const testFiles: { filePath: string; content: string }[] = [];
    for (const file of generatedFiles) {
      // A simple heuristic to decide if a file is a component that needs a test
      if (file.filePath.includes('components/') && (file.filePath.endsWith('.tsx') || file.filePath.endsWith('.jsx'))) {
        const testFilePath = file.filePath.replace(/(\.tsx|\.jsx)/, '.test$1');
        const testContent = await runPhase4TestGen({
          filePath: file.filePath,
          componentContent: file.content,
          testFilePath: testFilePath,
        });
        if (testContent) {
          testFiles.push({ filePath: testFilePath, content: testContent });
        }
      }
    }
    logger.info({ event: 'phase.testgen.complete', files: testFiles.map(f => f.filePath) });

    // Send progress update
    await sendProgress(conversationId, 'testgen', 90, 'Tests generated');

    // *** NEW: Write generated files to disk using the scaffold function ***
    const allGeneratedFiles = [...generatedFiles, ...testFiles];
    const runningOnVercel = Boolean(process.env.VERCEL);
    if (!runningOnVercel) {
      await sendProgress(conversationId, 'scaffold', 95, 'Writing scaffold to disk');
      await writeAppFromScaffold(allGeneratedFiles, dependencies);
    } else {
      logger.info({ event: 'scaffold.skip', reason: 'Running on Vercel – filesystem is read-only' }, 'Skipping scaffold write on Vercel runtime');
    }

    // 4. Prepare schema and workflow sub-intents (stub) - This logic is removed as bestPracticeTemplate is gone

    let result: any = {};
    if (TARGET_REPO && process.env.GITHUB_TOKEN && !skip_github) {
      const branchName = `pria-app-builder-${Date.now()}`;
      try {
        await createBranch(TARGET_REPO, BASE_BRANCH, branchName);
        await commitFiles(
          TARGET_REPO,
          branchName,
          allGeneratedFiles.map(f => ({ path: f.filePath, content: f.content }))
        );
        const prUrl = await openDraftPR(TARGET_REPO, branchName, 'PRIA: Generated App', 'This PR was created automatically by the PRIA App-Builder agent.');
        logger.info({ event: 'github.pr.created', prUrl }, 'Opened draft PR on GitHub');
        result = { ...result, github_pr_url: prUrl };
      } catch (err) {
        logger.error({ ...labels, event: 'github.error', err }, 'Error creating GitHub branch or PR');
        // Don't re-throw, just log and continue without a PR
      }
    }

    // Determine final message
    const finalMessage = !skip_github
      ? 'Application composition complete. A draft PR has been opened.'
      : 'Application composition complete.';

    await sendProgress(conversationId, 'completed', 100, {
      message: finalMessage,
      files: allGeneratedFiles.map(f => ({ path: f.filePath, content: f.content })),
      dependencies,
      github_pr_url: result.github_pr_url ?? null,
    }, 'completed');

    // Create E2B sandbox for live preview
    let sandboxUrl: string | null = null;
    try {
      const workspaceId = appSpec?.workspace_id || '';
      if (workspaceId) {
        await sendProgress(conversationId, 'sandbox', 95, 'Creating live preview sandbox...');
        
        const e2bService = new E2BSandboxService();
        const sandboxInfo = await e2bService.createSandbox(
          allGeneratedFiles.map(f => ({
            filePath: f.filePath,
            content: f.content,
            operation: 'created'
          })),
          dependencies,
          {
            templateId: process.env.E2B_TEMPLATE_ID || 'xeavhq5mira8no0bq688', // baseline-project template
            teamId: process.env.E2B_TEAM_ID || 'd9ae965a-2a35-4a01-bc6e-6ff76faaa12c',
            workspaceId,
            conversationId
          }
        );

        sandboxUrl = sandboxInfo.sandboxUrl;
        await sendProgress(conversationId, 'sandbox', 100, `Live preview ready: ${sandboxUrl}`);
        
        logger.info({ 
          event: 'e2b.sandbox.success', 
          sandboxUrl, 
          conversationId,
          workspaceId
        }, 'E2B sandbox created successfully');
      } else {
        logger.warn({ 
          event: 'e2b.sandbox.skip', 
          conversationId,
          reason: 'No workspace_id available'
        }, 'Skipping E2B sandbox creation - no workspace_id');
      }
    } catch (error) {
      logger.error({ 
        event: 'e2b.sandbox.error', 
        error: error instanceof Error ? error.message : String(error),
        conversationId
      }, 'Failed to create E2B sandbox');
      
      await sendProgress(conversationId, 'sandbox', 100, 'Live preview creation failed, but files are ready');
    }

    const endTime = Date.now();
    recordIntentLatency(endTime - startTime, labels);

    return {
      ...result,
      status: 'completed',
      message: finalMessage,
      // New response schema includes full file objects and dependency list
      files: allGeneratedFiles.map(f => ({ path: f.filePath, content: f.content })),
      generated_files: allGeneratedFiles.map(f => f.filePath), // legacy field
      dependencies,
      compliance: null,
      sandbox_url: sandboxUrl,
    };
  } catch (err: any) {
    const endTime = Date.now();
    logger.error({ event: 'app.compose.error', err: err?.message, stack: err?.stack, trace_id, context: { err } }, 'Error in app.compose workflow');
    recordError(labels);
    recordIntentLatency(endTime - startTime, labels);
    await sendProgress(conversationId, 'error', 100, err?.message || 'Error', 'error');
    throw err;
  }
}

// Define the structure of the application specification
export interface AppSpec {
  description: string;
  spec_version?: string;
  domain?: string;
  schema?: Record<string, any>;
  userActions?: any[];
  isConfirmed?: boolean;
  workspace_id?: string;
  request_id?: string;
}

// Define the structure of the LLM's response for discovery
export interface DiscoveryResponse {
  updatedAppSpec: AppSpec;
  responseToUser: string;
  isComplete: boolean;
}

// ---- Vercel default export ----
async function handler(req: ExRequest, res: ExResponse) {
  // Ensure the one-time initialisation has completed before handling the request.
  await initPromise;

  if (!serverlessApp) {
    res.status(500).send('Server not initialised');
    return;
  }
  return serverlessApp(req, res);
}

// For CommonJS build used by @vercel/node, set exports correctly
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined') {
  // Assign both module.exports and .default so Vercel detects the default export
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = handler;
  // Provide a default property for ESModule interop
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  module.exports.default = handler;
}