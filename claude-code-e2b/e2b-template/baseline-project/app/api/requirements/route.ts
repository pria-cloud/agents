import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import type { RequirementInsert, RequirementUpdate } from '@/lib/supabase/types'

// GET /api/requirements - List requirements for current session
export async function GET(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get session ID from query params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Fetch requirements with workspace isolation enforced by RLS
    const { data: requirements, error } = await supabase
      .from('requirements')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 })
    }

    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/requirements - Create new requirement
export async function POST(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, workspaceId, title, description, priority, category, acceptanceCriteria } = body

    // Validate required fields
    if (!sessionId || !workspaceId || !title || !description) {
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, workspaceId, title, description' 
      }, { status: 400 })
    }

    // Verify user has access to this workspace (additional check beyond RLS)
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    }

    // Create requirement
    const requirementData: RequirementInsert = {
      session_id: sessionId,
      workspace_id: workspaceId,
      title,
      description,
      priority: priority || 'medium',
      category: category || null,
      acceptance_criteria: acceptanceCriteria || []
    }

    const { data: requirement, error } = await supabase
      .from('requirements')
      .insert(requirementData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 })
    }

    // Log this event in session history
    await supabase
      .from('session_history')
      .insert({
        session_id: sessionId,
        workspace_id: workspaceId,
        event_type: 'requirement',
        event_title: 'Requirement Created',
        event_description: `Created requirement: ${title}`,
        event_data: { requirement_id: requirement.id, title },
        changes_summary: { added: 1, modified: 0, deleted: 0 },
        performed_by: 'User'
      })

    return NextResponse.json({ requirement }, { status: 201 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/requirements - Update requirement (handled by dynamic route)
// DELETE /api/requirements - Delete requirement (handled by dynamic route)