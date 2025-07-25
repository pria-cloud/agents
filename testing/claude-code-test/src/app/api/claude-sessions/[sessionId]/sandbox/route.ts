import { NextRequest, NextResponse } from 'next/server'
import { e2bService } from '@/lib/claude-code/e2b-service'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create':
        return await createSandbox(sessionId)
      case 'status':
        return await getSandboxStatus(sessionId)
      case 'stop':
        return await stopSandbox(sessionId)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sandbox API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createSandbox(sessionId: string) {
  try {
    console.log(`Creating sandbox for session: ${sessionId}`)
    
    const sandbox = await e2bService.createSandbox(sessionId)
    
    if (sandbox.status === 'error') {
      return NextResponse.json({ error: 'Failed to create sandbox' }, { status: 500 })
    }

    // Update session in database
    await supabaseIntegration.updateSession(sessionId, {
      e2b_sandbox_id: sandbox.id,
      e2b_sandbox_url: sandbox.url,
      status: 'ready'
    })

    // Log progress event
    await supabaseIntegration.logProgressEvent({
      session_id: sessionId,
      workspace_id: process.env.TEST_WORKSPACE_ID!,
      event_type: 'sandbox_created',
      event_data: {
        sandbox_id: sandbox.id,
        sandbox_url: sandbox.url
      }
    })

    return NextResponse.json({
      sandbox_id: sandbox.id,
      sandbox_url: sandbox.url,
      status: sandbox.status
    })
  } catch (error) {
    console.error('Failed to create sandbox:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function getSandboxStatus(sessionId: string) {
  try {
    const status = await e2bService.getSandboxStatus(sessionId)
    return NextResponse.json({ status })
  } catch (error) {
    console.error('Failed to get sandbox status:', error)
    return NextResponse.json({ status: 'error' })
  }
}

async function stopSandbox(sessionId: string) {
  try {
    await e2bService.stopSandbox(sessionId)
    
    // Update session status
    await supabaseIntegration.updateSession(sessionId, {
      status: 'completed'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to stop sandbox:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const status = await e2bService.getSandboxStatus(sessionId)
    return NextResponse.json({ status })
  } catch (error) {
    console.error('Failed to get sandbox status:', error)
    return NextResponse.json({ status: 'error' })
  }
}