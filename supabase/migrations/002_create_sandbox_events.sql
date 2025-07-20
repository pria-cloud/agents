-- Create sandbox_events table for tracking sandbox-related events
-- This table stores historical events related to sandbox creation, updates, and failures

CREATE TABLE IF NOT EXISTS sandbox_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  conversation_id text NOT NULL,
  sandbox_id text,
  sandbox_url text,
  event_type text NOT NULL CHECK (event_type IN ('sandbox_created', 'sandbox_ready', 'sandbox_failed')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sandbox_events_workspace_id ON sandbox_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_conversation_id ON sandbox_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_sandbox_id ON sandbox_events(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_event_type ON sandbox_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_created_at ON sandbox_events(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE sandbox_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their workspace sandbox events"
  ON sandbox_events
  FOR SELECT
  USING (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create sandbox events for their workspace"
  ON sandbox_events
  FOR INSERT
  WITH CHECK (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ));

-- Create a function to get recent sandbox events for a conversation
CREATE OR REPLACE FUNCTION get_recent_sandbox_events(
  p_conversation_id text,
  p_workspace_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  event_type text,
  sandbox_id text,
  sandbox_url text,
  message text,
  created_at timestamptz,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.event_type,
    se.sandbox_id,
    se.sandbox_url,
    se.message,
    se.created_at,
    se.metadata
  FROM sandbox_events se
  WHERE se.conversation_id = p_conversation_id
    AND se.workspace_id = p_workspace_id
  ORDER BY se.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get sandbox status summary
CREATE OR REPLACE FUNCTION get_sandbox_status_summary(
  p_workspace_id uuid
)
RETURNS TABLE(
  total_sandboxes bigint,
  active_sandboxes bigint,
  failed_sandboxes bigint,
  created_today bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_sandboxes,
    COUNT(*) FILTER (WHERE si.status = 'ready') as active_sandboxes,
    COUNT(*) FILTER (WHERE si.status = 'failed') as failed_sandboxes,
    COUNT(*) FILTER (WHERE si.created_at >= current_date) as created_today
  FROM sandbox_instances si
  WHERE si.workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create an event when a sandbox instance is created
CREATE OR REPLACE FUNCTION create_sandbox_event_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sandbox_events (
    workspace_id,
    conversation_id,
    sandbox_id,
    sandbox_url,
    event_type,
    message,
    metadata,
    created_at
  ) VALUES (
    NEW.workspace_id,
    NEW.conversation_id,
    NEW.sandbox_id,
    NEW.sandbox_url,
    CASE 
      WHEN NEW.status = 'ready' THEN 'sandbox_ready'
      WHEN NEW.status = 'failed' THEN 'sandbox_failed'
      ELSE 'sandbox_created'
    END,
    CASE 
      WHEN NEW.status = 'ready' THEN 'Sandbox is ready: ' || NEW.sandbox_url
      WHEN NEW.status = 'failed' THEN 'Sandbox creation failed'
      ELSE 'Sandbox creation started'
    END,
    jsonb_build_object(
      'template_id', NEW.template_id,
      'status', NEW.status
    ),
    NEW.created_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sandbox_instance_event_trigger
  AFTER INSERT ON sandbox_instances
  FOR EACH ROW
  EXECUTE FUNCTION create_sandbox_event_on_insert();

-- Create a trigger to create an event when sandbox status changes
CREATE OR REPLACE FUNCTION create_sandbox_event_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create event if status actually changed
  IF OLD.status != NEW.status THEN
    INSERT INTO sandbox_events (
      workspace_id,
      conversation_id,
      sandbox_id,
      sandbox_url,
      event_type,
      message,
      metadata,
      created_at
    ) VALUES (
      NEW.workspace_id,
      NEW.conversation_id,
      NEW.sandbox_id,
      NEW.sandbox_url,
      CASE 
        WHEN NEW.status = 'ready' THEN 'sandbox_ready'
        WHEN NEW.status = 'failed' THEN 'sandbox_failed'
        ELSE 'sandbox_created'
      END,
      CASE 
        WHEN NEW.status = 'ready' THEN 'Sandbox is ready: ' || NEW.sandbox_url
        WHEN NEW.status = 'failed' THEN 'Sandbox creation failed'
        WHEN NEW.status = 'terminated' THEN 'Sandbox terminated'
        ELSE 'Sandbox status changed to ' || NEW.status
      END,
      jsonb_build_object(
        'template_id', NEW.template_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sandbox_instance_update_event_trigger
  AFTER UPDATE ON sandbox_instances
  FOR EACH ROW
  EXECUTE FUNCTION create_sandbox_event_on_update();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON sandbox_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_sandbox_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_sandbox_status_summary TO authenticated;