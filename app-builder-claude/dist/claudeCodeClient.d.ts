import { type SDKMessage } from '@anthropic-ai/claude-code';
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
export declare class ClaudeCodeClient {
    private options;
    private sessions;
    constructor(options?: ClaudeCodeOptions);
    query(prompt: string, sessionId?: string): Promise<ClaudeCodeResponse>;
    createSession(): Promise<ClaudeCodeSession>;
    endSession(sessionId: string): Promise<void>;
    getSession(sessionId: string): ClaudeCodeSession | undefined;
}
//# sourceMappingURL=claudeCodeClient.d.ts.map