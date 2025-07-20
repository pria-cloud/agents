import { query, type SDKMessage } from '@anthropic-ai/claude-code';
import pino from 'pino';

const logger = pino({
  name: 'claude-code-client',
  level: process.env.LOG_LEVEL || 'info',
});

export interface ClaudeCodeSession {
  sessionId: string;
  isActive: boolean;
  messages: SDKMessage[];
}

export interface ClaudeCodeResponse {
  content: string;
  toolUse?: {
    name: string;
    parameters: any;
  }[];
  progressUpdate?: {
    stage: string;
    progress: number;
    message: string;
  };
  cost?: number;
}

export interface ClaudeCodeOptions {
  apiKey?: string;
  maxTurns?: number;
  systemPrompt?: string;
}

export class ClaudeCodeClient {
  private options: ClaudeCodeOptions;
  private sessions: Map<string, ClaudeCodeSession> = new Map();

  constructor(options: ClaudeCodeOptions = {}) {
    this.options = {
      maxTurns: 10,
      ...options
    };
    logger.info('Initializing Claude Code Client');
  }

  async query(prompt: string, sessionId?: string): Promise<ClaudeCodeResponse> {
    logger.info('Claude Code query called', { prompt: prompt.substring(0, 100) + '...', sessionId });
    
    const abortController = new AbortController();
    const messages: SDKMessage[] = [];

    try {
      for await (const message of query({
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
        const session = this.sessions.get(sessionId)!;
        session.messages.push(...messages);
      }

      // Extract content from assistant messages
      const assistantMessages = messages.filter(m => m.type === 'assistant');
      const content = assistantMessages.map(m => {
        const msg = m.message;
        if (typeof msg.content === 'string') {
          return msg.content;
        } else if (Array.isArray(msg.content)) {
          return msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('\n');
        }
        return '';
      }).join('\n');

      // Look for tool use in assistant messages
      const toolUse: any[] = [];
      assistantMessages.forEach(m => {
        const msg = m.message;
        if (Array.isArray(msg.content)) {
          msg.content.forEach((c: any) => {
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

    } catch (error) {
      logger.error('Claude Code query failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async createSession(): Promise<ClaudeCodeSession> {
    const sessionId = Math.random().toString(36).substring(7);
    const session: ClaudeCodeSession = {
      sessionId,
      isActive: true,
      messages: []
    };
    
    this.sessions.set(sessionId, session);
    logger.info('Created Claude Code session', { sessionId });
    
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      session.isActive = false;
      this.sessions.delete(sessionId);
      logger.info('Ended Claude Code session', { sessionId });
    }
  }

  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId);
  }
}