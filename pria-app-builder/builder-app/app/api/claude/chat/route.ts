import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { WorkflowManager } from '@/lib/workflow/workflow-manager'
import { E2BSandboxManager } from '@/lib/e2b/sandbox-manager-simple'
import { RequirementsExtractor } from '@/lib/requirements/requirements-extractor'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, options = {} } = await request.json()
    
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing sessionId or message' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use service role to bypass RLS for now
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get session to get workspace_id
    const { data: session, error: sessionError } = await serviceSupabase
      .from('sessions')
      .select('workspace_id, target_directory, metadata')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Initialize workflow if not already initialized
    const workflowManager = new WorkflowManager(sessionId)
    let workflowState = await workflowManager.getWorkflowState()
    
    if (!workflowState) {
      // Initialize workflow with default project metadata
      workflowState = await workflowManager.initializeWorkflow({
        projectName: `PRIA App ${sessionId.slice(0, 8)}`,
        projectType: 'medium',
        targetTechnology: 'Next.js + Supabase'
      })
    }

    // Get current phase and system prompt
    const currentPhase = await workflowManager.getCurrentPhase()
    const systemPrompt = await workflowManager.getCurrentPhasePrompt()

    // Save user message to database
    await serviceSupabase
      .from('chat_messages')
      .insert({
        workspace_id: session.workspace_id,
        session_id: sessionId,
        role: 'user',
        content: message,
        metadata: { 
          ...options,
          workflow_phase: currentPhase?.number,
          workflow_phase_name: currentPhase?.name
        }
      })

    let assistantResponse: string
    let responseMetadata: any = {}

    try {
      // Prepare the full prompt with system context
      const fullPrompt = systemPrompt ? 
        `${systemPrompt}\n\n---\n\nUser Request: ${message}` : 
        message

      // Execute Claude command via E2B sandbox
      const sandboxManager = new E2BSandboxManager()

      console.log(`[CHAT API] Executing Claude Code SDK for session ${sessionId}`)
      const claudeResult = await sandboxManager.executeClaudeCommand(sessionId, fullPrompt, {
        workspaceId: session.workspace_id,
        phase: currentPhase?.number,
        requirements: existingRequirements || [],
        maxTurns: 10
      })
      
      assistantResponse = claudeResult.response || 'No response received from Claude'
      responseMetadata = {
        workflow_phase: currentPhase?.number,
        workflow_phase_name: currentPhase?.name,
        execution_time: claudeResult.duration,
        claude_executed: true,
        claude_artifacts: claudeResult.artifacts?.length || 0,
        files_modified: claudeResult.filesModified?.length || 0,
        tool_use_count: claudeResult.toolUse?.length || 0
      }

      // Load existing requirements for context
      const { data: existingRequirements, error: reqLoadError } = await serviceSupabase
        .from('requirements')
        .select('*')
        .eq('session_id', sessionId)
        .eq('workspace_id', session.workspace_id)
        .order('created_at', { ascending: true })

      if (reqLoadError) {
        console.error('[CHAT API] Failed to load existing requirements:', reqLoadError)
      }

      // Extract requirements from Claude response
      let extractedRequirements: any[] = []
      try {
        console.log(`[CHAT API] Extracting requirements from Claude response...`)
        console.log(`[CHAT API] Found ${existingRequirements?.length || 0} existing requirements for context`)
        
        const extractionResult = RequirementsExtractor.extractFromText(
          assistantResponse,
          {
            workflow_phase: currentPhase?.number,
            session_id: sessionId,
            previous_requirements: existingRequirements || []
          }
        )

        if (extractionResult.requirements.length > 0) {
          console.log(`[CHAT API] Found ${extractionResult.requirements.length} potential requirements`)
          
          // Save extracted requirements to database
          for (const req of extractionResult.requirements) {
            try {
              const { data: savedReq, error: reqError } = await serviceSupabase
                .from('requirements')
                .insert({
                  session_id: sessionId,
                  workspace_id: session.workspace_id,
                  title: req.title,
                  description: req.description,
                  type: req.type,
                  priority: req.priority,
                  category: req.category,
                  acceptance_criteria: req.acceptance_criteria,
                  user_story: req.user_story,
                  business_value: req.business_value,
                  complexity: req.complexity,
                  workflow_phase: currentPhase?.number || 1,
                  discovered_by: 'claude',
                  last_updated_by: 'claude',
                  source: 'chat_response',
                  status: 'new',
                  metadata: {
                    extraction_confidence: req.confidence,
                    source_text: req.source_text,
                    extracted_at: new Date().toISOString()
                  }
                })
                .select()
                .single()

              if (!reqError && savedReq) {
                extractedRequirements.push(savedReq)
                console.log(`[CHAT API] Saved requirement: ${req.title}`)
              }
            } catch (reqSaveError) {
              console.error(`[CHAT API] Failed to save requirement:`, reqSaveError)
            }
          }

          responseMetadata.extracted_requirements = extractedRequirements.length
          responseMetadata.requirements_extraction = extractionResult.metadata
        }
      } catch (extractionError) {
        console.error('[CHAT API] Requirements extraction failed:', extractionError)
        responseMetadata.requirements_extraction_error = extractionError instanceof Error ? extractionError.message : 'Unknown error'
      }

      // Analyze response for workflow progress (enhanced with requirements)
      let progressIncrease = 0
      if (assistantResponse.length > 500) {
        progressIncrease += 10 // Substantial response
      }
      if (extractedRequirements.length > 0) {
        progressIncrease += extractedRequirements.length * 5 // Requirements discovered
      }
      if (progressIncrease > 0) {
        const currentProgress = currentPhase?.progress || 0
        const newProgress = Math.min(90, currentProgress + progressIncrease) // Max 90% until quality gate
        await workflowManager.updatePhaseProgress(newProgress, extractedRequirements)
      }

      // Check for phase completion indicators
      if (assistantResponse.toLowerCase().includes('complete') || 
          assistantResponse.toLowerCase().includes('finished') ||
          assistantResponse.toLowerCase().includes('ready for next phase')) {
        await workflowManager.passQualityGate()
        responseMetadata.quality_gate_passed = true
      }

    } catch (claudeError) {
      console.error('[CHAT API] Claude execution failed:', claudeError)
      
      // Fallback to basic response with workflow context
      assistantResponse = currentPhase ? 
        `I'm ready to help you with **${currentPhase.name}** (Phase ${currentPhase.number}/7).

${currentPhase.description}

However, I encountered an issue executing your request via the E2B sandbox. Please try again or rephrase your request.

Error: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}` :
        `Welcome to PRIA! I'm ready to help you build your application. Let me initialize the workflow for your project.

Please tell me about what you'd like to build, and I'll guide you through a structured development process.`

      responseMetadata = {
        workflow_phase: currentPhase?.number || 1,
        workflow_phase_name: currentPhase?.name || 'Requirements Gathering',
        claude_executed: false,
        error: claudeError instanceof Error ? claudeError.message : 'Unknown error'
      }
    }

    // Save assistant response
    await serviceSupabase
      .from('chat_messages')
      .insert({
        workspace_id: session.workspace_id,
        session_id: sessionId,
        role: 'assistant',
        content: assistantResponse,
        metadata: responseMetadata
      })

    // Get updated workflow state
    const updatedWorkflowState = await workflowManager.getWorkflowState()

    return NextResponse.json({ 
      message: assistantResponse,
      metadata: responseMetadata,
      workflow: {
        currentPhase: currentPhase,
        state: updatedWorkflowState,
        canAdvance: await workflowManager.canAdvanceToNextPhase()
      }
    })

  } catch (error) {
    console.error('[CHAT API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter' },
      { status: 400 }
    )
  }

  try {
    // Use service role to bypass RLS
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get chat messages for session
    const { data: messages, error } = await serviceSupabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}