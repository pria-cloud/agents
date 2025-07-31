import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { DependencyAnalyzer } from '@/lib/planning/dependency-analyzer'

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
    const action = searchParams.get('action') || 'analysis'

    switch (action) {
      case 'analysis':
        // Get all tasks for the session
        const { data: tasks, error: tasksError } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (tasksError) {
          console.error('[DEPENDENCIES API] Failed to fetch tasks:', tasksError)
          return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
        }

        // Get existing dependencies
        const { data: dependencies, error: depsError } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (depsError) {
          console.error('[DEPENDENCIES API] Failed to fetch dependencies:', depsError)
          return NextResponse.json({ error: 'Failed to fetch dependencies' }, { status: 500 })
        }

        // If no dependencies exist, infer them
        let allDependencies = dependencies || []
        if (allDependencies.length === 0 && tasks && tasks.length > 0) {
          console.log('[DEPENDENCIES API] Inferring dependencies from tasks')
          const inferredDeps = DependencyAnalyzer.inferDependencies(tasks)
          
          // Store inferred dependencies
          if (inferredDeps.length > 0) {
            const { data: insertedDeps, error: insertError } = await supabase
              .from('task_dependencies')
              .insert(inferredDeps.map(dep => ({
                ...dep,
                workspace_id: workspaceId,
                session_id: params.sessionId
              })))
              .select()

            if (!insertError && insertedDeps) {
              allDependencies = insertedDeps
              console.log(`[DEPENDENCIES API] Stored ${insertedDeps.length} inferred dependencies`)
            }
          }
        }

        // Perform dependency analysis
        try {
          const analysis = DependencyAnalyzer.analyzeDependencies(tasks || [], allDependencies)
          
          return NextResponse.json({
            analysis,
            tasks_count: tasks?.length || 0,
            dependencies_count: allDependencies.length,
            success: true
          })
        } catch (analysisError) {
          console.error('[DEPENDENCIES API] Analysis failed:', analysisError)
          return NextResponse.json({ 
            error: 'Dependency analysis failed',
            details: analysisError instanceof Error ? analysisError.message : 'Unknown error'
          }, { status: 500 })
        }

      case 'dependencies':
        // Get dependencies only
        const { data: depsOnly } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        return NextResponse.json({ dependencies: depsOnly || [] })

      case 'critical_path':
        // Get critical path only
        const { data: cpTasks } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        const { data: cpDeps } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (cpTasks && cpDeps) {
          try {
            const analysis = DependencyAnalyzer.analyzeDependencies(cpTasks, cpDeps)
            return NextResponse.json({ 
              critical_path: analysis.critical_path,
              bottlenecks: analysis.critical_path.bottlenecks
            })
          } catch (error) {
            return NextResponse.json({ error: 'Critical path calculation failed' }, { status: 500 })
          }
        }

        return NextResponse.json({ critical_path: null })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEPENDENCIES API] GET error:', error)
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
      case 'add_dependency':
        const { task_id, depends_on_task_id, dependency_type, reason } = data
        
        if (!task_id || !depends_on_task_id || !dependency_type) {
          return NextResponse.json({ 
            error: 'Missing required fields: task_id, depends_on_task_id, dependency_type' 
          }, { status: 400 })
        }

        // Check for circular dependency
        const { data: existingDeps } = await supabase
          .from('task_dependencies')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        const { data: allTasks } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        // Test if adding this dependency would create a cycle
        const testDeps = [...(existingDeps || []), {
          id: 'test',
          task_id,
          depends_on_task_id,
          dependency_type,
          created_at: new Date().toISOString()
        }]

        try {
          DependencyAnalyzer.analyzeDependencies(allTasks || [], testDeps)
        } catch (cycleError) {
          return NextResponse.json({ 
            error: 'Adding this dependency would create a cycle',
            details: cycleError instanceof Error ? cycleError.message : 'Cycle detected'
          }, { status: 400 })
        }

        const newDependency = {
          id: `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          workspace_id: workspaceId,
          session_id: params.sessionId,
          task_id,
          depends_on_task_id,
          dependency_type,
          created_at: new Date().toISOString(),
          metadata: {
            reason: reason || 'Manually added dependency',
            strength: 0.8,
            risk_level: 'medium'
          }
        }

        const { data: insertedDep, error: insertError } = await supabase
          .from('task_dependencies')
          .insert(newDependency)
          .select()
          .single()

        if (insertError) {
          console.error('[DEPENDENCIES API] Failed to insert dependency:', insertError)
          return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 })
        }

        return NextResponse.json({
          dependency: insertedDep,
          success: true,
          message: 'Dependency added successfully'
        })

      case 'remove_dependency':
        const { dependency_id } = data
        
        if (!dependency_id) {
          return NextResponse.json({ error: 'Dependency ID required' }, { status: 400 })
        }

        const { error: deleteError } = await supabase
          .from('task_dependencies')
          .delete()
          .eq('id', dependency_id)
          .eq('workspace_id', workspaceId)

        if (deleteError) {
          console.error('[DEPENDENCIES API] Failed to delete dependency:', deleteError)
          return NextResponse.json({ error: 'Failed to remove dependency' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Dependency removed successfully'
        })

      case 'update_dependency':
        const { dependency_id: updateId, dependency_type: newType, reason: newReason } = data
        
        if (!updateId) {
          return NextResponse.json({ error: 'Dependency ID required' }, { status: 400 })
        }

        const updateData: any = { updated_at: new Date().toISOString() }
        if (newType) updateData.dependency_type = newType
        if (newReason) updateData.metadata = { reason: newReason }

        const { data: updatedDep, error: updateError } = await supabase
          .from('task_dependencies')
          .update(updateData)
          .eq('id', updateId)
          .eq('workspace_id', workspaceId)
          .select()
          .single()

        if (updateError) {
          console.error('[DEPENDENCIES API] Failed to update dependency:', updateError)
          return NextResponse.json({ error: 'Failed to update dependency' }, { status: 500 })
        }

        return NextResponse.json({
          dependency: updatedDep,
          success: true,
          message: 'Dependency updated successfully'
        })

      case 'reanalyze':
        // Trigger fresh dependency analysis
        const { data: reanalyzeTasks } = await supabase
          .from('development_tasks')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)

        if (reanalyzeTasks && reanalyzeTasks.length > 0) {
          // Clear existing auto-generated dependencies
          await supabase
            .from('task_dependencies')
            .delete()
            .eq('session_id', params.sessionId)
            .eq('workspace_id', workspaceId)
            .like('metadata->reason', '%inferred%')

          // Generate new dependencies
          const newDeps = DependencyAnalyzer.inferDependencies(reanalyzeTasks)
          
          if (newDeps.length > 0) {
            const { data: insertedDeps } = await supabase
              .from('task_dependencies')
              .insert(newDeps.map(dep => ({
                ...dep,
                workspace_id: workspaceId,
                session_id: params.sessionId,
                metadata: {
                  ...dep.metadata,
                  reason: 'Auto-inferred dependency'
                }
              })))
              .select()

            // Perform fresh analysis
            const analysis = DependencyAnalyzer.analyzeDependencies(reanalyzeTasks, insertedDeps || [])

            return NextResponse.json({
              analysis,
              dependencies_added: newDeps.length,
              success: true,
              message: 'Dependencies reanalyzed successfully'
            })
          }
        }

        return NextResponse.json({
          success: true,
          message: 'No new dependencies found'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEPENDENCIES API] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}