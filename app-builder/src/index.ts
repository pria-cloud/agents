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
import { runPhase0ProductDiscovery, AppSpec, DiscoveryResponse } from './phases/phase0_discovery';
import { runPhase1Plan } from './phases/phase1_plan';
import { runPhase2Codegen } from './phases/phase2_codegen';
import { runPhase4TestGen } from './phases/phase4_testgen';
import { runPhaseReview } from './phases/phase_review';
import { parsePriaWriteBlocks, parsePriaDependencyTags } from './writeGeneratedApp';
import fs from 'fs-extra';

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
    const { intent, trace_id, jwt, payload } = req.body;
    logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
    // Start a root span for the intent
    const tracer = trace.getTracer('app-builder');
    await tracer.startActiveSpan(intent || 'unknown_intent', async (span) => {
      try {
        // Add trace_id, workspace_id, request_id as span attributes if present
        if (trace_id) span.setAttribute('trace_id', trace_id);
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
  const tracer = trace.getTracer('app-builder');
  const { appSpec: incomingSpec, userInput, conversationId } = requestBody;

  const llmAdapter = {
    getJSONResponse: async (prompt: { toString: (arg: any) => string }, u: any) => {
      // This is a simplified adapter for demonstration.
      // In a real scenario, this would call the actual LLM service.
      const rawResponse = await generateWithGemini({ prompt: prompt.toString(u) });
      return JSON.parse(rawResponse);
    },
  };

  // Phase 0: Product Discovery (Conversational)
  // If the spec is not yet confirmed by the user, we are in the discovery phase.
  if (userInput !== 'yes' || !incomingSpec?.isConfirmed) {
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

    // If discovery is complete, ask for final confirmation.
    // The spec is passed back and forth until the user confirms.
    const confirmedSpec = { ...discoveryResult.updatedAppSpec, isConfirmed: false }; // Mark as ready for confirmation
    return {
      status: 'AWAITING_USER_INPUT', // Still waiting for the 'yes'
      responseToUser: discoveryResult.responseToUser,
      updatedAppSpec: confirmedSpec,
    };
  }

  // The user has confirmed with 'yes', and the spec is confirmed.
  const appSpec = incomingSpec;
  logger.info({ event: 'phase.discovery.confirmed', appSpec }, 'Product discovery complete and confirmed by user.');

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
    const plan = await runPhase1Plan(appSpec, bestPracticeCatalogue);
    const appType = plan.classification || plan.appType || 'custom';
    const bestPracticeTemplate = plan.bestPracticeTemplate || {};
    const actionPlan = plan.actionPlan || plan.action_plan || plan.steps || [];

    logger.info({ event: 'phase.codegen.action_plan', actionPlan }, 'Action plan before codegen loop');
    let allGeneratedFiles: { filePath: string; content: string }[] = [];

    // NEW: Pass the structured action plan directly to the codegen phase.
    const codegenResult = await runPhase2Codegen({
      actionPlan,
      brief: appSpec.description || appSpec.brief || "Build the application as described in the action plan.",
    });

    // Parse all outputs from the raw codegen result
    allGeneratedFiles = parsePriaWriteBlocks(codegenResult.raw);
    const dependencies = parsePriaDependencyTags(codegenResult.raw);

    if (dependencies.length > 0) {
      logger.info({ event: 'dependencies.found', dependencies }, 'Found dependencies to install');
      // In a real implementation, you would trigger `npm install` here.
      // For now, we just log them.
    }

    if (allGeneratedFiles.length === 0) {
      logger.error({ event: 'codegen.no_pria_write_blocks', codegenRaw: codegenResult.raw }, 'No <pria-write ...> blocks parsed from codegen output');
      recordError({ ...labels, error_type: 'codegen_no_output' });
      throw new Error('Codegen LLM output did not contain any <pria-write ...> blocks. Please check the LLM prompt and output format.');
    }
    logger.info({ event: 'phase.codegen.all_generated_files', count: allGeneratedFiles.length }, 'All generated files after codegen loop');

    // PHASE REVIEW: Submit all generated files to the LLM for review
    let reviewResults = await runPhaseReview(allGeneratedFiles, plan.schema);
    logger.info({ event: 'phase.review.completed', reviewResults }, 'Completed LLM review phase');
    let retryCount = 0;
    const maxRetries = 2;
    let filesToRetry = reviewResults.filter(r => !r.pass).map(r => r.filePath);
    
    // Helper: Map filePath to action plan step
    const fileToStep = new Map<string, any>();
    for (const step of actionPlan) {
      if (step.filePath) {
        // Clean the path to ensure consistent matching
        const cleanPath = step.filePath.replace(/^"|"$/g, '');
        fileToStep.set(cleanPath, step);
      }
    }

    while (filesToRetry.length > 0 && retryCount < maxRetries) {
      logger.warn({ ...labels, event: 'review.retry', filesToRetry, retryCount }, 'Retrying codegen for files that failed review');
      retryCount++;

      // Clean the file paths from the review before looking them up
      const cleanedFilesToRetry = filesToRetry.map(p => p.replace(/^"|"$/g, ''));
      const stepsToRetry = cleanedFilesToRetry.map(filePath => fileToStep.get(filePath)).filter(Boolean);

      if (stepsToRetry.length > 0) {
        // Construct a new action plan with feedback for the failed steps
        const retryActionPlan = stepsToRetry.map(step => {
          const review = reviewResults.find(r => r.filePath === step.filePath);
          return {
            ...step,
            description: `${step.description}\n\nThis file previously failed a review with the following feedback: ${review?.feedback}`
          };
        });

        const codegenResult = await runPhase2Codegen({
          actionPlan: retryActionPlan,
          brief: "This is a retry attempt. The following files failed a review. Please regenerate them, carefully following the original description and the new feedback provided in the action plan.",
        });

        const newFiles = parsePriaWriteBlocks(codegenResult.raw);
        // Replace the old failed files with the new ones
        const newFilePaths = newFiles.map(f => f.filePath.replace(/^"|"$/g, ''));
        allGeneratedFiles = allGeneratedFiles.filter(f => !newFilePaths.includes(f.filePath.replace(/^"|"$/g, '')));
        allGeneratedFiles.push(...newFiles);

        // Re-run review on the new files
        const newReviewResults = await runPhaseReview(newFiles, plan.schema);
        reviewResults = reviewResults.filter(r => !cleanedFilesToRetry.includes(r.filePath.replace(/^"|"$/g, '')));
        reviewResults.push(...newReviewResults);
        filesToRetry = newReviewResults.filter(r => !r.pass).map(r => r.filePath);
      } else {
        // No steps found to retry, break the loop
        logger.error({ ...labels, event: 'review.retry.no_steps_found', filesToRetry }, 'Could not find action plan steps for failed files. Aborting retry.');
        filesToRetry = [];
      }
    }

    // Final check for failed files after retries
    const failedReviews = reviewResults.filter(r => !r.pass);

    if (failedReviews.length > 0) {
      logger.error({ event: 'review.failed', failedReviews }, 'Some files failed the review phase after retries. Aborting.');
      recordError({ ...labels, error_type: 'review_failed' });
      throw new Error(`All generated files failed the review. Aborting. The first error was: ${failedReviews[0].feedback}`);
    }

    // *** NEW: Write generated files to disk using the scaffold function ***
    await writeAppFromScaffold(allGeneratedFiles, dependencies);

    // 4. Prepare schema and workflow sub-intents (stub)
    let schemaSynthResult = null;
    let workflowSynthResult = null;
    switch (appType) {
      case 'domain':
        if (isBestPracticeTemplate(bestPracticeTemplate)) {
          await tracer.startActiveSpan('subintent.schema.synthesise', async (span) => {
            schemaSynthResult = await sendIntent({
              intent: 'schema.synthesise',
              payload: {
                workspace_id: appSpec.workspace_id,
                models: bestPracticeTemplate.sharedModels,
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
                workflows: bestPracticeTemplate.sharedWorkflows,
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
      dependencies,
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

main(); 