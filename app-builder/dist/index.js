"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAppComposeIntent = handleAppComposeIntent;
require("dotenv/config");
const a2aClient_1 = require("./a2aClient");
const express_1 = __importDefault(require("express"));
const llmAdapter_1 = require("./llmAdapter");
const githubClient_1 = require("./githubClient");
const otel_1 = require("./otel");
const pino_1 = __importDefault(require("pino"));
const api_1 = require("@opentelemetry/api");
const otelMetrics_1 = require("./otelMetrics");
const catalogueClient_1 = require("./catalogueClient");
const path_1 = __importDefault(require("path"));
const phase0_discovery_1 = require("./phases/phase0_discovery");
const phase1_plan_1 = require("./phases/phase1_plan");
const phase2_codegen_1 = require("./phases/phase2_codegen");
const phase4_testgen_1 = require("./phases/phase4_testgen");
const phase_review_1 = require("./phases/phase_review");
const writeGeneratedApp_1 = require("./writeGeneratedApp");
const fs_extra_1 = __importDefault(require("fs-extra"));
const mcp_client_1 = require("./mcp_client");
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
                    res.status(200).json({ ok: true, trace_id, ...result });
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
async function handleAppComposeIntent(requestBody, trace_id, jwt, parentSpan) {
    logger.info({ event: 'handleAppComposeIntent.entry', requestBody }, 'Entering app compose handler');
    const tracer = api_1.trace.getTracer('app-builder');
    const { appSpec: incomingSpec, userInput, conversationId } = requestBody;
    const llmAdapter = {
        getJSONResponse: async (promptTemplate, input) => {
            // Construct the final prompt by combining the template and the specific input for this turn.
            const finalPrompt = `${promptTemplate}\n\n## Current Request\n\nHere is the user's input and the current specification state:\n\n${JSON.stringify(input, null, 2)}`;
            let rawResponse = await (0, llmAdapter_1.generateWithGemini)({ prompt: finalPrompt });
            // Clean the response from the LLM - it may be wrapped in a ```json block
            const jsonRegex = /```json\n([\s\S]*?)\n```/;
            const match = rawResponse.match(jsonRegex);
            if (match && match[1]) {
                rawResponse = match[1];
            }
            // Sometimes the LLM fails to return valid JSON. We'll try to parse it, and if it fails, we'll return an error.
            try {
                return JSON.parse(rawResponse);
            }
            catch (e) {
                logger.error({ event: 'llm.response.invalid_json', json: rawResponse, error: e.message }, "LLM response could not be parsed as JSON");
                // Re-throw the error to be caught by the phase runner
                throw new Error(`Failed to parse LLM's JSON response: ${e.message}`);
            }
        },
    };
    // Phase 0: Product Discovery (Conversational)
    // If the spec is not yet confirmed by the user, we are in the discovery phase.
    if (!incomingSpec?.isConfirmed) {
        const discoveryResult = await (0, phase0_discovery_1.runPhase0ProductDiscovery)(userInput, incomingSpec, llmAdapter);
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
    // MCP Integration: Fetch dynamic context before generation
    let dbSchemaTypes = '';
    try {
        // In a real scenario, you might have logic to select the correct project.
        // For now, we'll hardcode the one we identified as most likely.
        const projectId = 'ktodzuolttfqrkozlsae';
        logger.info({ event: 'mcp.supabase.project_selected', projectId }, 'Selected Supabase project');
        const typesResult = await (0, mcp_client_1.mcp_supabase_generate_typescript_types)({ projectId });
        dbSchemaTypes = typesResult.types;
        logger.info({ event: 'mcp.supabase.types_fetched' }, 'Successfully fetched Supabase DB types');
    }
    catch (err) {
        logger.warn({ event: 'mcp.supabase.types_error', err }, 'Could not fetch Supabase DB types. Proceeding without them.');
        dbSchemaTypes = 'Error: Could not fetch database schema from Supabase.';
    }
    const startTime = Date.now();
    const labels = {
        service: 'app-builder',
        trace_id: trace_id || '',
        workspace_id: appSpec?.workspace_id || '',
        request_id: appSpec?.request_id || '',
    };
    try {
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
        const planResult = await (0, phase1_plan_1.runPhase1Plan)(appSpec, bestPracticeCatalogue);
        let actionPlan = planResult.actionPlan;
        logger.info({ event: 'phase.plan.complete', actionPlan });
        logger.info({ event: 'phase.codegen.action_plan', actionPlan }, 'Action plan before codegen loop');
        let allReviewsPass = false;
        let reviewRetries = 0;
        const MAX_REVIEW_RETRIES = 3;
        let generatedFiles = [];
        while (reviewRetries < MAX_REVIEW_RETRIES && !allReviewsPass) {
            // Phase 2: Codegen
            // On the first run, actionPlan has the full plan. On retries, it's empty,
            // so this will only run once unless a correction fails and we repopulate the plan.
            if (actionPlan.length > 0) {
                const codegenResult = await (0, phase2_codegen_1.runPhase2Codegen)({
                    actionPlan,
                    brief: JSON.stringify(appSpec, null, 2),
                    dbSchema: dbSchemaTypes,
                });
                generatedFiles = (0, writeGeneratedApp_1.parsePriaWriteBlocks)(codegenResult.raw);
                logger.info({ event: 'phase.codegen.complete', files: generatedFiles.map(f => f.filePath) });
            }
            // Phase 3: Review all generated files
            const reviewResults = await (0, phase_review_1.runPhaseReview)(generatedFiles, appSpec);
            const failedReviews = reviewResults.filter(r => !r.pass);
            if (failedReviews.length === 0) {
                allReviewsPass = true;
                logger.info({ event: 'review.passed' }, 'All files passed the review phase.');
                // If we succeeded, we can break out of the retry loop.
                break;
            }
            // If we're here, some files failed. Increment retry counter.
            reviewRetries++;
            logger.warn({ event: 'review.failed', attempt: reviewRetries, failedReviews }, `Review attempt #${reviewRetries} failed. Files: ${failedReviews.map(f => f.filePath).join(', ')}`);
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
                actionPlan = planResult.actionPlan.filter((p) => p.filePath === firstFailedReview.filePath);
                continue; // Retry by regenerating the missing file
            }
            logger.info({ event: 'review.correction.start', file: fileToCorrect.filePath }, 'Attempting to correct a single file.');
            const correctionResult = await (0, phase2_codegen_1.runPhase2Codegen)({
                actionPlan: [], // Not needed for a correction
                brief: JSON.stringify(appSpec, null, 2),
                failedReview: {
                    file: fileToCorrect,
                    feedback: firstFailedReview.feedback,
                },
            });
            const correctedFileArray = (0, writeGeneratedApp_1.parsePriaWriteBlocks)(correctionResult.raw);
            if (correctedFileArray.length === 0 || !correctedFileArray[0].content) {
                logger.warn({ event: 'review.correction.no_output', file: fileToCorrect.filePath }, 'Correction attempt produced no parsable file content. Retrying generation for this file.');
                actionPlan = planResult.actionPlan.filter((p) => p.filePath === firstFailedReview.filePath);
                continue;
            }
            const correctedFile = correctedFileArray[0];
            // Find the index of the old file and replace it with the corrected version.
            const fileIndex = generatedFiles.findIndex(f => f.filePath === correctedFile.filePath);
            if (fileIndex !== -1) {
                generatedFiles[fileIndex] = correctedFile;
                logger.info({ event: 'review.correction.file_updated', file: correctedFile.filePath });
            }
            else {
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
        const testFiles = [];
        for (const file of generatedFiles) {
            // A simple heuristic to decide if a file is a component that needs a test
            if (file.filePath.includes('components/') && (file.filePath.endsWith('.tsx') || file.filePath.endsWith('.jsx'))) {
                const testFilePath = file.filePath.replace(/(\.tsx|\.jsx)/, '.test$1');
                const testContent = await (0, phase4_testgen_1.runPhase4TestGen)({
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
                        schemaSynthResult = await (0, a2aClient_1.sendIntent)({
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
                        workflowSynthResult = await (0, a2aClient_1.sendIntent)({
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
            dependencies: [],
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
// main(); // This call is redundant because startOtel().then(() => main()) already calls it. 
