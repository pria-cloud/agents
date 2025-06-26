import 'dotenv/config';
import { registerAgent, sendIntent } from './a2aClient';
import express from 'express';
import { generateWithGemini } from './llmAdapter';
import { createBranch, commitFiles, openDraftPR } from './githubClient';
import { launchPreview } from './previewService';
import { startOtel } from './otel';
import pino from 'pino';
import { trace } from '@opentelemetry/api';
import { recordIntentLatency, recordError } from './otelMetrics';
import { fetchBestPracticeSpec } from './catalogueClient';
import { layouts } from '../layouts';
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
    }
    catch (err) {
        console.error('Registration failed:', err);
        logger.error({ event: 'a2a.register.error', err }, 'Failed to register with A2A router');
        process.exit(1);
    }
    // Start HTTP server to receive intents
    const app = express();
    app.use(express.json());
    app.post('/intent', async (req, res) => {
        const { intent, payload, trace_id, jwt } = req.body;
        logger.info({ event: 'intent.received', intent, trace_id }, 'Received intent');
        // Start a root span for the intent
        const tracer = trace.getTracer('app-builder');
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
// Handler for app.compose intents
export async function handleAppComposeIntent(intentPayload, trace_id, jwt, parentSpan) {
    const tracer = trace.getTracer('app-builder');
    const startTime = Date.now();
    const labels = {
        service: 'app-builder',
        trace_id: trace_id || '',
        workspace_id: intentPayload?.workspace_id || '',
        request_id: intentPayload?.request_id || '',
    };
    try {
        // 1. Validate and parse the incoming spec
        const requiredFields = ['spec_version', 'pages', 'components'];
        const missingFields = requiredFields.filter(f => !(f in intentPayload));
        // 2. Use Gemini 2.5 Flash to clarify requirements if needed
        let clarification = null;
        let clarificationQuestions = null;
        if (missingFields.length > 0) {
            clarification = `Missing required fields: ${missingFields.join(', ')}`;
            // Use Gemini to generate clarifying questions
            await tracer.startActiveSpan('llm.clarification', async (span) => {
                const geminiPrompt = `The following fields are missing or ambiguous in the app spec: ${missingFields.join(', ')}. Please generate a list of clarifying questions for the user or domain expert to resolve these gaps.`;
                clarificationQuestions = await generateWithGemini({
                    prompt: geminiPrompt,
                    system: 'You are a senior product manager skilled at requirements clarification.'
                });
                span.setAttribute('model', 'gemini-2.5-flash');
                span.end();
            });
            logger.warn({ ...labels, event: 'clarification', clarificationQuestions }, 'Clarification required');
            return { error: clarification, clarificationQuestions };
        }
        // 3. Classify app and enforce best-practice catalogue
        let appType = 'custom';
        let bestPracticeTemplate = { sharedModels: [], sharedWorkflows: [] };
        let selectedLayout = null;
        await tracer.startActiveSpan('app.classification', async (span) => {
            if (intentPayload.domain) {
                try {
                    // Try to fetch best-practice template from GitHub catalogue
                    const spec = await fetchBestPracticeSpec(intentPayload.domain, intentPayload.catalogue_version || '1.0.0');
                    appType = 'domain';
                    bestPracticeTemplate = {
                        sharedModels: (spec?.spec?.data_models || []).map((m) => m.name),
                        sharedWorkflows: (spec?.spec?.workflows || []).map((w) => w.name),
                        uiLayouts: spec?.spec?.ui_layouts || [],
                    };
                    // Use layout from best-practice if present
                    if (bestPracticeTemplate.uiLayouts && bestPracticeTemplate.uiLayouts.length > 0) {
                        selectedLayout = bestPracticeTemplate.uiLayouts[0]; // Use the first layout as default
                    }
                }
                catch (err) {
                    span.recordException(err);
                    span.setStatus({ code: 2, message: 'Failed to fetch best-practice template' });
                }
            }
            else {
                // Custom app: check for layout in intent, else ask user
                if (intentPayload.layout && layouts[intentPayload.layout]) {
                    selectedLayout = layouts[intentPayload.layout];
                }
                else if (!intentPayload.layout) {
                    // No layout specified, respond with clarifying question
                    const layoutOptions = Object.keys(layouts).map(key => ({ key, ...layouts[key] }));
                    return {
                        ok: false,
                        clarification: 'Which layout would you like for your app?',
                        options: layoutOptions
                    };
                }
            }
            span.setAttribute('app_type', appType);
            span.setAttribute('domain', intentPayload.domain || 'none');
            logger.info({ ...labels, event: 'app.classification', appType, bestPracticeTemplate }, 'App classified');
            span.end();
        });
        // 4. Prepare schema and workflow sub-intents (stub)
        let schemaSynthResult = null;
        let workflowSynthResult = null;
        switch (appType) {
            case 'domain':
                if (isBestPracticeTemplate(bestPracticeTemplate)) {
                    // Always use shared models/workflows for domain apps
                    await tracer.startActiveSpan('subintent.schema.synthesise', async (span) => {
                        // TODO: Replace with real sub-intent emission
                        schemaSynthResult = await sendIntent({
                            intent: 'schema.synthesise',
                            payload: {
                                workspace_id: intentPayload.workspace_id,
                                models: bestPracticeTemplate.sharedModels,
                                request_id: intentPayload.request_id,
                            },
                            trace_id: trace_id || '',
                            jwt: jwt || '',
                        });
                        logger.info({ ...labels, event: 'subintent.schema.synthesise', schemaSynthResult }, 'Emitted schema.synthesise sub-intent');
                        span.end();
                    });
                    await tracer.startActiveSpan('subintent.workflow.compose', async (span) => {
                        // TODO: Replace with real sub-intent emission
                        workflowSynthResult = await sendIntent({
                            intent: 'workflow.compose',
                            payload: {
                                workspace_id: intentPayload.workspace_id,
                                workflows: bestPracticeTemplate.sharedWorkflows,
                                request_id: intentPayload.request_id,
                            },
                            trace_id: trace_id || '',
                            jwt: jwt || '',
                        });
                        logger.info({ ...labels, event: 'subintent.workflow.compose', workflowSynthResult }, 'Emitted workflow.compose sub-intent');
                        span.end();
                    });
                }
                break;
            case 'custom':
            default:
                // For custom apps, TODO: emit sub-intents based on user spec
                // (stub)
                break;
        }
        // 5. Compliance and DLP validation (stub)
        let compliancePassed = false;
        let dlpScanPassed = false;
        await tracer.startActiveSpan('compliance.dlp.validation', async (span) => {
            // TODO: Replace with real compliance/DLP validation
            compliancePassed = true;
            dlpScanPassed = true;
            logger.info({ ...labels, event: 'compliance.dlp.validation', compliancePassed, dlpScanPassed }, 'Compliance/DLP validation complete');
            span.end();
        });
        if (!compliancePassed || !dlpScanPassed) {
            logger.warn({ ...labels, event: 'compliance.dlp.blocked' }, 'Blocked by compliance or DLP');
            return { error: 'Blocked by compliance or DLP validation' };
        }
        // 6. Use Gemini 2.5 Flash to generate a high-level project plan
        let projectPlan = '';
        await tracer.startActiveSpan('llm.project_plan', async (span) => {
            projectPlan = await generateWithGemini({
                prompt: `Given the following app spec, break it down into a high-level project plan with pages, data models, and auth rules.\n${JSON.stringify(intentPayload, null, 2)}`,
                system: 'You are an expert Next.js architect.'
            });
            span.setAttribute('model', 'gemini-2.5-flash');
            span.end();
        });
        // 7. Use Gemini to generate Next.js code for each page
        const generatedCode = {};
        if (Array.isArray(intentPayload.pages)) {
            for (const page of intentPayload.pages) {
                const pageName = typeof page === 'string' ? page : page.name || 'UnnamedPage';
                // Check for a best-practice layout for this page
                let layoutPrompt = '';
                if (appType === 'domain' && bestPracticeTemplate.uiLayouts && Array.isArray(bestPracticeTemplate.uiLayouts)) {
                    const layoutEntry = bestPracticeTemplate.uiLayouts.find((l) => l.page === pageName);
                    if (layoutEntry && layoutEntry.layout) {
                        layoutPrompt = `\nUse this best-practice layout: ${JSON.stringify(layoutEntry.layout)}.`;
                    }
                }
                else if (selectedLayout) {
                    layoutPrompt = `\nUse the following layout skeleton for this page: ${JSON.stringify(selectedLayout.structure)}.`;
                }
                const prompt = `Generate a Next.js page named "${pageName}".${layoutPrompt}\nPage spec: ${JSON.stringify(page)}`;
                generatedCode[pageName] = await generateWithGemini({ prompt });
            }
        }
        // 8. Use Gemini to generate React components for each component in the spec
        const generatedComponents = {};
        if (Array.isArray(intentPayload.components)) {
            for (const component of intentPayload.components) {
                const componentName = typeof component === 'string' ? component : component.name || 'UnnamedComponent';
                // Check if this component is referenced in any best-practice layout
                let usagePrompt = '';
                if (bestPracticeTemplate.uiLayouts && Array.isArray(bestPracticeTemplate.uiLayouts)) {
                    const usedInPages = bestPracticeTemplate.uiLayouts
                        .filter((l) => Array.isArray(l.layout) && l.layout.some((c) => c.component === componentName))
                        .map((l) => l.page);
                    if (usedInPages.length > 0) {
                        usagePrompt = `\nThis component is used in the following pages: ${usedInPages.join(', ')}.`;
                    }
                }
                await tracer.startActiveSpan('llm.codegen.component', async (span) => {
                    // Ensure generated code uses workspace_id and RLS patterns if relevant
                    const code = await generateWithGemini({
                        prompt: `Generate a reusable React component in TypeScript named "${componentName}" suitable for use in a Next.js 15 app. Use Tailwind CSS and shadcn/ui where appropriate.${usagePrompt} Return only the code, no explanation.`,
                        system: 'You are an expert React developer.'
                    });
                    generatedComponents[componentName] = code;
                    span.setAttribute('model', 'gemini-2.5-flash');
                    span.setAttribute('component', componentName);
                    span.end();
                });
            }
        }
        // 9. Commit and open a PR using GitHub API if configured
        let prUrl = 'https://github.com/example/repo/pull/123'; // fallback
        if (process.env.GITHUB_TOKEN && TARGET_REPO) {
            await tracer.startActiveSpan('github.commit_pr', async (span) => {
                try {
                    const branch = `app-builder/${Date.now()}`;
                    await createBranch(TARGET_REPO, BASE_BRANCH, branch);
                    // Prepare files for commit
                    const files = [];
                    for (const [pageName, code] of Object.entries(generatedCode)) {
                        files.push({ path: `pages/${pageName}.tsx`, content: code });
                    }
                    for (const [componentName, code] of Object.entries(generatedComponents)) {
                        files.push({ path: `components/${componentName}.tsx`, content: code });
                    }
                    await commitFiles(TARGET_REPO, branch, files);
                    prUrl = await openDraftPR(TARGET_REPO, branch, 'App-Builder: Generated App', 'This PR was generated by the PRIA App-Builder agent.');
                    span.setAttribute('repo', TARGET_REPO);
                    span.setAttribute('branch', branch);
                }
                catch (err) {
                    logger.error({ ...labels, event: 'github.error', err }, 'GitHub integration failed');
                    recordError({ ...labels, step: 'github' });
                    // prUrl remains fallback
                }
                finally {
                    span.end();
                }
            });
        }
        // 10. Launch a preview using the preview service
        let previewUrl = 'https://preview.pria.app/workspace/app/session'; // fallback
        await tracer.startActiveSpan('preview.launch', async (span) => {
            try {
                // Assemble all files for preview
                const previewFiles = [];
                for (const [pageName, code] of Object.entries(generatedCode)) {
                    previewFiles.push({ path: `pages/${pageName}.tsx`, content: code });
                }
                for (const [componentName, code] of Object.entries(generatedComponents)) {
                    previewFiles.push({ path: `components/${componentName}.tsx`, content: code });
                }
                previewUrl = await launchPreview(previewFiles);
                span.setAttribute('preview_url', previewUrl);
            }
            catch (err) {
                logger.error({ ...labels, event: 'preview.error', err }, 'Preview service failed');
                recordError({ ...labels, step: 'preview' });
                // previewUrl remains fallback
            }
            finally {
                span.end();
            }
        });
        // 11. Emit app.preview intent to the A2A router
        let a2aEmitResult = null;
        await tracer.startActiveSpan('a2a.emit', async (span) => {
            if (trace_id && jwt) {
                try {
                    a2aEmitResult = await sendIntent({
                        intent: 'app.preview',
                        payload: {
                            preview_url: previewUrl,
                            pr_url: prUrl,
                            build_ms: Date.now() - startTime,
                            // Add more metadata as needed
                        },
                        trace_id,
                        jwt,
                    });
                    logger.info({ ...labels, event: 'a2a.emit', previewUrl, prUrl }, 'Emitted app.preview intent');
                }
                catch (err) {
                    logger.error({ ...labels, event: 'a2a.emit.error', err }, 'Failed to emit app.preview intent');
                    recordError({ ...labels, step: 'a2a.emit' });
                }
                finally {
                    span.end();
                }
            }
            else {
                span.end();
            }
        });
        // 12. Record metrics
        recordIntentLatency(Date.now() - startTime, labels);
        // (Stub) recordInferenceCost: In a real implementation, parse cost from Gemini API response
        // recordInferenceCost(cost, { ...labels, model: 'gemini-2.5-flash' });
        // 13. Return a summary object
        return {
            clarification,
            clarificationQuestions,
            appType,
            bestPracticeTemplate,
            schemaSynthResult,
            workflowSynthResult,
            compliancePassed,
            dlpScanPassed,
            projectPlan,
            generatedCode, // pages
            generatedComponents, // components
            prUrl,
            previewUrl,
            build_ms: Date.now() - startTime,
            a2aEmitResult,
        };
    }
    catch (err) {
        logger.error({ ...labels, event: 'intent.error', err }, 'Error in handleAppComposeIntent');
        recordError({ ...labels, step: 'handleAppComposeIntent' });
        throw err;
    }
}
main();
