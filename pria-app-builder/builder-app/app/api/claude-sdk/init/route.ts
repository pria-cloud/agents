/**
 * Claude Code SDK Initialization API
 * Creates and initializes Target App sandbox with Claude Code SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { ClaudeSDKIntegrationService } from '@/lib/services/claude-sdk-integration'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = await createServerClient()
    
    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const { sessionId, initialRequirements, projectName } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Initialize Claude SDK Integration Service
    const claudeSDK = new ClaudeSDKIntegrationService({
      templateId: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2', // Our PRIA template
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      builderAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007',
      timeoutMs: 120000
    }, supabase)

    // Prepare initial context
    const initialContext = {
      sessionId,
      workspaceId,
      currentPhase: 1,
      subagentRole: 'requirements-analyst',
      requirements: initialRequirements || [],
      technicalSpecs: {},
      tasks: [],
      artifacts: {}
    }

    // Initialize Target App sandbox
    const { sandbox, sandboxId } = await claudeSDK.initializeTargetApp(
      sessionId,
      workspaceId,
      initialContext
    )

    // Update session record with sandbox information
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        sandbox_id: sandboxId,
        status: 'active',
        target_app_initialized: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)

    if (updateError) {
      console.error('Failed to update session:', updateError)
      // Continue anyway, as the sandbox is created
    }

    // Store initial workflow state
    const { error: workflowError } = await supabase
      .from('workflow_sessions')
      .upsert({
        session_id: sessionId,
        workspace_id: workspaceId,
        current_phase: 1,
        subagent_role: 'requirements-analyst',
        status: 'active',
        sandbox_id: sandboxId,
        created_at: new Date().toISOString()
      })

    if (workflowError) {
      console.error('Failed to create workflow session:', workflowError)
    }

    // Send initial welcome message to Claude Code SDK
    const welcomePrompt = `
Welcome to the PRIA Target App development environment! 

You are now operating as a requirements-analyst in Phase 1 of the PRIA development workflow.

Project Context:
- Project Name: ${projectName || 'New PRIA Application'}
- Session ID: ${sessionId}
- Workspace ID: ${workspaceId}
- Current Phase: Requirements Gathering
- Your Role: Requirements Analyst

Your responsibilities in this phase:
1. Engage in conversational discovery with stakeholders
2. Extract functional and non-functional requirements
3. Structure requirements with clear acceptance criteria
4. Validate business logic and constraints
5. Update .pria/requirements.json with your findings

The PRIA context system has been initialized. You can access:
- Current phase info: .pria/current-phase.json
- Session context: .pria/session-context.json
- Requirements (to be updated): .pria/requirements.json
- Subagent context: .pria/subagent-requirements-analyst.json

Please confirm you're ready and briefly describe how you'll approach the requirements gathering process for this project.
    `.trim()

    const welcomeResponse = await claudeSDK.executeClaudeCommand(
      sessionId,
      welcomePrompt,
      {
        maxTurns: 1,
        subagentRole: 'requirements-analyst',
        contextFiles: [
          '.pria/current-phase.json',
          '.pria/session-context.json',
          '.pria/subagent-requirements-analyst.json'
        ]
      }
    )

    return NextResponse.json({
      success: true,
      sessionId,
      sandboxId,
      targetAppUrl: `https://${sandbox.getHostname()}`,
      message: 'Target App initialized successfully',
      claudeResponse: welcomeResponse.message,
      ready: welcomeResponse.success
    })

  } catch (error) {
    console.error('Target App initialization failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize Target App',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}