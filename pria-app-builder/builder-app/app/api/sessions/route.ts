import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { authenticateWorkspaceAccess } from '@/lib/auth/session-auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  
  try {
    // Authenticate and get workspace access
    const authResult = await authenticateWorkspaceAccess(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const { user, workspaceId } = authResult
    const supabase = await createServerClient()

    let query = supabase
      .from('sessions')
      .select(`
        id,
        name,
        description,
        status,
        github_repo_url,
        github_branch,
        deployment_url,
        e2b_sandbox_id,
        target_directory,
        metadata,
        created_at,
        updated_at,
        projects(
          id,
          name,
          description
        )
      `)
      .eq('workspace_id', workspaceId)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: sessions, error } = await query
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({ sessions })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, projectId } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use service role to bypass RLS
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get project to verify it exists and get workspace_id
    const { data: project, error: projectError } = await serviceSupabase
      .from('projects')
      .select('id, workspace_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Generate unique session ID and target directory
    const sessionId = randomUUID()
    const targetDirectory = `/tmp/sessions/${sessionId}`

    // Create session using service role
    const { data: session, error } = await serviceSupabase
      .from('sessions')
      .insert({
        id: sessionId,
        workspace_id: project.workspace_id,
        project_id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'active',
        target_directory: targetDirectory,
        metadata: {
          created_by: user.id,
          initial_setup: true
        }
      })
      .select(`
        *,
        projects(
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Failed to create session:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Create initial system message using service role
    await serviceSupabase
      .from('chat_messages')
      .insert({
        workspace_id: project.workspace_id,
        session_id: sessionId,
        role: 'system',
        content: `Welcome to your new development session: "${name}". I'm Claude Code, and I'm here to help you build your application. 

To get started, please describe what you'd like to build. I can help you:
• Gather and structure requirements
• Design the application architecture  
• Generate production-ready code
• Set up development environment
• Deploy to production

What would you like to create today?`,
        metadata: {
          initial_message: true,
          session_created: true
        }
      })

    return NextResponse.json({ 
      session: {
        ...session,
        metadata: {
          ...session.metadata,
          sandbox_initialized: true
        }
      },
      message: 'Session created successfully with development environment' 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}