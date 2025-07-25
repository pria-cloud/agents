export interface ChatRequest {
    message: string;
    conversationId?: string;
    systemPrompt?: string;
    maxTurns?: number;
    projectContext?: {
        currentFile?: string;
        selectedText?: string;
        gitBranch?: string;
    };
}
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}
export interface ChatResponse {
    conversationId: string;
    messages: ChatMessage[];
    actions?: Array<{
        type: 'file_created' | 'file_modified' | 'command_executed';
        details: any;
    }>;
}
export interface Conversation {
    id: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
    projectContext?: any;
}
export declare class ClaudeService {
    private conversations;
    private readonly projectRoot;
    private isInitialized;
    private anthropic;
    constructor();
    private initialize;
    chat(request: ChatRequest): Promise<ChatResponse>;
    private buildContextualPrompt;
    private getDefaultSystemPrompt;
    getConversation(conversationId: string): Promise<Conversation | null>;
    clearConversation(conversationId: string): Promise<void>;
    listConversations(): Promise<Conversation[]>;
    isHealthy(): boolean;
    getStats(): {
        activeConversations: number;
        isInitialized: boolean;
        projectRoot: string;
        hasApiKey: boolean;
        hasAnthropicClient: boolean;
    };
}
//# sourceMappingURL=claude-service.d.ts.map