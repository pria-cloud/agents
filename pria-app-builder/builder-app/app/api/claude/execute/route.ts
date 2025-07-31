import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import E2BSandboxManager from '@/lib/e2b/sandbox-manager'
import { authenticateInternalCall, checkInternalRateLimit } from '@/lib/auth/internal-auth'
import { validateClaudeCommand, checkRateLimit } from '@/lib/validation/input-sanitizer'

// Global sandbox manager instance
let sandboxManager: E2BSandboxManager | null = null

function getSandboxManager(): E2BSandboxManager {
  if (!sandboxManager) {
    sandboxManager = new E2BSandboxManager({
      template: 'nodejs',
      apiKey: process.env.E2B_API_KEY!,
      timeoutMs: 1800000, // 30 minutes
    })
  }
  return sandboxManager
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, command, options = {} } = await request.json()
    
    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'Missing sessionId or command' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(`claude-execute:${clientIP}`, 60, 60000) // 60 requests per minute
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

    // Validate command
    const commandValidation = validateClaudeCommand(command)
    if (!commandValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid command',
          details: commandValidation.errors 
        },
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
      const internalRateLimit = checkInternalRateLimit(internalAuth.token.sub, 200, 60000) // 200 requests per minute for internal calls
      if (!internalRateLimit.allowed) {
        return NextResponse.json(
          { 
            error: 'Internal rate limit exceeded',
            resetTime: internalRateLimit.resetTime 
          },
          { status: 429 }
        )
      }

      // Get workspace ID from options for internal calls
      workspaceId = options?.workspaceId
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
      const { data: { user: userData }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !userData) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      
      user = userData
      workspaceId = user.app_metadata?.workspace_id
      if (!workspaceId) {
        return NextResponse.json(
          { error: 'Workspace access denied' },
          { status: 403 }
        )
      }
    }

    // Verify session access using service role
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: session, error: sessionError } = await serviceSupabase
      .from('sessions')
      .select('id, workspace_id, e2b_sandbox_id, target_directory')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify workspace access for non-internal calls
    if (!internalAuth.isInternal && session.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Session access denied' },
        { status: 403 }
      )
    }

    const manager = getSandboxManager()

    // Use sanitized command for all operations
    const sanitizedCommand = commandValidation.sanitized

    // Check if Claude Code SDK command
    if (sanitizedCommand.startsWith('claude ')) {
      // This is a Claude Code SDK command - execute in target app context
      const claudeCommand = sanitizedCommand.replace(/^claude\s+/, '')
      
      try {
        // Execute Claude Code SDK command in the target app directory
        const result = await manager.executeCommand(
          sessionId,
          `cd ${session.target_directory} && npx claude ${claudeCommand}`,
          {
            env: {
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
              NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
              NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              ...options.env
            }
          }
        )

        // Store operation in database
        await serviceSupabase
          .from('claude_operations')
          .insert({
            workspace_id: session.workspace_id,
            session_id: sessionId,
            operation_type: 'claude_command',
            status: result.exitCode === 0 ? 'completed' : 'failed',
            input_data: {
              command: claudeCommand,
              originalCommand: sanitizedCommand,
              options
            },
            output_data: {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              duration: result.duration
            },
            completed_at: new Date().toISOString()
          })

        return NextResponse.json({
          success: result.exitCode === 0,
          output: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            duration: result.duration
          },
          type: 'claude_command'
        })

      } catch (error) {
        console.error('Claude command execution failed:', error)
        
        // Store failed operation
        await serviceSupabase
          .from('claude_operations')
          .insert({
            workspace_id: session.workspace_id,
            session_id: sessionId,
            operation_type: 'claude_command',
            status: 'failed',
            input_data: {
              command: claudeCommand,
              originalCommand: sanitizedCommand,
              options
            },
            error_details: {
              message: error instanceof Error ? error.message : 'Unknown error'
            },
            completed_at: new Date().toISOString()
          })

        return NextResponse.json(
          { 
            error: 'Claude command execution failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    } else {
      // Regular command execution
      try {
        const result = await manager.executeCommand(sessionId, sanitizedCommand, {
          cwd: session.target_directory,
          ...options
        })

        return NextResponse.json({
          success: result.exitCode === 0,
          output: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            duration: result.duration
          },
          type: 'shell_command'
        })

      } catch (error) {
        console.error('Command execution failed:', error)
        return NextResponse.json(
          { 
            error: 'Command execution failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

  } catch (error) {
    console.error('Execute API error:', error)
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
      { error: 'Session ID required' },
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

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Get recent Claude operations for this session
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: operations, error } = await serviceSupabase
      .from('claude_operations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('started_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch operations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch operations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ operations })

  } catch (error) {
    console.error('Get operations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}