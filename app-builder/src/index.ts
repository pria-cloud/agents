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

const logger = pino({
  name: 'app-builder',
  level: process.env.LOG_LEVEL || 'info',
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4001;
const TARGET_REPO = process.env.TARGET_REPO; // e.g. 'org/repo'
const BASE_BRANCH = 'main';

console.log('App-Builder agent starting...');
console.log('A2A_ROUTER_URL:', process.env.A2A_ROUTER_URL);

startOtel().then(() => main());

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

  app.post('/intent', async (req: Request, res: Response) => {
    const { intent, trace_id, jwt, skip_github = false } = req.body;
    logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
    // Start a root span for the intent
    const tracer = trace.getTracer('app-builder');
    await tracer.startActiveSpan(intent || 'unknown_intent', async (span: Span) => {
      try {
        // Add trace_id, workspace_id, request_id as span attributes if present
        if (trace_id) span.setAttribute('trace_id', trace_id);
        
        // We will pass the whole body as the payload now
        const payload = req.body;
        if (payload?.workspace_id) span.setAttribute('workspace_id', payload.workspace_id);
        if (payload?.request_id) span.setAttribute('request_id', payload.request_id);

        let result;
        if (intent === 'app.compose') {
          result = await handleAppComposeIntent({ ...payload, skip_github }, trace_id, jwt, span);
          res.status(200).json({ ok: true, trace_id, ...result });
        } else if (intent === 'app.preview') {
          // This is a stub for a potential preview intent
          const { files, dependencies } = payload;
          await writeAppFromScaffold(files, dependencies);
          // Here you might trigger a build and serve the app
          res.status(200).json({ ok: true, trace_id, previewUrl: 'http://localhost:3000' });
        } else {
          res.status(400).json({ ok: false, error: 'Unsupported intent', trace_id });
        }
        span.end();
      } catch (err: any) {
        logger.error({ event: 'intent.error', err, trace_id }, 'Error handling intent');
        span.recordException(err);
        span.setStatus({ code: 2, message: err.message });
        span.end();
        res.status(500).json({ ok: false, error: err.message, trace_id });
      }
    });
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
    fs.writeFileSync(fullPath, file.content, 'utf8');
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

// Helper to push progress updates to the A2A-router SSE endpoint
async function sendProgress(
  conversationId: string | undefined,
  phase: string,
  percent: number,
  message: string,
  status: 'in_progress' | 'completed' | 'error' = 'in_progress'
) {
  if (!conversationId) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.A2A_API_KEY) headers['x-api-key'] = process.env.A2A_API_KEY;
    await fetch(`${process.env.A2A_ROUTER_URL}/a2a/progress`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversationId, phase, percent, message, status }),
    });
  } catch (err) {
    logger.warn({ event: 'progress.send.error', err }, 'Failed to send progress update');
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

  // Phase 0: Product Discovery (Conversational)
  // If the spec is not yet confirmed by the user, we are in the discovery phase.
  if (!incomingSpec?.isConfirmed) {
    const discoveryResult: DiscoveryResponse = await runPhase0ProductDiscovery(
      userInput,
      incomingSpec,
      conversationId
    );

    // If discovery is not complete, we await more user input.
    if (!discoveryResult.isComplete) {
      return {
        status: 'AWAITING_USER_INPUT',
        responseToUser: discoveryResult.responseToUser,
        updatedAppSpec: discoveryResult.updatedAppSpec, // This will be cached by the router
      };
    }

    // At this point, the discovery phase *thinks* it's complete.
    // We will present the summary and mark the spec as ready for final confirmation.
    const specForConfirmation = { ...discoveryResult.updatedAppSpec, isConfirmed: false }; 

    // Before we return, check if the user's last message was the final "yes".
    const positiveConfirmation = userInput?.toLowerCase().trim().match(/^(yes|proceed)/);
    if (positiveConfirmation && incomingSpec) { // `incomingSpec` must exist to be confirming it
        // The user has confirmed. We can override the spec with a confirmed status and let the flow continue.
        // IMPORTANT: use the final spec from the discovery result as the confirmed spec
        incomingSpec = discoveryResult.updatedAppSpec;
        incomingSpec.isConfirmed = true;
    } else {
        // The user has NOT confirmed yet. Return the summary and wait for the 'yes'.
        return {
            status: 'AWAITING_USER_INPUT', 
            responseToUser: discoveryResult.responseToUser,
            updatedAppSpec: specForConfirmation, 
        };
    }
  }

  // The user has confirmed with 'yes', and the spec is confirmed.
  const appSpec: AppSpec = incomingSpec;
  logger.info({ event: 'phase.discovery.confirmed', appSpec }, 'Product discovery complete and confirmed by user.');

  // Send initial progress update
  await sendProgress(conversationId, 'plan', 0, 'Planning application');

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
    await sendProgress(conversationId, 'scaffold', 95, 'Writing scaffold to disk');
    await writeAppFromScaffold(allGeneratedFiles, dependencies);

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

    await sendProgress(conversationId, 'completed', 100, finalMessage, 'completed');

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
function handler(req: ExRequest, res: ExResponse) {
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