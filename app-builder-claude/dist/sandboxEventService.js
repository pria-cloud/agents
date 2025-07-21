"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxEventService = void 0;
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
class SandboxEventService {
    /**
     * Broadcasts a sandbox event via Supabase Realtime
     */
    async broadcastSandboxEvent(event) {
        try {
            // Create a channel for this conversation
            const channelName = `conversation:${event.conversation_id}`;
            const channel = supabase_1.supabase.channel(channelName, {
                config: {
                    broadcast: { self: true },
                    presence: { key: 'sandbox_event' }
                }
            });
            // Send the event
            await channel.send({
                type: 'broadcast',
                event: 'sandbox_event',
                payload: event
            });
            logger_1.logger.info({
                event: 'sandbox.event.broadcast',
                channelName,
                eventType: event.event_type,
                conversationId: event.conversation_id,
                sandboxUrl: event.sandbox_url
            }, 'Sandbox event broadcasted');
        }
        catch (error) {
            logger_1.logger.error({
                event: 'sandbox.event.broadcast.error',
                error: error instanceof Error ? error.message : String(error),
                conversationId: event.conversation_id
            }, 'Failed to broadcast sandbox event');
        }
    }
    /**
     * Broadcasts sandbox creation started event
     */
    async broadcastSandboxCreating(conversationId, workspaceId, message = 'Creating live preview sandbox...') {
        const event = {
            event_type: 'sandbox_created',
            conversation_id: conversationId,
            workspace_id: workspaceId,
            message,
            timestamp: new Date().toISOString()
        };
        await this.broadcastSandboxEvent(event);
    }
    /**
     * Broadcasts sandbox ready event with URL
     */
    async broadcastSandboxReady(conversationId, workspaceId, sandboxId, sandboxUrl, message = 'Live preview ready') {
        const event = {
            event_type: 'sandbox_ready',
            conversation_id: conversationId,
            workspace_id: workspaceId,
            sandbox_id: sandboxId,
            sandbox_url: sandboxUrl,
            message: `${message}: ${sandboxUrl}`,
            timestamp: new Date().toISOString()
        };
        await this.broadcastSandboxEvent(event);
    }
    /**
     * Broadcasts sandbox failed event
     */
    async broadcastSandboxFailed(conversationId, workspaceId, error, message = 'Live preview creation failed') {
        const event = {
            event_type: 'sandbox_failed',
            conversation_id: conversationId,
            workspace_id: workspaceId,
            message: `${message}: ${error}`,
            timestamp: new Date().toISOString(),
            metadata: { error }
        };
        await this.broadcastSandboxEvent(event);
    }
    /**
     * Stores sandbox event in database for historical purposes
     */
    async storeSandboxEvent(event) {
        try {
            const { error } = await supabase_1.supabase
                .from('sandbox_events')
                .insert({
                event_type: event.event_type,
                conversation_id: event.conversation_id,
                workspace_id: event.workspace_id,
                sandbox_id: event.sandbox_id,
                sandbox_url: event.sandbox_url,
                message: event.message,
                metadata: event.metadata || {},
                created_at: event.timestamp
            });
            if (error) {
                logger_1.logger.error({
                    event: 'sandbox.event.store.error',
                    error: error instanceof Error ? error.message : String(error),
                    conversationId: event.conversation_id
                }, 'Failed to store sandbox event');
            }
        }
        catch (error) {
            logger_1.logger.error({
                event: 'sandbox.event.store.error',
                error: error instanceof Error ? error.message : String(error),
                conversationId: event.conversation_id
            }, 'Failed to store sandbox event');
        }
    }
    /**
     * Gets sandbox events for a conversation
     */
    async getSandboxEvents(conversationId, workspaceId) {
        try {
            const { data, error } = await supabase_1.supabase
                .from('sandbox_events')
                .select('*')
                .eq('conversation_id', conversationId)
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.logger.error({
                    event: 'sandbox.event.get.error',
                    error: error instanceof Error ? error.message : String(error),
                    conversationId
                }, 'Failed to get sandbox events');
                return [];
            }
            return data.map(row => ({
                event_type: row.event_type,
                conversation_id: row.conversation_id,
                workspace_id: row.workspace_id,
                sandbox_id: row.sandbox_id,
                sandbox_url: row.sandbox_url,
                message: row.message,
                timestamp: row.created_at,
                metadata: row.metadata
            }));
        }
        catch (error) {
            logger_1.logger.error({
                event: 'sandbox.event.get.error',
                error: error instanceof Error ? error.message : String(error),
                conversationId
            }, 'Failed to get sandbox events');
            return [];
        }
    }
}
exports.SandboxEventService = SandboxEventService;
//# sourceMappingURL=sandboxEventService.js.map