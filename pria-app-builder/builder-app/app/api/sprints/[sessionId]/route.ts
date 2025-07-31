import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { SprintPlanner } from '@/lib/planning/sprint-planner'

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
    const action = searchParams.get('action') || 'plan'

    switch (action) {
      case 'plan':
        // Get existing sprint plan or generate new one
        const { data: existingPlan } = await supabase
          .from('sprint_plans')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .single()

        if (existingPlan) {
          return NextResponse.json({
            plan: existingPlan.plan_data,
            generated_at: existingPlan.created_at,
            success: true
          })
        }

        // Generate new sprint plan
        const { data: tasks } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        const { data: dependencies } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (!tasks || tasks.length === 0) {
          return NextResponse.json({
            plan: null,
            message: 'No tasks available for sprint planning'
          })
        }

        // Get project settings or use defaults
        const { data: projectSettings } = await supabase
          .from('sessions')
          .select('metadata')
          .eq('id', params.sessionId)
          .single()

        const settings = projectSettings?.metadata?.project_settings || {}
        
        const constraints = {
          team_size: settings.team_size || 3,
          sprint_length_weeks: settings.sprint_length_weeks || 2,
          hours_per_week_per_person: settings.hours_per_week_per_person || 40,
          start_date: settings.start_date || new Date().toISOString().split('T')[0],
          target_milestones: settings.target_milestones || [],
          velocity_factor: settings.velocity_factor || 0.8
        }

        try {
          const sprintPlan = SprintPlanner.generateSprintPlan(
            tasks,
            dependencies || [],
            constraints
          )

          // Store the generated plan
          const { data: savedPlan } = await supabase
            .from('sprint_plans')
            .insert({
              workspace_id: workspaceId,
              session_id: params.sessionId,
              plan_data: sprintPlan,
              constraints_used: constraints,
              tasks_planned: tasks.length,
              sprints_generated: sprintPlan.sprints.length
            })
            .select()
            .single()

          return NextResponse.json({
            plan: sprintPlan,
            generated_at: savedPlan?.created_at,
            success: true
          })

        } catch (planError) {
          console.error('[SPRINTS API] Sprint planning failed:', planError)
          return NextResponse.json({
            error: 'Sprint planning failed',
            details: planError instanceof Error ? planError.message : 'Unknown error'
          }, { status: 500 })
        }

      case 'sprints':
        // Get sprints only
        const { data: sprintsData } = await supabase
          .from('sprints')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('sprint_number', { ascending: true })

        return NextResponse.json({ sprints: sprintsData || [] })

      case 'milestones':
        // Get milestones only
        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('target_date', { ascending: true })

        return NextResponse.json({ milestones: milestonesData || [] })

      case 'capacity':
        // Get capacity analysis
        const { data: capacityPlan } = await supabase
          .from('sprint_plans')
          .select('plan_data')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .single()

        if (capacityPlan?.plan_data?.capacity_analysis) {
          return NextResponse.json({
            capacity_analysis: capacityPlan.plan_data.capacity_analysis,
            recommendations: capacityPlan.plan_data.recommendations
          })
        }

        return NextResponse.json({ capacity_analysis: null })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[SPRINTS API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const { action, ...data } = body

    switch (action) {
      case 'regenerate_plan':
        const { constraints } = data
        
        if (!constraints) {
          return NextResponse.json({ 
            error: 'Planning constraints required' 
          }, { status: 400 })
        }

        // Get tasks and dependencies
        const { data: tasks } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        const { data: dependencies } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (!tasks || tasks.length === 0) {
          return NextResponse.json({
            error: 'No tasks available for sprint planning'
          }, { status: 400 })
        }

        try {
          const newPlan = SprintPlanner.generateSprintPlan(
            tasks,
            dependencies || [],
            constraints
          )

          // Update existing plan or create new one
          const { data: updatedPlan, error: updateError } = await supabase
            .from('sprint_plans')
            .upsert({
              workspace_id: workspaceId,
              session_id: params.sessionId,
              plan_data: newPlan,
              constraints_used: constraints,
              tasks_planned: tasks.length,
              sprints_generated: newPlan.sprints.length,
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (updateError) {
            console.error('[SPRINTS API] Failed to save plan:', updateError)
            return NextResponse.json({ error: 'Failed to save sprint plan' }, { status: 500 })
          }

          return NextResponse.json({
            plan: newPlan,
            success: true,
            message: 'Sprint plan regenerated successfully'
          })

        } catch (planError) {
          console.error('[SPRINTS API] Plan regeneration failed:', planError)
          return NextResponse.json({
            error: 'Plan regeneration failed',
            details: planError instanceof Error ? planError.message : 'Unknown error'
          }, { status: 500 })
        }

      case 'create_sprint':
        const { sprint } = data
        
        if (!sprint) {
          return NextResponse.json({ error: 'Sprint data required' }, { status: 400 })
        }

        const newSprint = {
          ...sprint,
          id: sprint.id || `sprint-${Date.now()}`,
          workspace_id: workspaceId,
          session_id: params.sessionId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: createdSprint, error: createError } = await supabase
          .from('sprints')
          .insert(newSprint)
          .select()
          .single()

        if (createError) {
          console.error('[SPRINTS API] Failed to create sprint:', createError)
          return NextResponse.json({ error: 'Failed to create sprint' }, { status: 500 })
        }

        return NextResponse.json({
          sprint: createdSprint,
          success: true,
          message: 'Sprint created successfully'
        })

      case 'update_sprint':
        const { sprint_id, updates } = data
        
        if (!sprint_id || !updates) {
          return NextResponse.json({ 
            error: 'Sprint ID and updates required' 
          }, { status: 400 })
        }

        const { data: updatedSprint, error: sprintUpdateError } = await supabase
          .from('sprints')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', sprint_id)
          .eq('workspace_id', workspaceId)
          .select()
          .single()

        if (sprintUpdateError) {
          console.error('[SPRINTS API] Failed to update sprint:', sprintUpdateError)
          return NextResponse.json({ error: 'Failed to update sprint' }, { status: 500 })
        }

        return NextResponse.json({
          sprint: updatedSprint,
          success: true,
          message: 'Sprint updated successfully'
        })

      case 'create_milestone':
        const { milestone } = data
        
        if (!milestone) {
          return NextResponse.json({ error: 'Milestone data required' }, { status: 400 })
        }

        const newMilestone = {
          ...milestone,
          id: milestone.id || `milestone-${Date.now()}`,
          workspace_id: workspaceId,
          session_id: params.sessionId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const { data: createdMilestone, error: milestoneCreateError } = await supabase
          .from('milestones')
          .insert(newMilestone)
          .select()
          .single()

        if (milestoneCreateError) {
          console.error('[SPRINTS API] Failed to create milestone:', milestoneCreateError)
          return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 })
        }

        return NextResponse.json({
          milestone: createdMilestone,
          success: true,
          message: 'Milestone created successfully'
        })

      case 'update_milestone':
        const { milestone_id, milestone_updates } = data
        
        if (!milestone_id || !milestone_updates) {
          return NextResponse.json({ 
            error: 'Milestone ID and updates required' 
          }, { status: 400 })
        }

        const { data: updatedMilestone, error: milestoneUpdateError } = await supabase
          .from('milestones')
          .update({
            ...milestone_updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', milestone_id)
          .eq('workspace_id', workspaceId)
          .select()
          .single()

        if (milestoneUpdateError) {
          console.error('[SPRINTS API] Failed to update milestone:', milestoneUpdateError)
          return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 })
        }

        return NextResponse.json({
          milestone: updatedMilestone,
          success: true,
          message: 'Milestone updated successfully'
        })

      case 'assign_tasks':
        const { sprint_id: assignSprintId, task_ids } = data
        
        if (!assignSprintId || !task_ids || !Array.isArray(task_ids)) {
          return NextResponse.json({ 
            error: 'Sprint ID and task IDs array required' 
          }, { status: 400 })
        }

        // Update tasks to assign them to the sprint
        const { data: assignedTasks, error: assignError } = await supabase
          .from('development_tasks')
          .update({ 
            sprint_number: assignSprintId,
            updated_at: new Date().toISOString()
          })
          .in('id', task_ids)
          .eq('workspace_id', workspaceId)
          .select()

        if (assignError) {
          console.error('[SPRINTS API] Failed to assign tasks:', assignError)
          return NextResponse.json({ error: 'Failed to assign tasks to sprint' }, { status: 500 })
        }

        return NextResponse.json({
          assigned_tasks: assignedTasks,
          success: true,
          message: `Assigned ${task_ids.length} tasks to sprint`
        })

      case 'update_project_settings':
        const { settings } = data
        
        if (!settings) {
          return NextResponse.json({ error: 'Settings required' }, { status: 400 })
        }

        // Update session metadata with project settings
        const { data: session } = await supabase
          .from('sessions')
          .select('metadata')
          .eq('id', params.sessionId)
          .single()

        const updatedMetadata = {
          ...session?.metadata,
          project_settings: {
            ...session?.metadata?.project_settings,
            ...settings
          }
        }

        const { error: settingsError } = await supabase
          .from('sessions')
          .update({ metadata: updatedMetadata })
          .eq('id', params.sessionId)

        if (settingsError) {
          console.error('[SPRINTS API] Failed to update settings:', settingsError)
          return NextResponse.json({ error: 'Failed to update project settings' }, { status: 500 })
        }

        return NextResponse.json({
          settings: updatedMetadata.project_settings,
          success: true,
          message: 'Project settings updated successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[SPRINTS API] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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
    const action = searchParams.get('action')
    const targetId = searchParams.get('id')

    switch (action) {
      case 'sprint':
        if (!targetId) {
          return NextResponse.json({ error: 'Sprint ID required' }, { status: 400 })
        }

        const { error: sprintDeleteError } = await supabase
          .from('sprints')
          .delete()
          .eq('id', targetId)
          .eq('workspace_id', workspaceId)

        if (sprintDeleteError) {
          console.error('[SPRINTS API] Failed to delete sprint:', sprintDeleteError)
          return NextResponse.json({ error: 'Failed to delete sprint' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Sprint deleted successfully'
        })

      case 'milestone':
        if (!targetId) {
          return NextResponse.json({ error: 'Milestone ID required' }, { status: 400 })
        }

        const { error: milestoneDeleteError } = await supabase
          .from('milestones')
          .delete()
          .eq('id', targetId)
          .eq('workspace_id', workspaceId)

        if (milestoneDeleteError) {
          console.error('[SPRINTS API] Failed to delete milestone:', milestoneDeleteError)
          return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Milestone deleted successfully'
        })

      case 'plan':
        // Delete entire sprint plan
        const { error: planDeleteError } = await supabase
          .from('sprint_plans')
          .delete()
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (planDeleteError) {
          console.error('[SPRINTS API] Failed to delete plan:', planDeleteError)
          return NextResponse.json({ error: 'Failed to delete sprint plan' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Sprint plan deleted successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[SPRINTS API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}