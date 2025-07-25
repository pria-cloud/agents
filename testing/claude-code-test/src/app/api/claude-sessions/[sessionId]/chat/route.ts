import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'
import { e2bService } from '@/lib/claude-code/e2b-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { workspace_id, user_input, context, message } = body

    const session_id = sessionId
    const actualUserInput = message || user_input // Support both parameter names

    console.log('Chat request:', { session_id, user_input: actualUserInput })

    // Debug all environment variables
    console.log('All env vars containing TESTING:', Object.keys(process.env).filter(key => key.toLowerCase().includes('testing')))
    console.log('NODE_ENV:', process.env.NODE_ENV)
    
    // Check if testing mode is enabled
    const testingMode = process.env.TESTING_MODE || 'mock'
    console.log('TESTING_MODE environment variable:', process.env.TESTING_MODE)
    console.log('Resolved testing mode:', testingMode)
    
    if (testingMode === 'mock') {
      console.log('Using mock mode due to TESTING_MODE setting')
      return handleMockResponse(session_id, actualUserInput, context)
    }

    console.log('Using full E2B mode - creating sandbox if needed')

    // Get session from database
    const sessionResult = await supabaseIntegration.getSession(session_id, workspace_id || process.env.TEST_WORKSPACE_ID!)
    
    if (sessionResult.error || !sessionResult.data) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const session = sessionResult.data

    // Create E2B sandbox if not exists
    if (!session.e2b_sandbox_id) {
      console.log('Creating new E2B sandbox for session:', session_id)
      
      const sandbox = await e2bService.createSandbox(session_id)
      
      if (sandbox.status === 'error') {
        return NextResponse.json({ error: 'Failed to create development environment' }, { status: 500 })
      }

      // Update session with sandbox info
      await supabaseIntegration.updateSession(session_id, {
        e2b_sandbox_id: sandbox.id,
        e2b_sandbox_url: sandbox.url,
        status: 'discovering'
      })

      // Log progress event
      await supabaseIntegration.logProgressEvent({
        session_id,
        workspace_id: workspace_id || process.env.TEST_WORKSPACE_ID!,
        event_type: 'sandbox_created',
        event_data: {
          sandbox_id: sandbox.id,
          sandbox_url: sandbox.url
        }
      })
    }

    // Send message to Claude Code SDK in sandbox
    try {
      console.log('Sending message to Claude Code SDK in sandbox')
      
      const claudeResponse = await e2bService.sendMessage(session_id, actualUserInput, {
        session_info: session,
        previous_messages: context?.previous_messages || [],
        mode: context?.mode || 'business'
      })

      // Log progress event
      await supabaseIntegration.logProgressEvent({
        session_id,
        workspace_id: workspace_id || process.env.TEST_WORKSPACE_ID!,
        event_type: 'chat_message',
        event_data: {
          user_input: actualUserInput,
          response: claudeResponse.response,
          confidence: claudeResponse.confidence_score || 0.5
        }
      })

      // Update session status if needed
      if (claudeResponse.status_change) {
        await supabaseIntegration.updateSession(session_id, {
          status: claudeResponse.status_change,
          requirements: claudeResponse.extracted_requirements || session.requirements
        })
      }

      return NextResponse.json(claudeResponse)

    } catch (error) {
      console.error('Failed to communicate with Claude Code SDK:', error)
      
      // Fallback to informative error message
      return NextResponse.json({
        response: "I'm having trouble connecting to the development environment. This might be because the sandbox is still starting up. Please try again in a moment.",
        type: 'error',
        confidence_score: 0,
        error: error.message
      })
    }

  } catch (error) {
    console.error('Failed to process chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fallback mock response for testing mode
async function handleMockResponse(session_id: string, user_input: string, context: any) {
  console.log('Using mock mode for testing')
  
  const mockResponse = {
    response: `🧪 **Mock Mode Active**\n\nI received: "${user_input}"\n\nTo test the full Claude Code E2B integration:\n1. Set TESTING_MODE=full in your .env.local\n2. Restart the dev server\n3. I'll then create a real E2B sandbox with Claude Code SDK\n\nCurrently simulating the conversation flow for UI testing.`,
    type: 'clarification',
    confidence_score: 0.5,
    suggestions: [
      'Switch to full mode for real testing',
      'Continue with mock for UI testing',
      'Tell me more about the application'
    ],
    extracted_requirements: {
      testing_mode: 'mock',
      user_input: user_input
    }
  }

  // Log mock progress event
  await supabaseIntegration.logProgressEvent({
    session_id,
    workspace_id: process.env.TEST_WORKSPACE_ID!,
    event_type: 'chat_message_mock',
    event_data: {
      user_input,
      response: mockResponse.response,
      mode: 'mock'
    }
  })

  return NextResponse.json(mockResponse)
}