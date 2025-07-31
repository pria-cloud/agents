/**
 * Workspace authentication and authorization utilities
 * Handles workspace access validation and user workspace resolution
 */
import { createServiceClient } from '@/lib/supabase/service'

export interface WorkspaceAuthResult {
  workspaceId: string | null
  role: string | null
  error: string | null
}

/**
 * Get the user's current workspace ID based on their membership
 * For now, returns the first workspace the user is a member of
 * TODO: Implement proper workspace selection/switching
 */
export async function getUserWorkspaceId(userId: string): Promise<WorkspaceAuthResult> {
  try {
    const serviceSupabase = createServiceClient()
    
    // Get the first workspace where user is a member
    // TODO: In the future, we should support multiple workspaces and user selection
    const { data: membership, error } = await serviceSupabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }) // Get the first/oldest membership
      .limit(1)
      .single()
    
    if (error) {
      console.error('Failed to get user workspace:', error)
      return {
        workspaceId: null,
        role: null,
        error: `Failed to resolve workspace access: ${error.message}`
      }
    }
    
    if (!membership) {
      return {
        workspaceId: null,
        role: null,
        error: 'User is not a member of any workspace'
      }
    }
    
    return {
      workspaceId: membership.workspace_id,
      role: membership.role,
      error: null
    }
    
  } catch (error) {
    console.error('Workspace auth error:', error)
    return {
      workspaceId: null,
      role: null,
      error: error instanceof Error ? error.message : 'Unknown workspace auth error'
    }
  }
}

/**
 * Verify that a user has access to a specific workspace
 */
export async function verifyWorkspaceAccess(
  userId: string, 
  workspaceId: string
): Promise<{ hasAccess: boolean; role: string | null; error: string | null }> {
  try {
    const serviceSupabase = createServiceClient()
    
    const { data: membership, error } = await serviceSupabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (error) {
      return {
        hasAccess: false,
        role: null,
        error: `Failed to verify workspace access: ${error.message}`
      }
    }
    
    return {
      hasAccess: !!membership,
      role: membership?.role || null,
      error: null
    }
    
  } catch (error) {
    return {
      hasAccess: false,
      role: null,
      error: error instanceof Error ? error.message : 'Unknown access verification error'
    }
  }
}