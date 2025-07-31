import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import type { RequirementUpdate } from '@/lib/supabase/types'

// GET /api/requirements/[id] - Get specific requirement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: requirement, error } = await supabase
      .from('requirements')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch requirement' }, { status: 500 })
    }

    return NextResponse.json({ requirement })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/requirements/[id] - Update requirement
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, priority, status, category, acceptanceCriteria } = body

    // Get current requirement to check access and get session info
    const { data: currentRequirement, error: fetchError } = await supabase
      .from('requirements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch requirement' }, { status: 500 })
    }

    // Build update object
    const updateData: RequirementUpdate = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) updateData.status = status
    if (category !== undefined) updateData.category = category
    if (acceptanceCriteria !== undefined) updateData.acceptance_criteria = acceptanceCriteria

    // Update requirement
    const { data: requirement, error } = await supabase
      .from('requirements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update requirement' }, { status: 500 })
    }

    // Log this event in session history
    await supabase
      .from('session_history')
      .insert({
        session_id: currentRequirement.session_id,
        workspace_id: currentRequirement.workspace_id,
        event_type: 'requirement',
        event_title: 'Requirement Updated',
        event_description: `Updated requirement: ${requirement.title}`,
        event_data: { requirement_id: requirement.id, title: requirement.title, changes: updateData },
        changes_summary: { added: 0, modified: 1, deleted: 0 },
        performed_by: 'User'
      })

    return NextResponse.json({ requirement })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/requirements/[id] - Delete requirement
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get current requirement to check access and get session info
    const { data: currentRequirement, error: fetchError } = await supabase
      .from('requirements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch requirement' }, { status: 500 })
    }

    // Delete requirement
    const { error } = await supabase
      .from('requirements')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete requirement' }, { status: 500 })
    }

    // Log this event in session history
    await supabase
      .from('session_history')
      .insert({
        session_id: currentRequirement.session_id,
        workspace_id: currentRequirement.workspace_id,
        event_type: 'requirement',
        event_title: 'Requirement Deleted',
        event_description: `Deleted requirement: ${currentRequirement.title}`,
        event_data: { requirement_id: id, title: currentRequirement.title },
        changes_summary: { added: 0, modified: 0, deleted: 1 },
        performed_by: 'User'
      })

    return NextResponse.json({ message: 'Requirement deleted successfully' })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}