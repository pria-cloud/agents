import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { authenticateWorkspaceAccess } from '@/lib/auth/session-auth'

export async function GET(request: NextRequest) {
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

    // Check if this is a request for all projects (for selector) or just active projects with sessions
    const url = new URL(request.url)
    const includeEmpty = url.searchParams.get('includeEmpty') === 'true'
    
    let projects
    if (includeEmpty) {
      // Get all projects for workspace selector
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      projects = data || []
    } else {
      // Get projects with session counts (original behavior)
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          sessions!inner(
            id,
            name,
            status,
            updated_at
          )
        `)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
      
      if (error) throw error
      projects = data || []
    }

    // Transform data to include session counts
    const projectsWithCounts = includeEmpty 
      ? projects // For selector, return projects as-is
      : projects.map(project => ({
          ...project,
          session_count: project.sessions?.length || 0,
          active_sessions: project.sessions?.filter((s: any) => s.status === 'active').length || 0,
          latest_session: project.sessions?.[0] || null,
          sessions: undefined // Remove sessions array from response
        }))

    return NextResponse.json({ projects: projectsWithCounts })

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
    const { workspaceId, name, description } = await request.json()
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
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

    // Create project using service role
    const { data: project, error } = await serviceSupabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'active',
        settings: {
          created_by: user.id,
          auto_deploy: false,
          framework: 'nextjs'
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create project:', error)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      project: {
        ...project,
        session_count: 0,
        active_sessions: 0,
        latest_session: null
      },
      message: 'Project created successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}