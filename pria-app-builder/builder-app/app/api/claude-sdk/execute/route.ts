/**
 * Claude Code SDK Execution API
 * Executes commands in the Target App sandbox with context synchronization
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { ClaudeSDKIntegrationService } from '@/lib/services/claude-sdk-integration'

// Store active Claude SDK instances (in production, use Redis or similar)
const claudeSDKInstances = new Map<string, ClaudeSDKIntegrationService>()

function getClaudeSDKInstance(supabase: any): ClaudeSDKIntegrationService {
  const instanceKey = 'default' // In production, use workspace-specific keys
  
  if (!claudeSDKInstances.has(instanceKey)) {
    const instance = new ClaudeSDKIntegrationService({
      templateId: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      timeoutMs: 300000 // 5 minutes for code generation
    }, supabase)
    
    claudeSDKInstances.set(instanceKey, instance)
  }
  
  return claudeSDKInstances.get(instanceKey)!
}

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

    const { 
      sessionId, 
      prompt, 
      maxTurns = 1,
      syncContext = true,
      contextFiles = [],
      includeArtifacts = true
    } = await request.json()

    if (!sessionId || !prompt) {
      return NextResponse.json({ 
        error: 'Session ID and prompt are required' 
      }, { status: 400 })
    }

    // Get Claude SDK instance
    const claudeSDK = getClaudeSDKInstance(supabase)

    // Get current session info
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 })
    }

    // Get current workflow state
    const { data: workflowSession } = await supabase
      .from('workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    // Sync context if requested
    if (syncContext && workflowSession) {
      // Get latest requirements
      const { data: requirements } = await supabase
        .from('requirements')
        .select('*')
        .eq('session_id', sessionId)
        .eq('workspace_id', workspaceId)

      // Get latest technical specs
      const { data: techSpecs } = await supabase
        .from('technical_specifications')
        .select('*')
        .eq('session_id', sessionId)
        .eq('workspace_id', workspaceId)

      // Get latest tasks
      const { data: tasks } = await supabase
        .from('implementation_tasks')
        .select('*')
        .eq('session_id', sessionId)
        .eq('workspace_id', workspaceId)

      // Get artifacts if requested
      let artifacts = {}
      if (includeArtifacts) {
        const { data: artifactData } = await supabase
          .from('workflow_artifacts')
          .select('artifacts')
          .eq('session_id', sessionId)
          .single()
        
        artifacts = artifactData?.artifacts || {}
      }

      // Sync context to Target App
      await claudeSDK.syncContextToTargetApp(sessionId, {
        sessionId,
        workspaceId,
        currentPhase: workflowSession.current_phase,
        subagentRole: workflowSession.subagent_role,
        requirements: requirements || [],
        technicalSpecs: techSpecs?.[0] || {},
        tasks: tasks || [],
        artifacts
      })
    }

    // Execute Claude Code SDK command
    const response = await claudeSDK.executeClaudeCommand(
      sessionId,
      prompt,
      {
        maxTurns,
        subagentRole: workflowSession?.subagent_role,
        contextFiles,
        artifacts: includeArtifacts ? Object.keys(workflowSession?.artifacts || {}) : []
      }
    )

    // Update session activity
    await supabase
      .from('sessions')
      .update({
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)

    // Store the interaction for history
    const { error: historyError } = await supabase
      .from('claude_interactions')
      .insert({
        session_id: sessionId,
        workspace_id: workspaceId,
        prompt,
        response: response.message,
        success: response.success,
        artifacts: response.artifacts,
        phase: workflowSession?.current_phase,
        subagent_role: workflowSession?.subagent_role,
        created_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('Failed to store interaction history:', historyError)
    }

    return NextResponse.json({
      success: response.success,
      message: response.message,
      artifacts: response.artifacts,
      progress: response.progress,
      error: response.error,
      logs: response.logs,
      phase: workflowSession?.current_phase,
      subagentRole: workflowSession?.subagent_role
    })

  } catch (error) {
    console.error('Claude SDK execution failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to execute Claude Code SDK command',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get Claude SDK instance
    const claudeSDK = getClaudeSDKInstance(supabase)

    // Get generated files from Target App
    const filesData = await claudeSDK.getGeneratedFiles(sessionId)

    return NextResponse.json({
      success: true,
      files: filesData.files,
      timestamp: filesData.timestamp,
      totalFiles: filesData.files.length
    })

  } catch (error) {
    console.error('Failed to get generated files:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve generated files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}