"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 9999;
const app = (0, express_1.default)();
app.use(express_1.default.json());
// In-memory registry of agents
const agents = {};
// In-memory cache for conversations
const conversationCache = {};
// Register agent
app.post('/agents/register', (req, res) => {
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
app.post('/a2a/intent', async (req, res) => {
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
    const requestBody = { ...req.body, conversationId };
    // If continuing a conversation, retrieve cached state
    if (incomingConversationId && conversationCache[incomingConversationId]) {
        console.log(`[A2A] Continuing conversation ${conversationId}`);
        requestBody.appSpec = conversationCache[incomingConversationId].appSpec;
    }
    else {
        console.log(`[A2A] Starting new conversation ${conversationId}`);
    }
    try {
        const response = await (0, node_fetch_1.default)(agent.endpoint_url + '/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        // Cache the updated state if the conversation is ongoing
        if (data.status === 'AWAITING_USER_INPUT' && data.updatedAppSpec) {
            console.log(`[A2A] Caching state for conversation ${conversationId}`);
            conversationCache[conversationId] = {
                appSpec: data.updatedAppSpec,
                lastUpdated: Date.now(),
            };
            // We don't want to send the whole spec back to the client, just the response
            delete data.updatedAppSpec;
        }
        else {
            // If the conversation is over or there's no spec, clear the cache
            console.log(`[A2A] Clearing cache for conversation ${conversationId}`);
            delete conversationCache[conversationId];
        }
        res.json({ ...data, conversationId });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});
app.listen(PORT, () => {
    console.log(`[A2A] Router listening on port ${PORT}`);
});
