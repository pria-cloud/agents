/**
 * Session-based authentication helper
 * Handles the common pattern of authenticating users and validating session access
 */
import createServerClient from '@/lib/supabase/server'
import { getWorkspaceIdFromSession, validateUserWorkspaceAccess, getUserWorkspaceInfo } from './workspace-helper'
import { NextRequest } from 'next/server'

export interface SessionAuthResult {
  success: boolean
  user?: any
  workspaceId?: string
  error?: {
    message: string
    status: number
  }
}

/**
 * Authenticates user and validates they have access to the given session
 * This replaces the common pattern of:
 * 1. Authenticate user
 * 2. Get workspace_id from user.app_metadata (doesn't work)
 * 3. Validate access
 */
export async function authenticateSessionAccess(
  request: NextRequest,
  sessionId: string
): Promise<SessionAuthResult> {
  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: {
          message: 'Authentication required',
          status: 401
        }
      }
    }

    // Get workspace ID from session
    const workspaceId = await getWorkspaceIdFromSession(sessionId)
    if (!workspaceId) {
      return {
        success: false,
        error: {
          message: 'Session not found',
          status: 404
        }
      }
    }

    // Validate user has access to this workspace
    const hasAccess = await validateUserWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      return {
        success: false,
        error: {
          message: 'Session access denied - user is not a member of the workspace',
          status: 403
        }
      }
    }

    return {
      success: true,
      user,
      workspaceId
    }
  } catch (error) {
    console.error('Session authentication error:', error)
    return {
      success: false,
      error: {
        message: 'Internal authentication error',
        status: 500
      }
    }
  }
}

/**
 * Authenticates user and gets their primary workspace info
 * Use this for routes that don't have a specific session but need workspace access
 */
export async function authenticateWorkspaceAccess(
  request: NextRequest
): Promise<SessionAuthResult> {
  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: {
          message: 'Authentication required',
          status: 401
        }
      }
    }

    // Get user's primary workspace
    const workspaceInfo = await getUserWorkspaceInfo(user.id)
    if (!workspaceInfo) {
      return {
        success: false,
        error: {
          message: 'No workspace access - user is not a member of any workspace',
          status: 403
        }
      }
    }

    return {
      success: true,
      user,
      workspaceId: workspaceInfo.workspaceId
    }
  } catch (error) {
    console.error('Workspace authentication error:', error)
    return {
      success: false,
      error: {
        message: 'Internal authentication error',
        status: 500
      }
    }
  }
}