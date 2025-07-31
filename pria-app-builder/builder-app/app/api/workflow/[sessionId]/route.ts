import { NextRequest, NextResponse } from 'next/server'
import { WorkflowManager } from '@/lib/workflow/workflow-manager'
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

    const workflowManager = new WorkflowManager(params.sessionId)
    const workflowState = await workflowManager.getWorkflowState()

    if (!workflowState) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({ workflowState })
  } catch (error) {
    console.error('[WORKFLOW API] Failed to get workflow:', error)
    return NextResponse.json({ error: 'Failed to get workflow' }, { status: 500 })
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

    const body = await request.json()
    const { projectName, projectType, targetTechnology } = body

    const workflowManager = new WorkflowManager(params.sessionId)
    const workflowState = await workflowManager.initializeWorkflow({
      projectName,
      projectType,
      targetTechnology
    })

    return NextResponse.json({ workflowState })
  } catch (error) {
    console.error('[WORKFLOW API] Failed to initialize workflow:', error)
    return NextResponse.json({ error: 'Failed to initialize workflow' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { action, progress, artifacts } = body

    const workflowManager = new WorkflowManager(params.sessionId)

    switch (action) {
      case 'update_progress':
        await workflowManager.updatePhaseProgress(progress, artifacts)
        break
      case 'pass_quality_gate':
        await workflowManager.passQualityGate()
        break
      case 'advance_phase':
        const canAdvance = await workflowManager.canAdvanceToNextPhase()
        if (!canAdvance) {
          return NextResponse.json({ error: 'Cannot advance phase: requirements not met' }, { status: 400 })
        }
        await workflowManager.advanceToNextPhase()
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedState = await workflowManager.getWorkflowState()
    return NextResponse.json({ workflowState: updatedState })
  } catch (error) {
    console.error('[WORKFLOW API] Failed to update workflow:', error)
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
  }
}