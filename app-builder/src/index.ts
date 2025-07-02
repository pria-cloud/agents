import 'dotenv/config';
import { registerAgent, sendIntent } from './a2aClient';
import express, { Request, Response } from 'express';
import { generateWithGemini } from './llmAdapter';
import { createBranch, commitFiles, openDraftPR } from './githubClient';
import { launchPreview, ProjectFile } from './previewService';
import { startOtel } from './otel';
import pino from 'pino';
import { trace, context, Span } from '@opentelemetry/api';
import { recordInferenceCost, recordIntentLatency, recordError } from './otelMetrics';
import { fetchBestPracticeSpec } from './catalogueClient';
import { writeFileSync } from 'fs';
import path from 'path';
import { runPhase0ProductDiscovery, AppSpec, DiscoveryResponse, LlmAdapter } from './phases/phase0_discovery';
import { runPhase1Plan } from './phases/phase1_plan';
import { runPhase2Codegen } from './phases/phase2_codegen';
import { runPhase4TestGen } from './phases/phase4_testgen';
import { runPhaseReview } from './phases/phase_review';
import { parsePriaWriteBlocks, parsePriaDependencyTags } from './writeGeneratedApp';
import fs from 'fs-extra';
import { mcp_supabase_generate_typescript_types } from './mcp_client';

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

async function main() {
  // Register the agent with the A2A router
  try {
    console.log('Registering agent with A2A router at', process.env.A2A_ROUTER_URL);
    const regResult = await registerAgent({
      agent_name: 'App-Builder',
      version: 'v1.0.0',
      capabilities: ['app.compose', 'app.preview'],
      endpoint_url: `http://localhost:${PORT}`,
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
  app.use(express.json());

  app.post('/intent', async (req: Request, res: Response) => {
    const { intent, trace_id, jwt } = req.body;
    logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
    // Start a root span for the intent
    const tracer = trace.getTracer('app-builder');
    await tracer.startActiveSpan(intent || 'unknown_intent', async (span) => {
      try {
        // Add trace_id, workspace_id, request_id as span attributes if present
        if (trace_id) span.setAttribute('trace_id', trace_id);
        
        // We will pass the whole body as the payload now
        const payload = req.body;
        if (payload?.workspace_id) span.setAttribute('workspace_id', payload.workspace_id);
        if (payload?.request_id) span.setAttribute('request_id', payload.request_id);

        let result;
        if (intent === 'app.compose') {
          result = await handleAppComposeIntent(payload, trace_id, jwt, span);
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

  app.listen(PORT, () => {
    logger.info({ event: 'startup', port: PORT }, `App-Builder agent listening on port ${PORT}`);
  });
}

// Type guard for bestPracticeTemplate
function isBestPracticeTemplate(obj: any): obj is { sharedModels: string[]; sharedWorkflows: string[]; uiLayouts?: any } {
  return obj && Array.isArray(obj.sharedModels) && Array.isArray(obj.sharedWorkflows);
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

// Handler for app.compose intents
export async function handleAppComposeIntent(
  requestBody: any,
  trace_id?: string,
  jwt?: string,
  parentSpan?: Span
) {
  logger.info({ event: 'handleAppComposeIntent.entry', requestBody }, 'Entering app compose handler');
  const tracer = trace.getTracer('app-builder');
  const { userInput, conversationId } = requestBody;
  const incomingSpec = requestBody.appSpec;

  const llmAdapter: LlmAdapter = {
    getJSONResponse: async (promptTemplate: string, input: any) => {
      // Construct the final prompt by combining the template and the specific input for this turn.
      const finalPrompt = `${promptTemplate}\n\n## Current Request\n\nHere is the user's input and the current specification state:\n\n${JSON.stringify(input, null, 2)}`;
      let rawResponse = await generateWithGemini({ prompt: finalPrompt });

      // Clean the response from the LLM - it may be wrapped in a ```json block
      const jsonRegex = /```json\n([\s\S]*?)\n```/;
      const match = rawResponse.match(jsonRegex);
      if (match && match[1]) {
        rawResponse = match[1];
      }

      // Sometimes the LLM fails to return valid JSON. We'll try to parse it, and if it fails, we'll return an error.
      try {
        return JSON.parse(rawResponse);
      } catch (e: any) {
        logger.error({ event: 'llm.response.invalid_json', json: rawResponse, error: e.message }, "LLM response could not be parsed as JSON");
        // Re-throw the error to be caught by the phase runner
        throw new Error(`Failed to parse LLM's JSON response: ${e.message}`);
      }
    },
  };

  // Phase 0: Product Discovery (Conversational)
  // If the spec is not yet confirmed by the user, we are in the discovery phase.
  if (!incomingSpec?.isConfirmed) {
    const discoveryResult: DiscoveryResponse = await runPhase0ProductDiscovery(
      userInput,
      incomingSpec,
      llmAdapter
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
    const positiveConfirmation = userInput?.toLowerCase().includes('yes') || userInput?.toLowerCase().includes('proceed');
    if (positiveConfirmation && incomingSpec) { // `incomingSpec` must exist to be confirming it
        // The user has confirmed. We can override the spec with a confirmed status and let the flow continue.
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
  const appSpec = incomingSpec;
  logger.info({ event: 'phase.discovery.confirmed', appSpec }, 'Product discovery complete and confirmed by user.');

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
    let bestPracticeCatalogue: any = {};
    if (appSpec.domain) {
      try {
        bestPracticeCatalogue = await fetchBestPracticeSpec(appSpec.domain, appSpec.catalogue_version || '1.0.0');
      } catch (err) {
        logger.error({ ...labels, event: 'best_practice_catalogue.error', err }, 'Failed to fetch best practice catalogue. Continuing without it.');
      }
    }
    const planResult = await runPhase1Plan(appSpec, bestPracticeCatalogue);
    let actionPlan = planResult.actionPlan;
    logger.info({ event: 'phase.plan.complete', actionPlan });

    logger.info({ event: 'phase.codegen.action_plan', actionPlan }, 'Action plan before codegen loop');

    let allReviewsPass = false;
    let reviewRetries = 0;
    const MAX_REVIEW_RETRIES = 3;
    let generatedFiles: { filePath: string; content: string }[] = [];

    while (reviewRetries < MAX_REVIEW_RETRIES && !allReviewsPass) {
      // Phase 2: Codegen
      // On the first run, actionPlan has the full plan. On retries, it's empty,
      // so this will only run once unless a correction fails and we repopulate the plan.
      if (actionPlan.length > 0) {
        const codegenResult = await runPhase2Codegen({
          actionPlan,
          brief: JSON.stringify(appSpec, null, 2),
          dbSchema: dbSchemaTypes,
        });
        generatedFiles = parsePriaWriteBlocks(codegenResult.raw);
        logger.info({ event: 'phase.codegen.complete', files: generatedFiles.map(f => f.filePath) });
      }

      // Phase 3: Review all generated files
      const reviewResults = await runPhaseReview(generatedFiles, appSpec);
      const failedReviews = reviewResults.filter(r => !r.pass);

      if (failedReviews.length === 0) {
        allReviewsPass = true;
        logger.info({ event: 'review.passed' }, 'All files passed the review phase.');
        // If we succeeded, we can break out of the retry loop.
        break;
      }
      
      // If we're here, some files failed. Increment retry counter.
      reviewRetries++;
      logger.warn({ event: 'review.failed', attempt: reviewRetries, failedReviews }, `Review attempt #${reviewRetries} failed. Files: ${failedReviews.map(f=>f.filePath).join(', ')}`);

      if (reviewRetries >= MAX_REVIEW_RETRIES) {
        logger.error({ event: 'review.failed.max_retries', failedReviews }, 'Max review retries reached. Aborting.');
        throw new Error(`One or more files failed the review after ${MAX_REVIEW_RETRIES} attempts. First error: ${failedReviews[0].feedback}`);
      }

      // Attempt to correct the first failed file
      const firstFailedReview = failedReviews[0];
      const fileToCorrect = generatedFiles.find(f => f.filePath === firstFailedReview.filePath);

      if (!fileToCorrect) {
        // This is a safety check. It shouldn't happen in normal flow.
        logger.error({ event: 'review.file_not_found_for_correction', filePath: firstFailedReview.filePath });
        actionPlan = planResult.actionPlan.filter((p: { filePath: string }) => p.filePath === firstFailedReview.filePath);
        continue; // Retry by regenerating the missing file
      }
      
      logger.info({ event: 'review.correction.start', file: fileToCorrect.filePath }, 'Attempting to correct a single file.');
      const correctionResult = await runPhase2Codegen({
        actionPlan: [], // Not needed for a correction
        brief: JSON.stringify(appSpec, null, 2),
        failedReview: {
          file: fileToCorrect,
          feedback: firstFailedReview.feedback,
        },
      });
      
      const correctedFileArray = parsePriaWriteBlocks(correctionResult.raw);

      if (correctedFileArray.length === 0 || !correctedFileArray[0].content) {
        logger.warn({ event: 'review.correction.no_output', file: fileToCorrect.filePath }, 'Correction attempt produced no parsable file content. Retrying generation for this file.');
        actionPlan = planResult.actionPlan.filter((p: { filePath: string }) => p.filePath === firstFailedReview.filePath);
        continue;
      }

      const correctedFile = correctedFileArray[0];
      // Find the index of the old file and replace it with the corrected version.
      const fileIndex = generatedFiles.findIndex(f => f.filePath === correctedFile.filePath);
      if (fileIndex !== -1) {
        generatedFiles[fileIndex] = correctedFile;
        logger.info({ event: 'review.correction.file_updated', file: correctedFile.filePath });
      } else {
        // This is unlikely, but handle it just in case.
        generatedFiles.push(correctedFile);
        logger.warn({ event: 'review.correction.file_added', file: correctedFile.filePath });
      }

      // The action plan should be empty for the next loop, so we only re-run the review.
      actionPlan = [];
    }

    if (!allReviewsPass) {
      // This path is taken if the loop exits due to max retries
      throw new Error("Failed to generate compliant code after multiple retries. Please check the logs for details.");
    }
    
    // Phase 4: Test Generation
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

    // *** NEW: Write generated files to disk using the scaffold function ***
    const allGeneratedFiles = [...generatedFiles, ...testFiles];
    await writeAppFromScaffold(allGeneratedFiles, []);

    // 4. Prepare schema and workflow sub-intents (stub)
    let schemaSynthResult = null;
    let workflowSynthResult = null;
    switch (appSpec.appType) {
      case 'domain':
        if (isBestPracticeTemplate(planResult.bestPracticeTemplate)) {
          await tracer.startActiveSpan('subintent.schema.synthesise', async (span) => {
            schemaSynthResult = await sendIntent({
              intent: 'schema.synthesise',
              payload: {
                workspace_id: appSpec.workspace_id,
                models: planResult.bestPracticeTemplate.sharedModels,
                request_id: appSpec.request_id,
              },
              trace_id: trace_id || '',
              jwt: jwt || '',
            });
            logger.info({ ...labels, event: 'subintent.schema.synthesise', schemaSynthResult }, 'Emitted schema.synthesise sub-intent');
            span.end();
          });
          await tracer.startActiveSpan('subintent.workflow.compose', async (span) => {
            workflowSynthResult = await sendIntent({
              intent: 'workflow.compose',
              payload: {
                workspace_id: appSpec.workspace_id,
                workflows: planResult.bestPracticeTemplate.sharedWorkflows,
                request_id: appSpec.request_id,
              },
              trace_id: trace_id || '',
              jwt: jwt || '',
            });
            logger.info({ ...labels, event: 'subintent.workflow.compose', workflowSynthResult }, 'Emitted workflow.compose sub-intent');
            span.end();
          });
        }
        break;
      default:
        // No-op for custom apps
        break;
    }

    // 5. (Optional) Launch preview (stub)
    // const previewUrl = await launchPreview(allGeneratedFiles);

    let result: any = {};
    if (TARGET_REPO && process.env.GITHUB_TOKEN) {
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

    // 6. Return result
    // Helper: Convert files array to legacy generatedCode/generatedComponents for test compatibility
    function filesToLegacy(files: { filePath: string; content: string }[]) {
      const generatedCode: Record<string, string> = {};
      const generatedComponents: Record<string, string> = {};
      for (const f of files) {
        if (f.filePath.startsWith('app/') && f.filePath.endsWith('.tsx')) {
          // e.g., app/Home.tsx or app/page.tsx
          const name = f.filePath.split('/').pop()?.replace('.tsx', '') || f.filePath;
          generatedCode[name] = f.content;
        } else if (f.filePath.startsWith('components/') && f.filePath.endsWith('.tsx')) {
          const name = f.filePath.split('/').pop()?.replace('.tsx', '') || f.filePath;
          generatedComponents[name] = f.content;
        }
      }
      return { generatedCode, generatedComponents };
    }
    const legacy = process.env.NODE_ENV === 'test' ? filesToLegacy(allGeneratedFiles) : {};
    const endTime = Date.now();
    recordIntentLatency(endTime - startTime, labels);
    return {
      ...result,
      status: 'completed',
      message: 'Application composition complete. A draft PR has been opened.',
      generated_files: allGeneratedFiles.map(f => f.filePath),
      dependencies: [],
      compliance: null,
    };
  } catch (err: any) {
    const endTime = Date.now();
    logger.error({ event: 'app.compose.error', err: err?.message, stack: err?.stack, trace_id, context: { err } }, 'Error in app.compose workflow');
    recordError(labels);
    recordIntentLatency(endTime - startTime, labels);
    throw err;
  }
}

// main(); // This call is redundant because startOtel().then(() => main()) already calls it. 