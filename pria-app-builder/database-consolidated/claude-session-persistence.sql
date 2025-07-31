-- Claude Code Session Persistence Enhancement
-- Date: 2025-07-30
-- Description: Add comprehensive conversation persistence and session management for Claude Code SDK integration

-- Set search path to use app_builder schema (consistent with main schema)
SET search_path = app_builder, public;

-- Add Claude Code session management columns to sessions table
ALTER TABLE sessions 
ADD COLUMN claude_session_id TEXT,
ADD COLUMN claude_session_status TEXT DEFAULT 'inactive' CHECK (
    claude_session_status IN ('inactive', 'active', 'restored_resume', 'restored_replay', 'failed')
),
ADD COLUMN claude_first_message_at TIMESTAMPTZ,
ADD COLUMN claude_last_interaction_at TIMESTAMPTZ,
ADD COLUMN claude_conversation_turns INTEGER DEFAULT 0,
ADD COLUMN claude_restoration_attempts INTEGER DEFAULT 0;

-- Add indexes for Claude session queries
CREATE INDEX idx_sessions_claude_session_id ON sessions(claude_session_id) WHERE claude_session_id IS NOT NULL;
CREATE INDEX idx_sessions_claude_status ON sessions(claude_session_status);
CREATE INDEX idx_sessions_claude_last_interaction ON sessions(claude_last_interaction_at) WHERE claude_last_interaction_at IS NOT NULL;

-- Add conversation persistence tracking table
CREATE TABLE claude_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    claude_session_id TEXT NOT NULL,
    
    -- Conversation metadata
    conversation_status TEXT NOT NULL DEFAULT 'active' CHECK (
        conversation_status IN ('active', 'suspended', 'restored', 'terminated')
    ),
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Restoration tracking
    restoration_method TEXT CHECK (
        restoration_method IN ('resume', 'replay', 'none')
    ),
    last_restoration_at TIMESTAMPTZ,
    restoration_success_count INTEGER DEFAULT 0,
    restoration_failure_count INTEGER DEFAULT 0,
    
    -- Working directory and sandbox info
    working_directory TEXT,
    e2b_sandbox_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    
    -- Metadata for extensibility
    metadata JSONB DEFAULT '{}'
);

-- Add indexes for claude_conversations
CREATE INDEX idx_claude_conversations_session_id ON claude_conversations(session_id);
CREATE INDEX idx_claude_conversations_claude_session_id ON claude_conversations(claude_session_id);
CREATE INDEX idx_claude_conversations_status ON claude_conversations(conversation_status);
CREATE INDEX idx_claude_conversations_last_activity ON claude_conversations(last_activity_at);

-- Add enhanced chat message metadata columns
ALTER TABLE chat_messages 
ADD COLUMN claude_session_id TEXT,
ADD COLUMN conversation_turn INTEGER,
ADD COLUMN restoration_context BOOLEAN DEFAULT false,
ADD COLUMN processing_duration_ms INTEGER;

-- Add indexes for enhanced chat message queries
CREATE INDEX idx_chat_messages_claude_session_id ON chat_messages(claude_session_id) WHERE claude_session_id IS NOT NULL;
CREATE INDEX idx_chat_messages_restoration_context ON chat_messages(restoration_context) WHERE restoration_context = true;

-- Create function to update session Claude metadata
CREATE OR REPLACE FUNCTION update_claude_session_metadata(
    p_session_id UUID,
    p_claude_session_id TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_restoration_method TEXT DEFAULT NULL,
    p_conversation_turns INTEGER DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE sessions 
    SET 
        claude_session_id = COALESCE(p_claude_session_id, claude_session_id),
        claude_session_status = COALESCE(p_status, claude_session_status),
        claude_last_interaction_at = now(),
        claude_conversation_turns = COALESCE(p_conversation_turns, claude_conversation_turns),
        claude_restoration_attempts = CASE 
            WHEN p_restoration_method IS NOT NULL THEN claude_restoration_attempts + 1
            ELSE claude_restoration_attempts
        END,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{claude_restoration}',
            jsonb_build_object(
                'method', COALESCE(p_restoration_method, metadata->'claude_restoration'->>'method'),
                'last_attempt', now(),
                'total_attempts', claude_restoration_attempts + CASE WHEN p_restoration_method IS NOT NULL THEN 1 ELSE 0 END
            )
        ),
        updated_at = now()
    WHERE id = p_session_id;
    
    -- Insert or update claude_conversations record
    INSERT INTO claude_conversations (
        session_id, 
        workspace_id, 
        claude_session_id,
        restoration_method,
        last_restoration_at,
        working_directory,
        metadata
    )
    SELECT 
        s.id,
        s.workspace_id,
        COALESCE(p_claude_session_id, s.claude_session_id),
        p_restoration_method,
        CASE WHEN p_restoration_method IS NOT NULL THEN now() ELSE NULL END,
        s.target_directory,
        jsonb_build_object('updated_by_function', true)
    FROM sessions s 
    WHERE s.id = p_session_id
    ON CONFLICT (session_id, claude_session_id) 
    DO UPDATE SET
        restoration_method = COALESCE(EXCLUDED.restoration_method, claude_conversations.restoration_method),
        last_restoration_at = COALESCE(EXCLUDED.last_restoration_at, claude_conversations.last_restoration_at),
        last_activity_at = now(),
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Create function to get conversation history for restoration
CREATE OR REPLACE FUNCTION get_conversation_history_for_restoration(
    p_session_id UUID,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.role,
        cm.content,
        cm.created_at,
        cm.metadata
    FROM chat_messages cm
    WHERE cm.session_id = p_session_id
      AND cm.restoration_context = false  -- Exclude restoration messages from history
    ORDER BY cm.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark conversation as restored
CREATE OR REPLACE FUNCTION mark_conversation_restored(
    p_session_id UUID,
    p_claude_session_id TEXT,
    p_method TEXT,
    p_success BOOLEAN DEFAULT true
) RETURNS void AS $$
BEGIN
    -- Update session metadata
    PERFORM update_claude_session_metadata(
        p_session_id,
        p_claude_session_id,
        CASE WHEN p_success THEN 'restored_' || p_method ELSE 'failed' END,
        p_method
    );
    
    -- Update claude_conversations
    UPDATE claude_conversations 
    SET 
        conversation_status = CASE WHEN p_success THEN 'restored' ELSE 'suspended' END,
        restoration_method = p_method,
        last_restoration_at = now(),
        restoration_success_count = CASE WHEN p_success THEN restoration_success_count + 1 ELSE restoration_success_count END,
        restoration_failure_count = CASE WHEN NOT p_success THEN restoration_failure_count + 1 ELSE restoration_failure_count END,
        last_activity_at = now(),
        updated_at = now()
    WHERE session_id = p_session_id 
      AND claude_session_id = p_claude_session_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security policies for new tables
ALTER TABLE claude_conversations ENABLE ROW LEVEL SECURITY;

-- Policy for claude_conversations - users can only access their workspace conversations
CREATE POLICY claude_conversations_workspace_access ON claude_conversations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Grant permissions to authenticated users
GRANT ALL ON claude_conversations TO authenticated;
-- Note: No sequence grant needed since we use gen_random_uuid() instead of SERIAL

-- Update existing sessions to set default claude_session_status
UPDATE sessions 
SET claude_session_status = 'inactive' 
WHERE claude_session_status IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN sessions.claude_session_id IS 'Claude Code generated conversation session ID for resuming conversations';
COMMENT ON COLUMN sessions.claude_session_status IS 'Status of Claude Code session: inactive, active, restored_resume, restored_replay, failed';
COMMENT ON COLUMN sessions.claude_first_message_at IS 'Timestamp of first message sent to Claude Code in this session';
COMMENT ON COLUMN sessions.claude_last_interaction_at IS 'Timestamp of most recent Claude Code interaction';
COMMENT ON COLUMN sessions.claude_conversation_turns IS 'Number of message exchanges with Claude Code';
COMMENT ON COLUMN sessions.claude_restoration_attempts IS 'Number of times conversation restoration was attempted';

COMMENT ON TABLE claude_conversations IS 'Tracks Claude Code conversation sessions for persistence and restoration';
COMMENT ON FUNCTION update_claude_session_metadata IS 'Updates Claude session metadata and conversation tracking';
COMMENT ON FUNCTION get_conversation_history_for_restoration IS 'Retrieves conversation history for context restoration';
COMMENT ON FUNCTION mark_conversation_restored IS 'Marks a conversation as successfully restored with specified method';