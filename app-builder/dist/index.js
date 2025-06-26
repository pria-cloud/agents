"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAppComposeIntent = handleAppComposeIntent;
require("dotenv/config");
const a2aClient_1 = require("./a2aClient");
const express_1 = __importDefault(require("express"));
const githubClient_1 = require("./githubClient");
const otel_1 = require("./otel");
const pino_1 = __importDefault(require("pino"));
const api_1 = require("@opentelemetry/api");
const otelMetrics_1 = require("./otelMetrics");
const catalogueClient_1 = require("./catalogueClient");
const path_1 = __importDefault(require("path"));
const phase0_clarification_1 = require("./phases/phase0_clarification");
const phase1_plan_1 = require("./phases/phase1_plan");
const phase2_codegen_1 = require("./phases/phase2_codegen");
const phase_review_1 = require("./phases/phase_review");
const writeGeneratedApp_1 = require("./writeGeneratedApp");
const fs_extra_1 = __importDefault(require("fs-extra"));
const logger = (0, pino_1.default)({
    name: 'app-builder',
    level: process.env.LOG_LEVEL || 'info',
});
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4001;
const TARGET_REPO = process.env.TARGET_REPO; // e.g. 'org/repo'
const BASE_BRANCH = 'main';
console.log('App-Builder agent starting...');
console.log('A2A_ROUTER_URL:', process.env.A2A_ROUTER_URL);
(0, otel_1.startOtel)().then(() => main());
async function main() {
    // Register the agent with the A2A router
    try {
        console.log('Registering agent with A2A router at', process.env.A2A_ROUTER_URL);
        const regResult = await (0, a2aClient_1.registerAgent)({
            agent_name: 'App-Builder',
            version: 'v1.0.0',
            capabilities: ['app.compose', 'app.preview'],
            endpoint_url: `http://localhost:${PORT}`,
            supports_mcp: true,
        });
        console.log('Registration result:', regResult);
        logger.info({ event: 'a2a.register', regResult }, 'Registered with A2A router');
    }
    catch (err) {
        console.error('Registration failed:', err);
        logger.error({ event: 'a2a.register.error', err }, 'Failed to register with A2A router');
        process.exit(1);
    }
    // Start HTTP server to receive intents
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.post('/intent', async (req, res) => {
        const { intent, trace_id, jwt, payload } = req.body;
        logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
        // Start a root span for the intent
        const tracer = api_1.trace.getTracer('app-builder');
        await tracer.startActiveSpan(intent || 'unknown_intent', async (span) => {
            try {
                // Add trace_id, workspace_id, request_id as span attributes if present
                if (trace_id)
                    span.setAttribute('trace_id', trace_id);
                if (payload?.workspace_id)
                    span.setAttribute('workspace_id', payload.workspace_id);
                if (payload?.request_id)
                    span.setAttribute('request_id', payload.request_id);
                let result;
                if (intent === 'app.compose') {
                    result = await handleAppComposeIntent(payload, trace_id, jwt, span);
                    res.status(200).json({ ok: true, trace_id, result });
                }
                else if (intent === 'app.preview') {
                    // This is a stub for a potential preview intent
                    const { files, dependencies } = payload;
                    await writeAppFromScaffold(files, dependencies);
                    // Here you might trigger a build and serve the app
                    res.status(200).json({ ok: true, trace_id, previewUrl: 'http://localhost:3000' });
                }
                else {
                    res.status(400).json({ ok: false, error: 'Unsupported intent', trace_id });
                }
                span.end();
            }
            catch (err) {
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
function isBestPracticeTemplate(obj) {
    return obj && Array.isArray(obj.sharedModels) && Array.isArray(obj.sharedWorkflows);
}
// Add ensureDirSync helper
function ensureDirSync(dir) {
    if (!fs_extra_1.default.existsSync(dir)) {
        fs_extra_1.default.mkdirSync(dir, { recursive: true });
    }
}
async function writeAppFromScaffold(generatedFiles, dependencies = []) {
    const outDir = path_1.default.resolve(__dirname, '../generated-app');
    const scaffoldDir = path_1.default.resolve(__dirname, 'scaffold-templates');
    logger.info({ event: 'scaffold.write.start', outDir, scaffoldDir }, 'Writing generated app from scaffold...');
    // 1. Clean output directory
    await fs_extra_1.default.emptyDir(outDir);
    // 1b. Manually copy scaffold files to outDir to ensure a true copy
    const scaffoldFiles = await fs_extra_1.default.readdir(scaffoldDir);
    for (const fileName of scaffoldFiles) {
        const srcPath = path_1.default.join(scaffoldDir, fileName);
        const destPath = path_1.default.join(outDir, fileName);
        const content = await fs_extra_1.default.readFile(srcPath, 'utf8');
        await fs_extra_1.default.writeFile(destPath, content, 'utf8');
    }
    logger.info({ event: 'scaffold.copied' }, 'Copied scaffold templates to output directory.');
    // 2. Write AI-generated files
    for (const file of generatedFiles) {
        const cleanPath = file.filePath.replace(/^"|"$/g, '');
        // Defensive check: Do not allow the LLM to overwrite the template package.json
        if (path_1.default.basename(cleanPath) === 'package.json') {
            logger.warn({ event: 'disk.write.skip', filePath: cleanPath }, `Skipping LLM-generated package.json to preserve template.`);
            continue;
        }
        const fullPath = path_1.default.join(outDir, cleanPath);
        ensureDirSync(path_1.default.dirname(fullPath));
        fs_extra_1.default.writeFileSync(fullPath, file.content, 'utf8');
        logger.info({ event: 'disk.write.file', filePath: fullPath }, `Wrote AI-generated file`);
    }
    // 3. Update package.json with new dependencies
    if (dependencies.length > 0) {
        const pkgJsonPath = path_1.default.join(outDir, 'package.json');
        try {
            const pkgJson = await fs_extra_1.default.readJson(pkgJsonPath);
            dependencies.forEach(dep => {
                // Naive parser for dep@version, assumes format is correct
                const parts = dep.split('@');
                const name = parts[0];
                const version = parts.length > 1 ? `^${parts.slice(1).join('@')}` : 'latest';
                pkgJson.dependencies[name] = version;
            });
            await fs_extra_1.default.writeJson(pkgJsonPath, pkgJson, { spaces: 2 });
            logger.info({ event: 'scaffold.pkg.updated', dependencies }, 'Updated package.json with new dependencies.');
        }
        catch (err) {
            logger.error({ event: 'scaffold.pkg.error', err }, 'Failed to update package.json with dependencies.');
        }
    }
    logger.info({ event: 'scaffold.write.complete' }, 'Finished writing generated app from scaffold.');
}
// Handler for app.compose intents
async function handleAppComposeIntent(appSpec, trace_id, jwt, parentSpan) {
    const tracer = api_1.trace.getTracer('app-builder');
    const startTime = Date.now();
    const labels = {
        service: 'app-builder',
        trace_id: trace_id || '',
        workspace_id: appSpec?.workspace_id || '',
        request_id: appSpec?.request_id || '',
    };
    try {
        // Phase 0: Clarification (Conditional)
        // If we don't have a spec version or a description, we must enter the clarification phase.
        if (!appSpec?.spec_version && !appSpec?.description) {
            const userInput = appSpec.userInput || 'an application';
            const clarificationResult = await (0, phase0_clarification_1.runPhase0Clarification)(userInput);
            // The result of clarification should be a new appSpec or questions.
            // For now, we'll just return it.
            logger.info({ event: 'phase.clarification.result', clarificationResult }, 'Clarification needed');
            return {
                status: 'clarification_needed',
                ...clarificationResult,
            };
        }
        // Phase 1: Planning & Classification
        let bestPracticeCatalogue = {};
        if (appSpec.domain) {
            try {
                bestPracticeCatalogue = await (0, catalogueClient_1.fetchBestPracticeSpec)(appSpec.domain, appSpec.catalogue_version || '1.0.0');
            }
            catch (err) {
                logger.error({ ...labels, event: 'best_practice_catalogue.error', err }, 'Failed to fetch best practice catalogue. Continuing without it.');
            }
        }
        const plan = await (0, phase1_plan_1.runPhase1Plan)(appSpec, bestPracticeCatalogue);
        const appType = plan.classification || plan.appType || 'custom';
        const bestPracticeTemplate = plan.bestPracticeTemplate || {};
        const actionPlan = plan.actionPlan || plan.action_plan || plan.steps || [];
        logger.info({ event: 'phase.codegen.action_plan', actionPlan }, 'Action plan before codegen loop');
        let allGeneratedFiles = [];
        // NEW: Pass the structured action plan directly to the codegen phase.
        const codegenResult = await (0, phase2_codegen_1.runPhase2Codegen)({
            actionPlan,
            brief: appSpec.description || appSpec.brief || "Build the application as described in the action plan.",
        });
        // Parse all outputs from the raw codegen result
        allGeneratedFiles = (0, writeGeneratedApp_1.parsePriaWriteBlocks)(codegenResult.raw);
        const dependencies = (0, writeGeneratedApp_1.parsePriaDependencyTags)(codegenResult.raw);
        if (dependencies.length > 0) {
            logger.info({ event: 'dependencies.found', dependencies }, 'Found dependencies to install');
            // In a real implementation, you would trigger `npm install` here.
            // For now, we just log them.
        }
        if (allGeneratedFiles.length === 0) {
            logger.error({ event: 'codegen.no_pria_write_blocks', codegenRaw: codegenResult.raw }, 'No <pria-write ...> blocks parsed from codegen output');
            (0, otelMetrics_1.recordError)({ ...labels, error_type: 'codegen_no_output' });
            throw new Error('Codegen LLM output did not contain any <pria-write ...> blocks. Please check the LLM prompt and output format.');
        }
        logger.info({ event: 'phase.codegen.all_generated_files', count: allGeneratedFiles.length }, 'All generated files after codegen loop');
        // PHASE REVIEW: Submit all generated files to the LLM for review
        let reviewResults = await (0, phase_review_1.runPhaseReview)(allGeneratedFiles, plan.schema);
        logger.info({ event: 'phase.review.completed', reviewResults }, 'Completed LLM review phase');
        let retryCount = 0;
        const maxRetries = 2;
        let filesToRetry = reviewResults.filter(r => !r.pass).map(r => r.filePath);
        // Helper: Map filePath to action plan step
        const fileToStep = new Map();
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
                const codegenResult = await (0, phase2_codegen_1.runPhase2Codegen)({
                    actionPlan: retryActionPlan,
                    brief: "This is a retry attempt. The following files failed a review. Please regenerate them, carefully following the original description and the new feedback provided in the action plan.",
                });
                const newFiles = (0, writeGeneratedApp_1.parsePriaWriteBlocks)(codegenResult.raw);
                // Replace the old failed files with the new ones
                const newFilePaths = newFiles.map(f => f.filePath.replace(/^"|"$/g, ''));
                allGeneratedFiles = allGeneratedFiles.filter(f => !newFilePaths.includes(f.filePath.replace(/^"|"$/g, '')));
                allGeneratedFiles.push(...newFiles);
                // Re-run review on the new files
                const newReviewResults = await (0, phase_review_1.runPhaseReview)(newFiles, plan.schema);
                reviewResults = reviewResults.filter(r => !cleanedFilesToRetry.includes(r.filePath.replace(/^"|"$/g, '')));
                reviewResults.push(...newReviewResults);
                filesToRetry = newReviewResults.filter(r => !r.pass).map(r => r.filePath);
            }
            else {
                // No steps found to retry, break the loop
                logger.error({ ...labels, event: 'review.retry.no_steps_found', filesToRetry }, 'Could not find action plan steps for failed files. Aborting retry.');
                filesToRetry = [];
            }
        }
        // Final check for failed files after retries
        const failedReviews = reviewResults.filter(r => !r.pass);
        if (failedReviews.length > 0) {
            logger.error({ event: 'review.failed', failedReviews }, 'Some files failed the review phase after retries. Aborting.');
            (0, otelMetrics_1.recordError)({ ...labels, error_type: 'review_failed' });
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
                        schemaSynthResult = await (0, a2aClient_1.sendIntent)({
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
                        workflowSynthResult = await (0, a2aClient_1.sendIntent)({
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
        let result = {};
        if (TARGET_REPO && process.env.GITHUB_TOKEN) {
            const branchName = `pria-app-builder-${Date.now()}`;
            try {
                await (0, githubClient_1.createBranch)(TARGET_REPO, BASE_BRANCH, branchName);
                await (0, githubClient_1.commitFiles)(TARGET_REPO, branchName, allGeneratedFiles.map(f => ({ path: f.filePath, content: f.content })));
                const prUrl = await (0, githubClient_1.openDraftPR)(TARGET_REPO, branchName, 'PRIA: Generated App', 'This PR was created automatically by the PRIA App-Builder agent.');
                logger.info({ event: 'github.pr.created', prUrl }, 'Opened draft PR on GitHub');
                result = { ...result, github_pr_url: prUrl };
            }
            catch (err) {
                logger.error({ ...labels, event: 'github.error', err }, 'Error creating GitHub branch or PR');
                // Don't re-throw, just log and continue without a PR
            }
        }
        // 6. Return result
        // Helper: Convert files array to legacy generatedCode/generatedComponents for test compatibility
        function filesToLegacy(files) {
            const generatedCode = {};
            const generatedComponents = {};
            for (const f of files) {
                if (f.filePath.startsWith('app/') && f.filePath.endsWith('.tsx')) {
                    // e.g., app/Home.tsx or app/page.tsx
                    const name = f.filePath.split('/').pop()?.replace('.tsx', '') || f.filePath;
                    generatedCode[name] = f.content;
                }
                else if (f.filePath.startsWith('components/') && f.filePath.endsWith('.tsx')) {
                    const name = f.filePath.split('/').pop()?.replace('.tsx', '') || f.filePath;
                    generatedComponents[name] = f.content;
                }
            }
            return { generatedCode, generatedComponents };
        }
        const legacy = process.env.NODE_ENV === 'test' ? filesToLegacy(allGeneratedFiles) : {};
        const endTime = Date.now();
        (0, otelMetrics_1.recordIntentLatency)(endTime - startTime, labels);
        return {
            ...result,
            status: 'completed',
            message: 'Application composition complete. A draft PR has been opened.',
            generated_files: allGeneratedFiles.map(f => f.filePath),
            dependencies,
            compliance: null,
        };
    }
    catch (err) {
        const endTime = Date.now();
        logger.error({ event: 'app.compose.error', err: err?.message, stack: err?.stack, trace_id, context: { err } }, 'Error in app.compose workflow');
        (0, otelMetrics_1.recordError)(labels);
        (0, otelMetrics_1.recordIntentLatency)(endTime - startTime, labels);
        throw err;
    }
}
main();
