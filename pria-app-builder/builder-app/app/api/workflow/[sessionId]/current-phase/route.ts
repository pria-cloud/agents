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
    const currentPhase = await workflowManager.getCurrentPhase()
    const systemPrompt = await workflowManager.getCurrentPhasePrompt()

    if (!currentPhase) {
      return NextResponse.json({ error: 'No active workflow phase found' }, { status: 404 })
    }

    return NextResponse.json({ 
      currentPhase,
      systemPrompt,
      canAdvance: await workflowManager.canAdvanceToNextPhase()
    })
  } catch (error) {
    console.error('[WORKFLOW CURRENT PHASE API] Failed to get current phase:', error)
    return NextResponse.json({ error: 'Failed to get current phase' }, { status: 500 })
  }
}