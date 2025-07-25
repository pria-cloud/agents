import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { e2bSandboxService } from '@/lib/services/e2b'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { operation, session_id } = body
    
    if (!session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }
    
    // Verify session belongs to user's workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    switch (operation) {
      case 'create':
        return await handleCreateSandbox(request, session_id, session, supabase)
      
      case 'status':
        return await handleGetStatus(session_id)
      
      case 'stop':
        return await handleStopSandbox(session_id, session, supabase)
      
      case 'deploy_files':
        return await handleDeployFiles(request, session_id, workspaceId, supabase)
      
      case 'start_dev_server':
        return await handleStartDevServer(request, session_id)
      
      case 'get_file_tree':
        return await handleGetFileTree(request, session_id)
      
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('E2B sandbox error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

async function handleCreateSandbox(
  request: NextRequest,
  sessionId: string,
  session: any,
  supabase: any
) {
  try {
    const body = await request.json()
    const { template, environment } = body
    
    // Create sandbox
    const sandboxSession = await e2bSandboxService.createSandbox(sessionId, {
      template,
      environment,
      timeoutMs: 300000 // 5 minutes
    })
    
    if (sandboxSession.status === 'error') {
      return NextResponse.json({ 
        error: 'Failed to create sandbox',
        details: 'E2B sandbox creation failed'
      }, { status: 500 })
    }
    
    // Update session with sandbox info
    await supabase
      .from('sessions')
      .update({
        e2b_sandbox_id: sandboxSession.id,
        e2b_sandbox_url: sandboxSession.url,
        e2b_sandbox_status: sandboxSession.status
      })
      .eq('id', sessionId)
    
    // Log the operation
    await supabase
      .from('claude_operations')
      .insert({
        session_id: sessionId,
        workspace_id: session.workspace_id,
        operation_type: 'create_e2b_sandbox',
        input_data: { template, environment },
        output_data: sandboxSession,
        status: 'completed'
      })
    
    return NextResponse.json({
      success: true,
      sandbox: sandboxSession
    })
    
  } catch (error) {
    console.error('Create sandbox error:', error)
    return NextResponse.json({ 
      error: 'Failed to create sandbox',
      details: error.message 
    }, { status: 500 })
  }
}

async function handleGetStatus(sessionId: string) {
  try {
    const status = await e2bSandboxService.getSandboxStatus(sessionId)
    return NextResponse.json({ status })
  } catch (error) {
    console.error('Get sandbox status error:', error)
    return NextResponse.json({ error: 'Failed to get sandbox status' }, { status: 500 })
  }
}

async function handleStopSandbox(sessionId: string, session: any, supabase: any) {
  try {
    await e2bSandboxService.stopSandbox(sessionId)
    
    // Update session status
    await supabase
      .from('sessions')
      .update({
        e2b_sandbox_status: 'stopped'
      })
      .eq('id', sessionId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stop sandbox error:', error)
    return NextResponse.json({ error: 'Failed to stop sandbox' }, { status: 500 })
  }
}

async function handleDeployFiles(
  request: NextRequest,
  sessionId: string,
  workspaceId: string,
  supabase: any
) {
  try {
    const body = await request.json()
    const { target_directory } = body
    
    // Get generated files for the session
    const { data: files, error } = await supabase
      .from('generated_files')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }
    
    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No files to deploy',
        deployed: 0,
        errors: []
      })
    }
    
    // Deploy files to sandbox
    const result = await e2bSandboxService.deployFiles(
      sessionId,
      files,
      target_directory
    )
    
    // Log the deployment
    await supabase
      .from('claude_operations')
      .insert({
        session_id: sessionId,
        workspace_id: workspaceId,
        operation_type: 'deploy_files_to_e2b',
        input_data: {
          files_count: files.length,
          target_directory
        },
        output_data: result,
        status: result.success ? 'completed' : 'failed'
      })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Deploy files error:', error)
    return NextResponse.json({ error: 'Failed to deploy files' }, { status: 500 })
  }
}

async function handleStartDevServer(request: NextRequest, sessionId: string) {
  try {
    const body = await request.json()
    const { command, port, working_dir } = body
    
    const result = await e2bSandboxService.startDevServer(sessionId, {
      command,
      port,
      workingDir: working_dir
    })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Start dev server error:', error)
    return NextResponse.json({ error: 'Failed to start development server' }, { status: 500 })
  }
}

async function handleGetFileTree(request: NextRequest, sessionId: string) {
  try {
    const body = await request.json()
    const { root_path } = body
    
    const fileTree = await e2bSandboxService.getFileTree(sessionId, root_path)
    
    return NextResponse.json({ files: fileTree })
    
  } catch (error) {
    console.error('Get file tree error:', error)
    return NextResponse.json({ error: 'Failed to get file tree' }, { status: 500 })
  }
}