import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

// Mock user context for testing
const TEST_USER = {
  id: process.env.TEST_USER_ID!,
  workspace_id: process.env.TEST_WORKSPACE_ID!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode, requirements } = body

    console.log('Creating test session:', { mode, requirements })

    const result = await supabaseIntegration.createSession({
      workspace_id: TEST_USER.workspace_id,
      user_id: TEST_USER.id,
      mode,
      requirements
    })

    if (result.error) {
      console.error('Session creation error:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      session_id: result.data?.id,
      session: result.data 
    })
  } catch (error) {
    console.error('Failed to create Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 10

    const result = await supabaseIntegration.getWorkspaceSessions(TEST_USER.workspace_id, {
      limit
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ sessions: result.data })
  } catch (error) {
    console.error('Failed to get Claude sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}