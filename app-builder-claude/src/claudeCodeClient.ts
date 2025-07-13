import { query, type SDKMessage, ClaudeCodeOptions } from '@anthropic-ai/claude-code';
import pino from 'pino';

const logger = pino({
  name: 'claude-code-client',
  level: process.env.LOG_LEVEL || 'info',
});

export interface ClaudeCodeSession {
  sessionId: string;
  messages: SDKMessage[];
  totalCost: number;
  isActive: boolean;
}

export interface ClaudeCodeResponse {
  success: boolean;
  result?: string;
  messages: SDKMessage[];
  sessionId?: string;
  totalCost: number;
  error?: string;
}

export class ClaudeCodeClient {
  private sessions: Map<string, ClaudeCodeSession> = new Map();
  private defaultOptions: ClaudeCodeOptions;

  constructor(options: Partial<ClaudeCodeOptions> = {}) {
    this.defaultOptions = {
      maxTurns: 10,
      allowedTools: ['Read', 'Write', 'Bash', 'Edit'],
      permissionMode: 'acceptEdits',
      ...options,
    };
  }

  /**
   * Start a new conversation with Claude Code SDK
   */
  async startConversation(
    prompt: string,
    options: Partial<ClaudeCodeOptions> = {}
  ): Promise<ClaudeCodeResponse> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    logger.info({ event: 'claude.conversation.start', sessionId, prompt }, 'Starting new Claude Code conversation');

    try {
      const messages: SDKMessage[] = [];
      let totalCost = 0;
      let result = '';

      const queryOptions: ClaudeCodeOptions = {
        ...this.defaultOptions,
        ...options,
      };

      for await (const message of query({ prompt, options: queryOptions })) {
        messages.push(message);
        
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            result = message.result;
            totalCost = message.total_cost_usd;
          } else {
            logger.error({ event: 'claude.conversation.error', sessionId, message }, 'Claude Code conversation failed');
            return {
              success: false,
              messages,
              totalCost,
              error: `Conversation failed: ${message.subtype}`,
            };
          }
        }
      }

      // Store session
      const session: ClaudeCodeSession = {
        sessionId,
        messages,
        totalCost,
        isActive: true,
      };
      this.sessions.set(sessionId, session);

      logger.info({ 
        event: 'claude.conversation.success', 
        sessionId, 
        totalCost,
        messageCount: messages.length 
      }, 'Claude Code conversation completed successfully');

      return {
        success: true,
        result,
        messages,
        sessionId,
        totalCost,
      };
    } catch (error: any) {
      logger.error({ event: 'claude.conversation.error', sessionId, error: error.message }, 'Claude Code conversation failed');
      return {
        success: false,
        messages: [],
        totalCost: 0,
        error: error.message,
      };
    }
  }

  /**
   * Continue an existing conversation
   */
  async continueConversation(
    sessionId: string,
    prompt: string,
    options: Partial<ClaudeCodeOptions> = {}
  ): Promise<ClaudeCodeResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        messages: [],
        totalCost: 0,
        error: `Session ${sessionId} not found`,
      };
    }

    logger.info({ event: 'claude.conversation.continue', sessionId, prompt }, 'Continuing Claude Code conversation');

    try {
      const messages: SDKMessage[] = [...session.messages];
      let totalCost = session.totalCost;
      let result = '';

      const queryOptions: ClaudeCodeOptions = {
        ...this.defaultOptions,
        ...options,
      };

      for await (const message of query({ prompt, options: queryOptions })) {
        messages.push(message);
        
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            result = message.result;
            totalCost += message.total_cost_usd;
          } else {
            logger.error({ event: 'claude.conversation.error', sessionId, message }, 'Claude Code conversation continuation failed');
            return {
              success: false,
              messages,
              totalCost,
              error: `Conversation continuation failed: ${message.subtype}`,
            };
          }
        }
      }

      // Update session
      session.messages = messages;
      session.totalCost = totalCost;
      this.sessions.set(sessionId, session);

      logger.info({ 
        event: 'claude.conversation.continue.success', 
        sessionId, 
        totalCost,
        messageCount: messages.length 
      }, 'Claude Code conversation continuation completed successfully');

      return {
        success: true,
        result,
        messages,
        sessionId,
        totalCost,
      };
    } catch (error: any) {
      logger.error({ event: 'claude.conversation.continue.error', sessionId, error: error.message }, 'Claude Code conversation continuation failed');
      return {
        success: false,
        messages: session.messages,
        totalCost: session.totalCost,
        error: error.message,
      };
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): ClaudeCodeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Close and cleanup session
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
      logger.info({ event: 'claude.session.closed', sessionId }, 'Claude Code session closed');
      return true;
    }
    return false;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ClaudeCodeSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }
} 