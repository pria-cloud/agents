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
  console.warn('[A2A] SUPABASE_URL / KEY not set – progress updates will not work.');
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

  const { data, error } = await supabase
    .from('agent_registry')
    .select('*');

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

// ---- Progress Broadcasting (Supabase Realtime Only) ----
// Channel management for Supabase Realtime
const activeChannels: Record<string, any> = {}; // Track active channels for broadcasting

// Helper to get a channel name that is safe and unique
function progressChannelName(conversationId: string) {
  return `progress:${conversationId}`;
}

// Get or create a subscribed channel for broadcasting
async function getOrCreateBroadcastChannel(conversationId: string) {
  if (!supabase) {
    console.warn('[A2A] Supabase not configured - cannot broadcast progress updates');
    return null;
  }
  
  const channelName = progressChannelName(conversationId);
  
  if (activeChannels[channelName]) {
    return activeChannels[channelName];
  }
  
  // Create new channel with broadcast-only configuration
  const channel = supabase.channel(channelName, {
    config: {
      broadcast: { self: true }
    }
  });
  
  // Subscribe to enable broadcasting
  const subscriptionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Channel subscription timeout'));
    }, 10000); // 10 second timeout
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        console.log(`[A2A] Broadcast channel subscribed for ${channelName}`);
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeout);
        console.error(`[A2A] Failed to subscribe to channel ${channelName}`);
        reject(new Error('Channel subscription failed'));
      }
    });
  });
  
  activeChannels[channelName] = channel;
  
  // Clean up after 1 hour to prevent memory leaks
  setTimeout(() => {
    if (activeChannels[channelName]) {
      activeChannels[channelName].unsubscribe();
      delete activeChannels[channelName];
      console.log(`[A2A] Cleaned up broadcast channel ${channelName}`);
    }
  }, 60 * 60 * 1000); // 1 hour
  
  try {
    await subscriptionPromise;
    return channel;
  } catch (error) {
    console.error(`[A2A] Error creating broadcast channel: ${error}`);
    delete activeChannels[channelName];
    return null;
  }
}

// Agent pushes progress updates here - broadcasts to Supabase Realtime
app.post('/a2a/progress', async (req: Request, res: Response) => {
  const update = req.body;
  const { conversationId } = update || {};

  if (!conversationId) {
    res.status(400).json({ ok: false, error: 'Missing conversationId in progress update' });
    return;
  }

  console.log(`[A2A] Received progress update for ${conversationId}:`, update);

  if (supabase) {
    try {
      const channel = await getOrCreateBroadcastChannel(conversationId);
      if (channel) {
        await channel.send({ type: 'broadcast', event: 'update', payload: update });
        console.log(`[A2A] Broadcasted progress update for ${conversationId}`);
      } else {
        console.error(`[A2A] Failed to get broadcast channel for ${conversationId}`);
      }
    } catch (err) {
      console.error(`[A2A] Failed to broadcast progress update:`, err);
    }
  } else {
    console.warn(`[A2A] Supabase not configured - cannot broadcast progress update for ${conversationId}`);
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