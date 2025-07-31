import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const type = searchParams.get('type')
    const workflowPhase = searchParams.get('workflow_phase')

    // Use service role to ensure we can read requirements
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    let query = serviceSupabase
      .from('requirements')
      .select(`
        *,
        requirement_changes:requirement_changes(
          id, change_type, field_changed, old_value, new_value, 
          changed_by, created_at
        ),
        requirement_comments:requirement_comments(
          id, comment_text, comment_type, author_type, author_name,
          is_resolved, created_at
        )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    // Apply filters
    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (type) query = query.eq('type', type)
    if (workflowPhase) query = query.eq('workflow_phase', parseInt(workflowPhase))

    const { data: requirements, error } = await query

    if (error) {
      console.error('[REQUIREMENTS API] Failed to fetch requirements:', error)
      return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 })
    }

    // Get requirement statistics
    const { data: stats } = await serviceSupabase
      .rpc('get_requirement_stats', { session_uuid: sessionId })

    return NextResponse.json({ 
      requirements: requirements || [],
      statistics: stats?.[0] || {
        total_requirements: 0,
        by_status: {},
        by_priority: {},
        by_type: {},
        completion_percentage: 0
      }
    })
  } catch (error) {
    console.error('[REQUIREMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      type,
      priority = 'medium',
      category,
      acceptance_criteria = [],
      user_story,
      business_value,
      effort_estimate,
      complexity,
      depends_on = [],
      stakeholder,
      business_owner,
      technical_owner,
      workflow_phase = 1,
      discovered_by = 'user',
      source = 'chat',
      rationale,
      assumptions = [],
      constraints = []
    } = body

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, type' },
        { status: 400 }
      )
    }

    // Use service role to ensure we can create requirements
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get session to verify workspace
    const { data: session } = await serviceSupabase
      .from('sessions')
      .select('workspace_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create requirement
    const { data: requirement, error } = await serviceSupabase
      .from('requirements')
      .insert({
        session_id: sessionId,
        workspace_id: session.workspace_id,
        title,
        description,
        type,
        priority,
        category,
        acceptance_criteria: Array.isArray(acceptance_criteria) ? acceptance_criteria : [acceptance_criteria],
        user_story,
        business_value,
        effort_estimate,
        complexity,
        depends_on,
        stakeholder,
        business_owner,
        technical_owner,
        workflow_phase,
        discovered_by,
        last_updated_by: discovered_by,
        source,
        rationale,
        assumptions,
        constraints,
        status: 'new'
      })
      .select()
      .single()

    if (error) {
      console.error('[REQUIREMENTS API] Failed to create requirement:', error)
      return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 })
    }

    return NextResponse.json({ requirement }, { status: 201 })
  } catch (error) {
    console.error('[REQUIREMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}