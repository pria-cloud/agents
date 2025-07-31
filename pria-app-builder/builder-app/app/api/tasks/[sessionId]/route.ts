import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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
    const type = searchParams.get('type') // 'tasks', 'sprints', 'milestones', or 'all'
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    // Get development tasks
    let tasksQuery = supabase
      .from('development_tasks')
      .select('*')
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (status) {
      tasksQuery = tasksQuery.eq('status', status)
    }
    if (priority) {
      tasksQuery = tasksQuery.eq('priority', priority)
    }

    const { data: tasks, error: tasksError } = await tasksQuery

    // Get sprints
    const { data: sprints, error: sprintsError } = await supabase
      .from('sprints')
      .select('*')
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .order('sprint_number', { ascending: true })

    // Get milestones
    const { data: milestones, error: milestonesError } = await supabase
      .from('milestones')
      .select('*')
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (tasksError || sprintsError || milestonesError) {
      console.error('[TASKS API] Database error:', tasksError || sprintsError || milestonesError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Return based on type filter
    const response: any = { sessionId: params.sessionId }

    if (!type || type === 'all' || type === 'tasks') {
      response.tasks = tasks || []
    }
    if (!type || type === 'all' || type === 'sprints') {
      response.sprints = sprints || []
    }
    if (!type || type === 'all' || type === 'milestones') {
      response.milestones = milestones || []
    }

    // Add summary statistics
    if (!type || type === 'all') {
      response.summary = {
        total_tasks: (tasks || []).length,
        completed_tasks: (tasks || []).filter(t => t.status === 'completed').length,
        in_progress_tasks: (tasks || []).filter(t => t.status === 'in_progress').length,
        total_sprints: (sprints || []).length,
        total_milestones: (milestones || []).length,
        estimated_total_hours: (tasks || []).reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0),
        critical_path_tasks: (tasks || []).filter((t: any) => t.metadata?.critical_path).length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[TASKS API] Failed to get tasks:', error)
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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
    const { type, item } = body // type: 'task', 'sprint', 'milestone'

    if (!type || !item) {
      return NextResponse.json({ 
        error: 'Missing required fields: type, item' 
      }, { status: 400 })
    }

    let result

    switch (type) {
      case 'task':
        const { data: task, error: taskError } = await supabase
          .from('development_tasks')
          .insert({
            ...item,
            workspace_id: workspaceId,
            session_id: params.sessionId,
            status: item.status || 'not_started',
            metadata: {
              ...item.metadata,
              created_manually: true,
              workflow_phase: 3
            }
          })
          .select()
          .single()

        if (taskError) {
          console.error('[TASKS API] Failed to create task:', taskError)
          return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
        }
        result = { task }
        break

      case 'sprint':
        const { data: sprint, error: sprintError } = await supabase
          .from('sprints')
          .insert({
            ...item,
            workspace_id: workspaceId,
            session_id: params.sessionId,
            status: item.status || 'planned'
          })
          .select()
          .single()

        if (sprintError) {
          console.error('[TASKS API] Failed to create sprint:', sprintError)
          return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 })
        }
        result = { sprint }
        break

      case 'milestone':
        const { data: milestone, error: milestoneError } = await supabase
          .from('milestones')
          .insert({
            ...item,
            workspace_id: workspaceId,
            session_id: params.sessionId,
            status: item.status || 'planned'
          })
          .select()
          .single()

        if (milestoneError) {
          console.error('[TASKS API] Failed to create milestone:', milestoneError)
          return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
        }
        result = { milestone }
        break

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ 
      ...result,
      success: true
    })

  } catch (error) {
    console.error('[TASKS API] Failed to create item:', error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}