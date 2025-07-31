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
    const progressSummary = await workflowManager.getProgressSummary()

    if (!progressSummary) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json({ progress: progressSummary })
  } catch (error) {
    console.error('[WORKFLOW PROGRESS API] Failed to get progress:', error)
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 })
  }
}