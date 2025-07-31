import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { E2BSandboxManager } from '@/lib/e2b/sandbox-manager'
import { validateClaudeCommand, validateFilePath, checkRateLimit } from '@/lib/validation/input-sanitizer'
import { authenticateInternalCall, checkInternalRateLimit } from '@/lib/auth/internal-auth'
import { validateUserWorkspaceAccess } from '@/lib/auth/workspace-helper'
import { getE2BSandboxConfig } from '@/lib/e2b/template-config'

function getSandboxManager(): E2BSandboxManager {
  return E2BSandboxManager.getInstance(getE2BSandboxConfig({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
  }))
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, action, data } = await request.json()
    
    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Missing sessionId or action' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(`e2b:${clientIP}`, 30, 60000) // 30 operations per minute
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitCheck.resetTime 
        },
        { status: 429 }
      )
    }

    // Validate session ID format (should be UUID)
    if (typeof sessionId !== 'string' || !sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      )
    }

    // Validate action
    const allowedActions = ['create', 'execute', 'write_file', 'read_file', 'list_files', 'get_state', 'terminate']
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    // Check if this is an internal server call or user request
    const internalAuth = authenticateInternalCall(request)
    let user: any = null
    let workspaceId: string | null = null

    if (internalAuth.isInternal) {
      // Internal call - validate token and get workspace ID
      if (internalAuth.error || !internalAuth.token) {
        return NextResponse.json(
          { error: `Internal authentication failed: ${internalAuth.error}` },
          { status: 401 }
        )
      }

      // Check internal rate limiting
      const internalRateLimit = checkInternalRateLimit(internalAuth.token.sub, 500, 60000) // 500 requests per minute for internal calls
      if (!internalRateLimit.allowed) {
        return NextResponse.json(
          { 
            error: 'Internal rate limit exceeded',
            resetTime: internalRateLimit.resetTime 
          },
          { status: 429 }
        )
      }

      // Get workspace ID from data for internal calls
      workspaceId = data?.workspaceId
      if (!workspaceId) {
        return NextResponse.json(
          { error: 'Workspace ID required for internal calls' },
          { status: 400 }
        )
      }

      // Validate workspace ID format
      if (!workspaceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return NextResponse.json(
          { error: 'Invalid workspace ID format' },
          { status: 400 }
        )
      }
    } else {
      // Regular user call - authenticate normally
      const supabase = await createServerClient()
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      if (authError || !userData.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      
      user = userData.user
      // We'll get the workspace_id from the session below
    }

    // Verify session belongs to user's workspace
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: session, error: sessionError } = await serviceSupabase
      .from('sessions')
      .select('id, e2b_sandbox_id, metadata, workspace_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // For regular user calls, get workspace_id from session
    if (!internalAuth.isInternal) {
      workspaceId = session.workspace_id
      
      // Verify user has access to this workspace using helper
      const hasAccess = await validateUserWorkspaceAccess(user.id, workspaceId)
      
      console.log('E2B Sandbox - Workspace access check:', { 
        hasAccess, 
        workspaceId, 
        userId: user.id, 
        sessionId 
      })
      
      if (!hasAccess) {
        console.error('E2B Sandbox - Workspace access denied:', {
          workspaceId,
          userId: user.id,
          sessionId
        })
        return NextResponse.json(
          { 
            error: 'Session access denied', 
            details: 'User is not a member of the workspace for this session',
            debug: { workspaceId, userId: user.id }
          },
          { status: 403 }
        )
      }
    }

    const manager = getSandboxManager()
    let result

    switch (action) {
      case 'create':
        try {
          const environment = await manager.createSandbox(sessionId, {
            workspaceId,
            userId: user?.id || 'internal-system',
            isInternalCall: internalAuth.isInternal,
            ...data
          })
          
          // Update session with sandbox ID
          await serviceSupabase
            .from('sessions')
            .update({
              e2b_sandbox_id: environment.metadata.sandboxId,
              metadata: {
                ...session.metadata,
                e2b_environment: {
                  id: environment.id,
                  status: environment.status,
                  createdAt: environment.createdAt,
                  workingDirectory: environment.workingDirectory
                }
              }
            })
            .eq('id', sessionId)

          result = {
            environment: {
              id: environment.id,
              status: environment.status,
              workingDirectory: environment.workingDirectory,
              createdAt: environment.createdAt
            }
          }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to create sandbox environment' },
            { status: 500 }
          )
        }
        break

      case 'execute':
        if (!data?.command) {
          return NextResponse.json(
            { error: 'Missing command in data' },
            { status: 400 }
          )
        }

        // Validate command for security
        const commandValidation = validateClaudeCommand(data.command)
        if (!commandValidation.isValid) {
          return NextResponse.json(
            { 
              error: 'Invalid command',
              details: commandValidation.errors 
            },
            { status: 400 }
          )
        }
        
        try {
          result = await manager.executeCommand(sessionId, commandValidation.sanitized, data.options)
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to execute command' },
            { status: 500 }
          )
        }
        break

      case 'write_file':
        if (!data?.filePath || data?.content === undefined) {
          return NextResponse.json(
            { error: 'Missing filePath or content in data' },
            { status: 400 }
          )
        }

        // Validate file path for security
        const writePathValidation = validateFilePath(data.filePath)
        if (!writePathValidation.isValid) {
          return NextResponse.json(
            { 
              error: 'Invalid file path',
              details: writePathValidation.errors 
            },
            { status: 400 }
          )
        }

        // Validate content length (max 1MB for safety)
        if (typeof data.content === 'string' && data.content.length > 1024 * 1024) {
          return NextResponse.json(
            { error: 'File content too large (max 1MB)' },
            { status: 400 }
          )
        }
        
        try {
          await manager.writeFile(sessionId, writePathValidation.sanitized, data.content)
          result = { success: true, message: 'File written successfully' }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to write file' },
            { status: 500 }
          )
        }
        break

      case 'read_file':
        if (!data?.filePath) {
          return NextResponse.json(
            { error: 'Missing filePath in data' },
            { status: 400 }
          )
        }

        // Validate file path for security
        const readPathValidation = validateFilePath(data.filePath)
        if (!readPathValidation.isValid) {
          return NextResponse.json(
            { 
              error: 'Invalid file path',
              details: readPathValidation.errors 
            },
            { status: 400 }
          )
        }
        
        try {
          const content = await manager.readFile(sessionId, readPathValidation.sanitized)
          result = { content }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to read file' },
            { status: 500 }
          )
        }
        break

      case 'list_files':
        try {
          const files = await manager.listFiles(sessionId, data?.directory)
          result = { files }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to list files' },
            { status: 500 }
          )
        }
        break

      case 'get_state':
        try {
          const projectState = await manager.getProjectState(sessionId)
          result = { projectState }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to get project state' },
            { status: 500 }
          )
        }
        break

      case 'terminate':
        try {
          await manager.terminateSandbox(sessionId)
          
          // Update session to remove sandbox ID
          await serviceSupabase
            .from('sessions')
            .update({
              e2b_sandbox_id: null,
              metadata: {
                ...session.metadata,
                e2b_environment: null
              }
            })
            .eq('id', sessionId)

          result = { success: true, message: 'Sandbox terminated' }
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to terminate sandbox' },
            { status: 500 }
          )
        }
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('E2B sandbox error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter' },
      { status: 400 }
    )
  }

  // Validate session ID format (should be UUID)
  if (!sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return NextResponse.json(
      { error: 'Invalid session ID format' },
      { status: 400 }
    )
  }

  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // First get the session to find its workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, e2b_sandbox_id, metadata, workspace_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this workspace
    const { data: memberCheck } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', session.workspace_id)
      .eq('user_id', user.id)
      .single()
    
    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Session access denied' },
        { status: 403 }
      )
    }

    const manager = getSandboxManager()
    const environment = await manager.getSandbox(sessionId)

    if (!environment) {
      return NextResponse.json({
        exists: false,
        sandboxId: session.e2b_sandbox_id,
        status: 'not_created'
      })
    }

    return NextResponse.json({
      exists: true,
      environment: {
        id: environment.id,
        status: environment.status,
        workingDirectory: environment.workingDirectory,
        createdAt: environment.createdAt,
        lastActivity: environment.lastActivity,
        metadata: environment.metadata
      }
    })

  } catch (error) {
    console.error('E2B sandbox query error:', error)
    return NextResponse.json(
      { error: 'Failed to query sandbox status' },
      { status: 500 }
    )
  }
}