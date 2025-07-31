-- =============================================================================
-- Fix Database Functions that Reference Non-Existent app_metadata Column
-- =============================================================================
-- These functions were trying to access auth.users.app_metadata which doesn't exist
-- We'll replace them with functions that use the workspace_members table instead

-- Drop the problematic functions first
DROP FUNCTION IF EXISTS get_user_workspace_id();
DROP FUNCTION IF EXISTS update_user_workspace_metadata();

-- Create new function that gets workspace_id from workspace_members table
CREATE OR REPLACE FUNCTION get_user_workspace_id() 
RETURNS UUID AS $$
DECLARE
    current_user_id UUID;
    user_workspace_id UUID;
BEGIN
    -- Get current user ID from auth context
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get workspace_id from workspace_members table (user's primary workspace)
    SELECT workspace_id INTO user_workspace_id
    FROM app_builder.workspace_members 
    WHERE user_id = current_user_id 
    ORDER BY created_at ASC -- Get the first (primary) workspace
    LIMIT 1;
    
    RETURN user_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that validates workspace access (replacement for app_metadata approach)
CREATE OR REPLACE FUNCTION validate_user_workspace_access(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    has_access BOOLEAN := FALSE;
BEGIN
    -- Get current user ID from auth context
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL OR target_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is a member of the target workspace
    SELECT EXISTS(
        SELECT 1 FROM app_builder.workspace_members 
        WHERE user_id = current_user_id 
        AND workspace_id = target_workspace_id
    ) INTO has_access;
    
    RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove any triggers that call the old update_user_workspace_metadata function
DROP TRIGGER IF EXISTS workspace_member_metadata_trigger ON app_builder.workspace_members;

-- Create a simple trigger that just ensures data consistency (no app_metadata updates)
CREATE OR REPLACE FUNCTION workspace_member_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Just update the updated_at timestamp, no app_metadata manipulation
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the replacement trigger
CREATE TRIGGER workspace_member_update_trigger
    BEFORE UPDATE ON app_builder.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION workspace_member_updated();

-- Update any RLS policies that might be using the old get_user_workspace_id() function
-- (This ensures they work with the new implementation)

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_workspace_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_workspace_id() TO service_role;
GRANT EXECUTE ON FUNCTION validate_user_workspace_access(UUID) TO service_role;