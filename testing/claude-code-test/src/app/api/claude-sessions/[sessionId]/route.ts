import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const result = await supabaseIntegration.getSession(sessionId, TEST_WORKSPACE_ID)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ session: result.data })
  } catch (error) {
    console.error('Failed to get Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const updates = await request.json()
    const result = await supabaseIntegration.updateSession(sessionId, updates)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ session: result.data })
  } catch (error) {
    console.error('Failed to update Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}