"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const pino_1 = __importDefault(require("pino"));
const claudeCodeClient_1 = require("./claudeCodeClient");
const conversationManager_1 = require("./conversationManager");
const adaptivePromptStrategy_1 = require("./adaptivePromptStrategy");
const a2aClient_1 = require("./a2aClient");
const progressService_1 = require("./progressService");
const e2bSandboxService_1 = require("./e2bSandboxService");
const logger = (0, pino_1.default)({
    name: 'app-builder-claude',
    level: process.env.LOG_LEVEL || 'info',
});
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Initialize clients
const claudeClient = new claudeCodeClient_1.ClaudeCodeClient();
const conversationManager = new conversationManager_1.ConversationManager(claudeClient);
const adaptivePromptStrategy = new adaptivePromptStrategy_1.AdaptivePromptStrategy();
const a2aClient = new a2aClient_1.A2AClient();
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
// Main app composition endpoint
app.post('/api/app-compose', async (req, res) => {
    const { conversationId, userInput, appSpec, sessionId } = req.body;
    if (!conversationId || !userInput) {
        return res.status(400).json({
            error: 'Missing required fields: conversationId, userInput'
        });
    }
    try {
        logger.info({ event: 'app.compose.start', conversationId, userInput }, 'Starting app composition');
        // Send initial progress update
        await (0, progressService_1.sendProgress)(conversationId, 'discovery', 0, 'Starting conversation');
        // Process conversation with adaptive approach
        const result = await conversationManager.processAppCompose(conversationId, userInput, appSpec, sessionId);
        // Send progress update if provided
        if (result.progressUpdate) {
            await (0, progressService_1.sendProgress)(conversationId, result.progressUpdate.stage, result.progressUpdate.progress, result.progressUpdate.message);
        }
        // Create E2B sandbox if conversation is completed
        let sandboxUrl = null;
        if (result.context.currentStage === 'completed' && result.files && result.files.length > 0) {
            try {
                const workspaceId = appSpec?.workspace_id || '';
                if (workspaceId) {
                    await (0, progressService_1.sendProgress)(conversationId, 'sandbox', 95, 'Creating live preview sandbox...');
                    const e2bService = new e2bSandboxService_1.E2BSandboxService();
                    const sandboxInfo = await e2bService.createSandbox(result.files.map(f => ({
                        filePath: f.filePath,
                        content: f.content,
                        operation: f.operation || 'created'
                    })), [], // No dependencies extraction in conversational mode yet
                    {
                        templateId: process.env.E2B_TEMPLATE_ID || 'xeavhq5mira8no0bq688', // baseline-project template
                        teamId: process.env.E2B_TEAM_ID || 'd9ae965a-2a35-4a01-bc6e-6ff76faaa12c',
                        workspaceId,
                        conversationId
                    });
                    sandboxUrl = sandboxInfo.sandboxUrl;
                    await (0, progressService_1.sendProgress)(conversationId, 'sandbox', 100, `Live preview ready: ${sandboxUrl}`);
                    logger.info({
                        event: 'e2b.sandbox.success',
                        sandboxUrl,
                        conversationId,
                        workspaceId
                    }, 'E2B sandbox created successfully');
                }
                else {
                    logger.warn({
                        event: 'e2b.sandbox.skip',
                        conversationId,
                        reason: 'No workspace_id available'
                    }, 'Skipping E2B sandbox creation - no workspace_id');
                }
            }
            catch (error) {
                logger.error({
                    event: 'e2b.sandbox.error',
                    error: error instanceof Error ? error.message : String(error),
                    conversationId
                }, 'Failed to create E2B sandbox');
                await (0, progressService_1.sendProgress)(conversationId, 'sandbox', 100, 'Live preview creation failed, but files are ready');
            }
        }
        // Return conversational response
        res.json({
            success: result.success,
            conversationId,
            response: result.response,
            files: result.files,
            needsUserInput: result.needsUserInput,
            stage: result.context.currentStage,
            error: result.error,
            sandbox_url: sandboxUrl,
        });
        logger.info({ event: 'app.compose.complete', conversationId, success: result.success }, 'App composition completed');
    }
    catch (error) {
        logger.error({ event: 'app.compose.error', conversationId, error: error.message }, 'Error in app composition');
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});
// Conversation context endpoint
app.get('/api/conversation/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    const context = conversationManager.getContext(conversationId);
    if (!context) {
        return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({
        conversationId,
        stage: context.currentStage,
        requirements: context.requirements,
        technicalDecisions: context.technicalDecisions,
        fileCount: context.generatedFiles?.length || 0,
        totalCost: context.totalCost,
    });
});
// Compliance check endpoint
app.post('/api/compliance-check', async (req, res) => {
    const { conversationId, files } = req.body;
    try {
        const context = conversationManager.getContext(conversationId);
        const complianceMonitor = adaptivePromptStrategy.getComplianceMonitor();
        const report = await complianceMonitor.checkConversationCompliance(context?.conversationHistory.map(h => h.content).join('\n') || '', files || [], context);
        res.json(report);
    }
    catch (error) {
        logger.error({ event: 'compliance.check.error', error: error.message }, 'Error checking compliance');
        res.status(500).json({ error: 'Compliance check failed', message: error.message });
    }
});
// Cleanup conversation endpoint
app.delete('/api/conversation/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    conversationManager.cleanup(conversationId);
    res.json({ message: 'Conversation cleaned up' });
});
// A2A Router Integration
app.post('/api/register-agent', async (req, res) => {
    try {
        const agentConfig = {
            agent_name: 'App Builder Claude',
            version: '1.0.0',
            capabilities: [
                'app.compose',
                'conversation.continue',
                'compliance.check',
            ],
            endpoint_url: `http://localhost:${port}`,
            supports_mcp: false,
        };
        const result = await a2aClient.registerAgent(agentConfig);
        res.json(result);
    }
    catch (error) {
        logger.error({ event: 'agent.register.error', error: error.message }, 'Error registering agent');
        res.status(500).json({ error: 'Agent registration failed', message: error.message });
    }
});
// Start server
app.listen(port, () => {
    logger.info({ event: 'server.start', port }, `App Builder Claude agent listening on port ${port}`);
    // Register with A2A router on startup
    a2aClient.registerAgent({
        agent_name: 'App Builder Claude',
        version: '1.0.0',
        capabilities: ['app.compose', 'conversation.continue', 'compliance.check'],
        endpoint_url: `http://localhost:${port}`,
        supports_mcp: false,
    }).catch((error) => {
        logger.error({ event: 'agent.register.startup.error', error: error.message }, 'Failed to register agent on startup');
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map