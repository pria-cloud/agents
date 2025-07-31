import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string; itemId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'task' // 'task', 'sprint', 'milestone'

    let result
    let table = 'development_tasks'

    switch (type) {
      case 'sprint':
        table = 'sprints'
        break
      case 'milestone':
        table = 'milestones'
        break
      default:
        table = 'development_tasks'
    }

    const { data: item, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', params.itemId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      console.error(`[TASKS API] ${type} not found:`, error)
      return NextResponse.json({ error: `${type} not found` }, { status: 404 })
    }

    result = { [type]: item }
    return NextResponse.json(result)

  } catch (error) {
    console.error('[TASKS API] Failed to get item:', error)
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string; itemId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { type = 'task', ...updateData } = body

    let table = 'development_tasks'
    switch (type) {
      case 'sprint':
        table = 'sprints'
        break
      case 'milestone':
        table = 'milestones'
        break
      default:
        table = 'development_tasks'
    }

    // Build update object with only provided fields
    const update: any = {
      updated_at: new Date().toISOString()
    }

    // Common fields
    if (updateData.title !== undefined) update.title = updateData.title.trim()
    if (updateData.description !== undefined) update.description = updateData.description.trim()
    if (updateData.status !== undefined) update.status = updateData.status
    if (updateData.priority !== undefined) update.priority = updateData.priority

    // Task-specific fields
    if (type === 'task') {
      if (updateData.estimated_hours !== undefined) update.estimated_hours = updateData.estimated_hours
      if (updateData.actual_hours !== undefined) update.actual_hours = updateData.actual_hours
      if (updateData.complexity !== undefined) update.complexity = updateData.complexity
      if (updateData.dependencies !== undefined) update.dependencies = updateData.dependencies
      if (updateData.acceptance_criteria !== undefined) update.acceptance_criteria = updateData.acceptance_criteria
      if (updateData.tags !== undefined) update.tags = updateData.tags
      if (updateData.technical_notes !== undefined) update.technical_notes = updateData.technical_notes
      if (updateData.assignee !== undefined) update.assignee = updateData.assignee
      if (updateData.sprint !== undefined) update.sprint = updateData.sprint
      if (updateData.milestone !== undefined) update.milestone = updateData.milestone
      
      // Mark completion time
      if (updateData.status === 'completed' && !update.completed_at) {
        update.completed_at = new Date().toISOString()
      }
    }

    // Sprint-specific fields
    if (type === 'sprint') {
      if (updateData.sprint_number !== undefined) update.sprint_number = updateData.sprint_number
      if (updateData.start_date !== undefined) update.start_date = updateData.start_date
      if (updateData.end_date !== undefined) update.end_date = updateData.end_date
      if (updateData.capacity_hours !== undefined) update.capacity_hours = updateData.capacity_hours
      if (updateData.allocated_hours !== undefined) update.allocated_hours = updateData.allocated_hours
      if (updateData.goals !== undefined) update.goals = updateData.goals
      if (updateData.tasks !== undefined) update.tasks = updateData.tasks
    }

    // Milestone-specific fields
    if (type === 'milestone') {
      if (updateData.target_date !== undefined) update.target_date = updateData.target_date
      if (updateData.actual_date !== undefined) update.actual_date = updateData.actual_date
      if (updateData.deliverables !== undefined) update.deliverables = updateData.deliverables
      if (updateData.dependencies !== undefined) update.dependencies = updateData.dependencies
      if (updateData.tasks !== undefined) update.tasks = updateData.tasks
      if (updateData.quality_gates !== undefined) update.quality_gates = updateData.quality_gates
    }

    // Update metadata
    if (updateData.metadata) {
      update.metadata = { ...updateData.metadata }
    }

    const { data: item, error } = await supabase
      .from(table)
      .update(update)
      .eq('id', params.itemId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error(`[TASKS API] Failed to update ${type}:`, error)
      return NextResponse.json({ error: `Failed to update ${type}` }, { status: 500 })
    }

    return NextResponse.json({ 
      [type]: item,
      success: true
    })

  } catch (error) {
    console.error('[TASKS API] Failed to update item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string; itemId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'task'

    let table = 'development_tasks'
    switch (type) {
      case 'sprint':
        table = 'sprints'
        break
      case 'milestone':
        table = 'milestones'
        break
      default:
        table = 'development_tasks'
    }

    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', params.itemId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error(`[TASKS API] Failed to delete ${type}:`, error)
      return NextResponse.json({ error: `Failed to delete ${type}` }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `${type} deleted successfully`
    })

  } catch (error) {
    console.error('[TASKS API] Failed to delete item:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}