"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeClient = void 0;
const claude_code_1 = require("@anthropic-ai/claude-code");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'claude-code-client',
    level: process.env.LOG_LEVEL || 'info',
});
class ClaudeCodeClient {
    options;
    sessions = new Map();
    constructor(options = {}) {
        this.options = {
            maxTurns: 10,
            ...options
        };
        logger.info('Initializing Claude Code Client');
    }
    async query(prompt, sessionId) {
        logger.info('Claude Code query called', { prompt: prompt.substring(0, 100) + '...', sessionId });
        const abortController = new AbortController();
        const messages = [];
        try {
            for await (const message of (0, claude_code_1.query)({
                prompt,
                abortController,
                options: {
                    maxTurns: this.options.maxTurns || 10,
                    ...(this.options.systemPrompt && { systemPrompt: this.options.systemPrompt })
                }
            })) {
                messages.push(message);
                logger.debug('Received message', { type: message.type });
            }
            // Update session if provided
            if (sessionId && this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId);
                session.messages.push(...messages);
            }
            // Extract content from assistant messages
            const assistantMessages = messages.filter(m => m.type === 'assistant');
            const content = assistantMessages.map(m => {
                const msg = m.message;
                if (typeof msg.content === 'string') {
                    return msg.content;
                }
                else if (Array.isArray(msg.content)) {
                    return msg.content.map((c) => c.type === 'text' ? c.text : '').join('\n');
                }
                return '';
            }).join('\n');
            // Look for tool use in assistant messages
            const toolUse = [];
            assistantMessages.forEach(m => {
                const msg = m.message;
                if (Array.isArray(msg.content)) {
                    msg.content.forEach((c) => {
                        if (c.type === 'tool_use') {
                            toolUse.push({
                                name: c.name,
                                parameters: c.input
                            });
                        }
                    });
                }
            });
            // Extract cost from result messages
            const resultMessages = messages.filter(m => m.type === 'result');
            const totalCost = resultMessages.reduce((sum, m) => sum + (m.total_cost_usd || 0), 0);
            return {
                content,
                toolUse: toolUse.length > 0 ? toolUse : undefined,
                cost: totalCost > 0 ? totalCost : undefined
            };
        }
        catch (error) {
            logger.error('Claude Code query failed', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    async createSession() {
        const sessionId = Math.random().toString(36).substring(7);
        const session = {
            sessionId,
            isActive: true,
            messages: []
        };
        this.sessions.set(sessionId, session);
        logger.info('Created Claude Code session', { sessionId });
        return session;
    }
    async endSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            session.isActive = false;
            this.sessions.delete(sessionId);
            logger.info('Ended Claude Code session', { sessionId });
        }
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
}
exports.ClaudeCodeClient = ClaudeCodeClient;
//# sourceMappingURL=claudeCodeClient.js.map