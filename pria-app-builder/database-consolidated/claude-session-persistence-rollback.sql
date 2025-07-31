-- Rollback: Claude Code Session Persistence Enhancement
-- Date: 2025-07-30
-- Description: Rollback Claude Code session management and conversation persistence changes

-- Set search path to use app_builder schema (consistent with main schema)
SET search_path = app_builder, public;

-- Drop functions
DROP FUNCTION IF EXISTS mark_conversation_restored(UUID, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_conversation_history_for_restoration(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_claude_session_metadata(UUID, TEXT, TEXT, TEXT, INTEGER);

-- Drop new columns from chat_messages
ALTER TABLE chat_messages 
DROP COLUMN IF EXISTS claude_session_id,
DROP COLUMN IF EXISTS conversation_turn,
DROP COLUMN IF EXISTS restoration_context,
DROP COLUMN IF EXISTS processing_duration_ms;

-- Drop indexes from chat_messages
DROP INDEX IF EXISTS idx_chat_messages_claude_session_id;
DROP INDEX IF EXISTS idx_chat_messages_restoration_context;

-- Drop claude_conversations table
DROP TABLE IF EXISTS claude_conversations;

-- Drop indexes from sessions table
DROP INDEX IF EXISTS idx_sessions_claude_session_id;
DROP INDEX IF EXISTS idx_sessions_claude_status;
DROP INDEX IF EXISTS idx_sessions_claude_last_interaction;

-- Drop Claude Code session management columns from sessions table
ALTER TABLE sessions 
DROP COLUMN IF EXISTS claude_session_id,
DROP COLUMN IF EXISTS claude_session_status,
DROP COLUMN IF EXISTS claude_first_message_at,
DROP COLUMN IF EXISTS claude_last_interaction_at,
DROP COLUMN IF EXISTS claude_conversation_turns,
DROP COLUMN IF EXISTS claude_restoration_attempts;