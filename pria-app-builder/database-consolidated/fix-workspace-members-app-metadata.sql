-- =============================================================================
-- Fix workspace_members table - Remove all app_metadata references
-- =============================================================================
-- The workspace_members table has RLS policies or triggers accessing app_metadata

-- First, let's check what's on the workspace_members table
-- and remove anything that references app_metadata

-- Drop ALL triggers on workspace_members table
DROP TRIGGER IF EXISTS workspace_member_metadata_trigger ON app_builder.workspace_members;
DROP TRIGGER IF EXISTS workspace_member_update_trigger ON app_builder.workspace_members;
DROP TRIGGER IF EXISTS update_workspace_member_metadata ON app_builder.workspace_members;
DROP TRIGGER IF EXISTS workspace_member_trigger ON app_builder.workspace_members;

-- Drop ALL RLS policies on workspace_members table (we'll recreate them properly)
DROP POLICY IF EXISTS "Users can view workspace members" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "Users can manage their workspace members" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "Workspace members can view other members" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "Service role has full access" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "workspace_members_select_policy" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON app_builder.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON app_builder.workspace_members;

-- Disable RLS temporarily to allow clean operation
ALTER TABLE app_builder.workspace_members DISABLE ROW LEVEL SECURITY;

-- Test insert (this should work now without RLS)
-- If this still fails, then there's a constraint or function we missed

-- Re-enable RLS and create new, clean policies
ALTER TABLE app_builder.workspace_members ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies that DON'T reference app_metadata
CREATE POLICY "workspace_members_service_role_all" 
  ON app_builder.workspace_members 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "workspace_members_authenticated_select" 
  ON app_builder.workspace_members 
  FOR SELECT 
  TO authenticated 
  USING (
    -- User can see members of workspaces they belong to
    workspace_id IN (
      SELECT workspace_id 
      FROM app_builder.workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_authenticated_insert" 
  ON app_builder.workspace_members 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- User can only be added to workspaces they own or are admin of
    workspace_id IN (
      SELECT w.id 
      FROM app_builder.workspaces w 
      WHERE w.owner_id = auth.uid()
    )
    OR
    workspace_id IN (
      SELECT workspace_id 
      FROM app_builder.workspace_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Grant necessary permissions
GRANT ALL ON app_builder.workspace_members TO service_role;
GRANT SELECT, INSERT ON app_builder.workspace_members TO authenticated;

-- Create a simple trigger that only updates timestamps (no app_metadata)
CREATE OR REPLACE FUNCTION simple_workspace_member_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER simple_workspace_member_update_trigger
  BEFORE UPDATE ON app_builder.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION simple_workspace_member_updated();

-- Test the fix by trying a simple insert (you can remove this after testing)
-- INSERT INTO app_builder.workspace_members (workspace_id, user_id, role) 
-- VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'test');
-- DELETE FROM app_builder.workspace_members WHERE role = 'test';