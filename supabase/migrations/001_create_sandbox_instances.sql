-- Create sandbox_instances table for tracking E2B sandbox instances
-- This table stores information about E2B sandboxes created for code generation sessions

CREATE TABLE IF NOT EXISTS sandbox_instances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  conversation_id text NOT NULL,
  sandbox_id text NOT NULL UNIQUE,
  sandbox_url text NOT NULL,
  template_id text NOT NULL,
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'ready', 'failed', 'terminated')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  terminated_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_workspace_id ON sandbox_instances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_conversation_id ON sandbox_instances(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_sandbox_id ON sandbox_instances(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_status ON sandbox_instances(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_instances_created_at ON sandbox_instances(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sandbox_instances_updated_at
  BEFORE UPDATE ON sandbox_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE sandbox_instances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their workspace sandbox instances"
  ON sandbox_instances
  FOR SELECT
  USING (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create sandbox instances for their workspace"
  ON sandbox_instances
  FOR INSERT
  WITH CHECK (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their workspace sandbox instances"
  ON sandbox_instances
  FOR UPDATE
  USING (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ))
  WITH CHECK (workspace_id = auth.uid()::uuid OR workspace_id IN (
    SELECT workspace_id FROM user_workspaces WHERE user_id = auth.uid()
  ));

-- Create a function to get the latest sandbox for a conversation
CREATE OR REPLACE FUNCTION get_latest_sandbox_for_conversation(
  p_conversation_id text,
  p_workspace_id uuid
)
RETURNS TABLE(
  sandbox_id text,
  sandbox_url text,
  status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.sandbox_id,
    si.sandbox_url,
    si.status,
    si.created_at
  FROM sandbox_instances si
  WHERE si.conversation_id = p_conversation_id
    AND si.workspace_id = p_workspace_id
  ORDER BY si.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to terminate old sandboxes
CREATE OR REPLACE FUNCTION terminate_old_sandboxes(
  p_workspace_id uuid,
  p_max_age_hours integer DEFAULT 24
)
RETURNS integer AS $$
DECLARE
  terminated_count integer;
BEGIN
  UPDATE sandbox_instances
  SET 
    status = 'terminated',
    terminated_at = now(),
    updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND status IN ('creating', 'ready')
    AND created_at < now() - (p_max_age_hours || ' hours')::interval;
  
  GET DIAGNOSTICS terminated_count = ROW_COUNT;
  RETURN terminated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON sandbox_instances TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_sandbox_for_conversation TO authenticated;
GRANT EXECUTE ON FUNCTION terminate_old_sandboxes TO authenticated;