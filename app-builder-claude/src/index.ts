import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { ClaudeCodeClient } from './claudeCodeClient';
import { ConversationManager } from './conversationManager';
import { AdaptivePromptStrategy } from './adaptivePromptStrategy';
import { A2AClient } from './a2aClient';
import { sendProgress } from './progressService';

const logger = pino({
  name: 'app-builder-claude',
  level: process.env.LOG_LEVEL || 'info',
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize clients
const claudeClient = new ClaudeCodeClient();
const conversationManager = new ConversationManager(claudeClient);
const adaptivePromptStrategy = new AdaptivePromptStrategy();
const a2aClient = new A2AClient();

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
    await sendProgress(conversationId, 'discovery', 0, 'Starting conversation');

    // Process conversation with adaptive approach
    const result = await conversationManager.processAppCompose(
      conversationId,
      userInput,
      appSpec,
      sessionId
    );

    // Send progress update if provided
    if (result.progressUpdate) {
      await sendProgress(
        conversationId,
        result.progressUpdate.stage,
        result.progressUpdate.progress,
        result.progressUpdate.message
      );
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
    });

    logger.info({ event: 'app.compose.complete', conversationId, success: result.success }, 'App composition completed');

  } catch (error: any) {
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
    
    const report = await complianceMonitor.checkConversationCompliance(
      context?.conversationHistory.map(h => h.content).join('\n') || '',
      files || [],
      context
    );

    res.json(report);
  } catch (error: any) {
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
      id: 'app-builder-claude',
      name: 'App Builder Claude',
      description: 'Conversational app builder using Claude Code SDK',
      version: '1.0.0',
      capabilities: [
        'app.compose',
        'conversation.continue',
        'compliance.check',
      ],
      endpoints: {
        'app.compose': '/api/app-compose',
        'conversation.continue': '/api/app-compose',
        'compliance.check': '/api/compliance-check',
      },
      metadata: {
        approach: 'conversational',
        sdk: 'claude-code',
        features: ['adaptive-prompting', 'real-time-compliance', 'contextual-guidance'],
      },
    };

    const result = await a2aClient.registerAgent(agentConfig);
    res.json(result);
  } catch (error: any) {
    logger.error({ event: 'agent.register.error', error: error.message }, 'Error registering agent');
    res.status(500).json({ error: 'Agent registration failed', message: error.message });
  }
});

// Start server
app.listen(port, () => {
  logger.info({ event: 'server.start', port }, `App Builder Claude agent listening on port ${port}`);
  
  // Register with A2A router on startup
  a2aClient.registerAgent({
    id: 'app-builder-claude',
    name: 'App Builder Claude',
    description: 'Conversational app builder using Claude Code SDK',
    version: '1.0.0',
    capabilities: ['app.compose', 'conversation.continue', 'compliance.check'],
    endpoints: {
      'app.compose': '/api/app-compose',
      'conversation.continue': '/api/app-compose',
      'compliance.check': '/api/compliance-check',
    },
    metadata: {
      approach: 'conversational',
      sdk: 'claude-code',
      features: ['adaptive-prompting', 'real-time-compliance', 'contextual-guidance'],
    },
  }).catch(error => {
    logger.error({ event: 'agent.register.startup.error', error: error.message }, 'Failed to register agent on startup');
  });
});

export default app; 