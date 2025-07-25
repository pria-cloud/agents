import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    const result = await supabaseIntegration.getProgressEvents(sessionId, process.env.TEST_WORKSPACE_ID!)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ progress: result.data || [] })
  } catch (error) {
    console.error('Failed to get progress events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}