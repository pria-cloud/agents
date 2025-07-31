/**
 * Workspace access helper functions
 * Handles workspace ID resolution and access validation
 */
import { createServiceClient } from '@/lib/supabase/service'

export interface UserWorkspaceInfo {
  workspaceId: string
  role: string
  permissions: any
}

/**
 * Gets the user's primary workspace ID and role from workspace_members table
 * This replaces the non-existent user.app_metadata.workspace_id approach
 */
export async function getUserWorkspaceInfo(userId: string): Promise<UserWorkspaceInfo | null> {
  try {
    const serviceSupabase = createServiceClient()
    
    const { data: membership, error } = await serviceSupabase
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        permissions,
        workspaces:workspace_id (
          id,
          name,
          owner_id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }) // Get the first (primary) workspace
      .limit(1)
      .single()

    if (error || !membership) {
      console.error('Failed to get user workspace info:', error)
      return null
    }

    return {
      workspaceId: membership.workspace_id,
      role: membership.role,
      permissions: membership.permissions || {}
    }
  } catch (error) {
    console.error('Error getting user workspace info:', error)
    return null
  }
}

/**
 * Validates that a user has access to a specific workspace
 */
export async function validateUserWorkspaceAccess(
  userId: string, 
  requiredWorkspaceId: string
): Promise<boolean> {
  try {
    const serviceSupabase = createServiceClient()
    
    const { data: membership, error } = await serviceSupabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', userId)
      .eq('workspace_id', requiredWorkspaceId)
      .single()

    return !error && !!membership
  } catch (error) {
    console.error('Error validating workspace access:', error)
    return false
  }
}

/**
 * Gets workspace ID from a session ID
 * This is commonly needed in API routes that receive sessionId
 */
export async function getWorkspaceIdFromSession(sessionId: string): Promise<string | null> {
  try {
    const serviceSupabase = createServiceClient()
    
    const { data: session, error } = await serviceSupabase
      .from('sessions')
      .select('workspace_id')
      .eq('id', sessionId)
      .single()

    if (error || !session) {
      console.error('Failed to get workspace from session:', error)
      return null
    }

    return session.workspace_id
  } catch (error) {
    console.error('Error getting workspace from session:', error)
    return null
  }
}

/**
 * Gets all workspaces a user has access to
 */
export async function getUserWorkspaces(userId: string) {
  try {
    const serviceSupabase = createServiceClient()
    
    const { data: workspaces, error } = await serviceSupabase
      .from('workspaces')
      .select(`
        id,
        name,
        owner_id,
        settings,
        created_at,
        updated_at,
        workspace_members!inner(
          id,
          role,
          permissions
        )
      `)
      .eq('workspace_members.user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to get user workspaces:', error)
      return []
    }

    return workspaces || []
  } catch (error) {
    console.error('Error getting user workspaces:', error)
    return []
  }
}