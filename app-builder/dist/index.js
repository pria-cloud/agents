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
const otelMetrics_1 = require("./otelMetrics");
const phase0_discovery_1 = require("./phases/phase0_discovery");
const phase1_plan_1 = require("./phases/phase1_plan");
const phase2_codegen_1 = require("./phases/phase2_codegen");
const phase4_testgen_1 = require("./phases/phase4_testgen");
const pino_1 = __importDefault(require("pino"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const api_1 = require("@opentelemetry/api");
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
        const { intent, trace_id, jwt } = req.body;
        logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
        // Start a root span for the intent
        const tracer = api_1.trace.getTracer('app-builder');
        await tracer.startActiveSpan(intent || 'unknown_intent', async (span) => {
            try {
                // Add trace_id, workspace_id, request_id as span attributes if present
                if (trace_id)
                    span.setAttribute('trace_id', trace_id);
                // We will pass the whole body as the payload now
                const payload = req.body;
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
    const { userInput, conversationId } = requestBody;
    let incomingSpec = requestBody.appSpec;
    // Phase 0: Product Discovery (Conversational)
    // If the spec is not yet confirmed by the user, we are in the discovery phase.
    if (!incomingSpec?.isConfirmed) {
        const discoveryResult = await (0, phase0_discovery_1.runPhase0ProductDiscovery)(userInput, incomingSpec, conversationId);
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
        }
        else {
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
        const planResult = await (0, phase1_plan_1.runPhase1Plan)(appSpec);
        let actionPlan = planResult.actionPlan;
        logger.info({ event: 'phase.plan.complete', actionPlan });
        // Phase 2: Codegen
        const codegenResult = await (0, phase2_codegen_1.runPhase2Codegen)({
            actionPlan,
            brief: JSON.stringify(appSpec, null, 2),
            dbSchema: dbSchemaTypes,
        });
        const generatedFiles = codegenResult.files;
        const dependencies = codegenResult.dependencies;
        logger.info({ event: 'phase.codegen.complete', files: generatedFiles.map(f => f.filePath) });
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
        await writeAppFromScaffold(allGeneratedFiles, dependencies);
        // 4. Prepare schema and workflow sub-intents (stub) - This logic is removed as bestPracticeTemplate is gone
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
