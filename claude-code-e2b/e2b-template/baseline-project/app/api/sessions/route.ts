import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import type { SessionInsert } from '@/lib/supabase/types'

// GET /api/sessions - List sessions for current workspace
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get workspace ID from query params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Fetch sessions with workspace isolation enforced by RLS
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sessions - Create new session
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, name, description, githubRepoUrl, githubBranch } = body

    // Validate required fields
    if (!workspaceId || !name) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspaceId, name' 
      }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    }

    // Create session
    const sessionData: SessionInsert = {
      workspace_id: workspaceId,
      name,
      description: description || null,
      github_repo_url: githubRepoUrl || null,
      github_branch: githubBranch || 'main'
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Log this event in session history
    await supabase
      .from('session_history')
      .insert({
        session_id: session.id,
        workspace_id: workspaceId,
        event_type: 'session',
        event_title: 'Session Created',
        event_description: `Created new development session: ${name}`,
        event_data: { session_id: session.id, name },
        changes_summary: { added: 1, modified: 0, deleted: 0 },
        performed_by: 'User'
      })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}