import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import compression from 'compression';
import cors from 'cors';
dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 9999;
const app = express();
// Apply gzip compression and CORS (per backend implementation plan)
app.use(compression());
app.use(cors());

// Respect JSON_LIMIT env var, default 25mb
const jsonLimit = process.env.JSON_LIMIT || '25mb';
app.use(express.json({ limit: jsonLimit }));

// ---- API Key middleware ----
const REQUIRED_API_KEY = process.env.A2A_API_KEY;
const apiKeyMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (!REQUIRED_API_KEY) return next(); // Auth disabled if key not set
  const key = req.headers['x-api-key'];
  if (key === REQUIRED_API_KEY) return next();
  res.status(401).json({ ok: false, error: 'Unauthorized' });
};
app.use(apiKeyMiddleware);

// In-memory registry of agents
const agents: Record<string, any> = {};

// In-memory cache for conversations
const conversationCache: Record<string, any> = {};

// ---- Progress Streaming (SSE) ----
// Map of conversationId -> Set of Response objects (active SSE connections)
const progressStreams: Record<string, Set<Response>> = {};

// Open an SSE stream that clients can subscribe to for progress updates
app.get('/a2a/stream/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.(); // In case compression is on

  // Send an initial comment to keep connection alive
  res.write(': connected\n\n');

  // Track the response object so we can write to it later
  if (!progressStreams[conversationId]) {
    progressStreams[conversationId] = new Set();
  }
  progressStreams[conversationId].add(res);

  // Clean up on client disconnect
  req.on('close', () => {
    progressStreams[conversationId].delete(res);
  });
});

// Agent pushes progress updates here
app.post('/a2a/progress', (req: Request, res: Response) => {
  const update = req.body;
  const { conversationId } = update || {};

  if (!conversationId) {
    res.status(400).json({ ok: false, error: 'Missing conversationId in progress update' });
    return;
  }

  const subscribers = progressStreams[conversationId];
  if (subscribers && subscribers.size > 0) {
    const payload = `data: ${JSON.stringify(update)}\n\n`;
    subscribers.forEach((stream) => stream.write(payload));

    // Close streams automatically on completion or error
    if (['completed', 'error'].includes(update.status)) {
      subscribers.forEach((stream) => stream.end());
      delete progressStreams[conversationId];
    }
  }

  res.json({ ok: true });
});

// Register agent
app.post('/agents/register', (req: Request, res: Response): void => {
  const { agent_name, version, capabilities, endpoint_url, supports_mcp } = req.body;
  if (!agent_name || !capabilities || !endpoint_url) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }
  agents[agent_name] = { agent_name, version, capabilities, endpoint_url, supports_mcp };
  console.log(`[A2A] Registered agent: ${agent_name} at ${endpoint_url}`);
  res.json({ ok: true, agent: agents[agent_name] });
});

// Forward intent to the first capable agent
app.post('/a2a/intent', async (req: Request, res: Response): Promise<void> => {
  const { intent, conversationId: incomingConversationId } = req.body;
  if (!intent) {
    res.status(400).json({ ok: false, error: 'Missing intent' });
    return;
  }
  // Find an agent that can handle this intent
  const agent = Object.values(agents).find(a => a.capabilities.includes(intent));
  if (!agent) {
    res.status(404).json({ ok: false, error: 'No agent registered for this intent' });
    return;
  }

  const conversationId = incomingConversationId || `conv-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  const requestBody: Record<string, any> = { ...req.body, conversationId };

  // If continuing a conversation, retrieve cached state
  if (incomingConversationId && conversationCache[incomingConversationId]) {
    console.log(`[A2A] Continuing conversation ${conversationId}`);
    requestBody.appSpec = conversationCache[incomingConversationId].appSpec;
  } else {
    console.log(`[A2A] Starting new conversation ${conversationId}`);
  }

  try {
    const response = await fetch(agent.endpoint_url + '/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const data: any = await response.json();

    // Cache the updated state if the conversation is ongoing
    if (data.status === 'AWAITING_USER_INPUT' && data.updatedAppSpec) {
      console.log(`[A2A] Caching state for conversation ${conversationId}`);
      conversationCache[conversationId] = {
        appSpec: data.updatedAppSpec,
        lastUpdated: Date.now(),
      };
      // We don't want to send the whole spec back to the client, just the response
      delete data.updatedAppSpec;
    } else {
      // If the conversation is over or there's no spec, clear the cache
      console.log(`[A2A] Clearing cache for conversation ${conversationId}`);
      delete conversationCache[conversationId];
    }

    res.json({ ...data, conversationId });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[A2A] Router listening on port ${PORT}`);
}); 