import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import compression from 'compression';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
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

// ---- Supabase Client ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[A2A] SUPABASE_URL / KEY not set – falling back to in-memory registry.');
}

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// In-memory cache of agent registry (populated from Supabase on demand)
interface AgentRecord {
  agent_name: string;
  version?: string;
  capabilities: string[];
  endpoint_url: string;
  supports_mcp?: boolean;
  last_heartbeat_at?: string;
}

let agentCache: AgentRecord[] = [];
let agentCacheExpires = 0;
const AGENT_CACHE_TTL_MS = Number(process.env.AGENT_CACHE_TTL_MS || 30_000); // 30s default

async function refreshAgentCache(force = false): Promise<void> {
  if (!supabase) return; // Nothing to refresh if no client
  if (!force && Date.now() < agentCacheExpires) return;

  const sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min window
  const { data, error } = await supabase
    .from('agent_registry')
    .select('*')
    .gte('last_heartbeat_at', sinceIso);

  if (error) {
    console.error('[A2A] Failed to refresh agent cache', error);
    return;
  }

  agentCache = data || [];
  agentCacheExpires = Date.now() + AGENT_CACHE_TTL_MS;
}

async function findAgentForIntent(intent: string): Promise<AgentRecord | undefined> {
  if (supabase) {
    await refreshAgentCache();
    return agentCache.find(a => a.capabilities?.includes(intent));
  }
  // Fallback to local cache if Supabase not configured
  return Object.values(localAgents).find(a => a.capabilities?.includes(intent));
}

// In-memory registry (fallback only)
const localAgents: Record<string, AgentRecord> = {}; // used when Supabase not configured

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
app.post('/agents/register', async (req: Request, res: Response): Promise<void> => {
  const { agent_name, version, capabilities, endpoint_url, supports_mcp } = req.body;

  if (!agent_name || !capabilities || !endpoint_url) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }

  const record: AgentRecord = {
    agent_name,
    version,
    capabilities,
    endpoint_url,
    supports_mcp,
    last_heartbeat_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('agent_registry').upsert(record, { onConflict: 'agent_name' });
      if (error) throw error;
      console.log(`[A2A] Upserted agent ${agent_name} into Supabase`);
      // Refresh cache immediately so it includes the latest record
      await refreshAgentCache(true);
    } catch (err: any) {
      console.error('[A2A] Failed to persist agent to Supabase', err);
      res.status(500).json({ ok: false, error: 'Failed to save agent registration' });
      return;
    }
  } else {
    localAgents[agent_name] = record;
  }

  res.json({ ok: true, agent: record });
});

// Forward intent to the first capable agent
app.post('/a2a/intent', async (req: Request, res: Response): Promise<void> => {
  const { intent, conversationId: incomingConversationId } = req.body;
  if (!intent) {
    res.status(400).json({ ok: false, error: 'Missing intent' });
    return;
  }
  // Find an agent that can handle this intent
  const agent = await findAgentForIntent(intent);
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

// ---- Health Check ----
app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[A2A] Router listening on port ${PORT}`);
}); 