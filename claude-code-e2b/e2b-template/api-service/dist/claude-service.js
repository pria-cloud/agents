"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class ClaudeService {
    constructor() {
        this.conversations = new Map();
        this.isInitialized = false;
        this.anthropic = null;
        this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project';
        this.initialize();
    }
    async initialize() {
        try {
            if (!process.env.ANTHROPIC_API_KEY) {
                console.warn('⚠️ ANTHROPIC_API_KEY not set - Claude functionality will be limited');
                return;
            }
            this.anthropic = new sdk_1.default({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            await promises_1.default.mkdir(this.projectRoot, { recursive: true });
            this.isInitialized = true;
            console.log('✅ Claude service initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize Claude service:', error);
        }
    }
    async chat(request) {
        if (!this.isInitialized || !this.anthropic) {
            throw new Error('Claude service not initialized or API key missing');
        }
        const conversationId = request.conversationId || (0, uuid_1.v4)();
        let conversation = this.conversations.get(conversationId);
        if (!conversation) {
            conversation = {
                id: conversationId,
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                projectContext: request.projectContext
            };
            this.conversations.set(conversationId, conversation);
        }
        const userMessage = {
            role: 'user',
            content: request.message,
            timestamp: new Date().toISOString()
        };
        conversation.messages.push(userMessage);
        try {
            const contextualPrompt = await this.buildContextualPrompt(request);
            const messages = [
                {
                    role: 'user',
                    content: contextualPrompt
                }
            ];
            const recentMessages = conversation.messages.slice(-10);
            for (let i = 0; i < recentMessages.length - 1; i++) {
                const msg = recentMessages[i];
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            }
            const actions = [];
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                temperature: 0.1,
                system: request.systemPrompt || this.getDefaultSystemPrompt(),
                messages: messages
            });
            let assistantResponse = '';
            for (const content of response.content) {
                if (content.type === 'text') {
                    assistantResponse += content.text;
                }
            }
            if (assistantResponse.includes('Created file:') || assistantResponse.includes('Modified file:')) {
                actions.push({
                    type: assistantResponse.includes('Created') ? 'file_created' : 'file_modified',
                    details: { message: 'File operation detected in response' }
                });
            }
            if (assistantResponse.includes('Executed:') || assistantResponse.includes('Running:')) {
                actions.push({
                    type: 'command_executed',
                    details: { message: 'Command execution detected in response' }
                });
            }
            const assistantMessage = {
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date().toISOString()
            };
            conversation.messages.push(assistantMessage);
            conversation.updatedAt = new Date().toISOString();
            return {
                conversationId,
                messages: conversation.messages,
                actions: actions.length > 0 ? actions : undefined
            };
        }
        catch (error) {
            console.error('Claude API execution error:', error);
            const errorMessage = {
                role: 'assistant',
                content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or rephrase your request.`,
                timestamp: new Date().toISOString()
            };
            conversation.messages.push(errorMessage);
            return {
                conversationId,
                messages: conversation.messages,
                actions: []
            };
        }
    }
    async buildContextualPrompt(request) {
        let prompt = request.message;
        if (request.projectContext) {
            const context = request.projectContext;
            prompt = `Context:\n`;
            if (context.currentFile) {
                prompt += `- Current file: ${context.currentFile}\n`;
                try {
                    const filePath = path_1.default.join(this.projectRoot, context.currentFile);
                    const content = await promises_1.default.readFile(filePath, 'utf-8');
                    prompt += `- File content:\n\`\`\`\n${content}\n\`\`\`\n`;
                }
                catch (error) {
                }
            }
            if (context.selectedText) {
                prompt += `- Selected text: ${context.selectedText}\n`;
            }
            if (context.gitBranch) {
                prompt += `- Current branch: ${context.gitBranch}\n`;
            }
            prompt += `\nUser request: ${request.message}`;
        }
        return prompt;
    }
    getDefaultSystemPrompt() {
        return `You are Claude, an AI assistant helping with software development in a containerized environment. You have access to a Next.js project in ${this.projectRoot}.

Key capabilities:
- You can help analyze, understand, and write code
- You can provide guidance on software architecture and best practices
- You can explain code, debug issues, and suggest improvements
- You have knowledge of modern web development with Next.js, React, TypeScript, and Tailwind CSS

Guidelines:
- Always follow Next.js 15 best practices and App Router conventions
- Use TypeScript when writing new code
- Follow existing code patterns and styling in the project
- Provide clear explanations of your suggestions
- Ask for clarification if the request is ambiguous
- Be helpful, accurate, and concise

Current working directory: ${this.projectRoot}
Available technologies: Next.js, React, TypeScript, Tailwind CSS, Git`;
    }
    async getConversation(conversationId) {
        return this.conversations.get(conversationId) || null;
    }
    async clearConversation(conversationId) {
        this.conversations.delete(conversationId);
    }
    async listConversations() {
        return Array.from(this.conversations.values());
    }
    isHealthy() {
        return this.isInitialized && !!this.anthropic;
    }
    getStats() {
        return {
            activeConversations: this.conversations.size,
            isInitialized: this.isInitialized,
            projectRoot: this.projectRoot,
            hasApiKey: !!process.env.ANTHROPIC_API_KEY,
            hasAnthropicClient: !!this.anthropic
        };
    }
}
exports.ClaudeService = ClaudeService;
//# sourceMappingURL=claude-service.js.map