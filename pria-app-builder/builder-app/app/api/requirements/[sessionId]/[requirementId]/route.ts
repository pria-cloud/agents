import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; requirementId: string }> }
) {
  try {
    const { sessionId, requirementId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Use service role to ensure we can read requirements
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: requirement, error } = await serviceSupabase
      .from('requirements')
      .select(`
        *,
        requirement_changes:requirement_changes(
          id, change_type, field_changed, old_value, new_value, 
          changed_by, change_reason, created_at
        ),
        requirement_comments:requirement_comments(
          id, comment_text, comment_type, author_type, author_name,
          is_resolved, created_at, parent_comment_id
        )
      `)
      .eq('id', requirementId)
      .eq('session_id', sessionId)
      .single()

    if (error || !requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
    }

    return NextResponse.json({ requirement })
  } catch (error) {
    console.error('[REQUIREMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; requirementId: string }> }
) {
  try {
    const { sessionId, requirementId } = await params
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
      priority,
      status,
      category,
      acceptance_criteria,
      user_story,
      business_value,
      effort_estimate,
      complexity,
      depends_on,
      stakeholder,
      business_owner,
      technical_owner,
      rationale,
      assumptions,
      constraints,
      implemented_in_files,
      test_cases,
      documentation_links,
      last_updated_by = 'user',
      change_reason
    } = body

    // Use service role to ensure we can update requirements
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Build update object with only provided fields
    const updateData: any = {
      last_updated_by
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) updateData.status = status
    if (category !== undefined) updateData.category = category
    if (acceptance_criteria !== undefined) updateData.acceptance_criteria = acceptance_criteria
    if (user_story !== undefined) updateData.user_story = user_story
    if (business_value !== undefined) updateData.business_value = business_value
    if (effort_estimate !== undefined) updateData.effort_estimate = effort_estimate
    if (complexity !== undefined) updateData.complexity = complexity
    if (depends_on !== undefined) updateData.depends_on = depends_on
    if (stakeholder !== undefined) updateData.stakeholder = stakeholder
    if (business_owner !== undefined) updateData.business_owner = business_owner
    if (technical_owner !== undefined) updateData.technical_owner = technical_owner
    if (rationale !== undefined) updateData.rationale = rationale
    if (assumptions !== undefined) updateData.assumptions = assumptions
    if (constraints !== undefined) updateData.constraints = constraints
    if (implemented_in_files !== undefined) updateData.implemented_in_files = implemented_in_files
    if (test_cases !== undefined) updateData.test_cases = test_cases
    if (documentation_links !== undefined) updateData.documentation_links = documentation_links

    const { data: requirement, error } = await serviceSupabase
      .from('requirements')
      .update(updateData)
      .eq('id', requirementId)
      .eq('session_id', sessionId)
      .select()
      .single()

    if (error) {
      console.error('[REQUIREMENTS API] Failed to update requirement:', error)
      return NextResponse.json({ error: 'Failed to update requirement' }, { status: 500 })
    }

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
    }

    // If change_reason was provided, add it to the latest change record
    if (change_reason) {
      await serviceSupabase
        .from('requirement_changes')
        .update({ change_reason })
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    return NextResponse.json({ requirement })
  } catch (error) {
    console.error('[REQUIREMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; requirementId: string }> }
) {
  try {
    const { sessionId, requirementId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Use service role to ensure we can delete requirements
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { error } = await serviceSupabase
      .from('requirements')
      .delete()
      .eq('id', requirementId)
      .eq('session_id', sessionId)

    if (error) {
      console.error('[REQUIREMENTS API] Failed to delete requirement:', error)
      return NextResponse.json({ error: 'Failed to delete requirement' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[REQUIREMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}