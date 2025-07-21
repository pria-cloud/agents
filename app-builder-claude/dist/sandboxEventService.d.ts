export interface SandboxEvent {
    event_type: 'sandbox_created' | 'sandbox_ready' | 'sandbox_failed';
    conversation_id: string;
    workspace_id: string;
    sandbox_id?: string;
    sandbox_url?: string;
    message: string;
    timestamp: string;
    metadata?: any;
}
export declare class SandboxEventService {
    /**
     * Broadcasts a sandbox event via Supabase Realtime
     */
    broadcastSandboxEvent(event: SandboxEvent): Promise<void>;
    /**
     * Broadcasts sandbox creation started event
     */
    broadcastSandboxCreating(conversationId: string, workspaceId: string, message?: string): Promise<void>;
    /**
     * Broadcasts sandbox ready event with URL
     */
    broadcastSandboxReady(conversationId: string, workspaceId: string, sandboxId: string, sandboxUrl: string, message?: string): Promise<void>;
    /**
     * Broadcasts sandbox failed event
     */
    broadcastSandboxFailed(conversationId: string, workspaceId: string, error: string, message?: string): Promise<void>;
    /**
     * Stores sandbox event in database for historical purposes
     */
    storeSandboxEvent(event: SandboxEvent): Promise<void>;
    /**
     * Gets sandbox events for a conversation
     */
    getSandboxEvents(conversationId: string, workspaceId: string): Promise<SandboxEvent[]>;
}
//# sourceMappingURL=sandboxEventService.d.ts.map