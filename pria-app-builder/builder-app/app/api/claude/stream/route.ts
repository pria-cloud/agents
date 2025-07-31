import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { targetAppRegistry } from '@/lib/e2b/target-app-client'
import { validateChatMessage, checkRateLimit } from '@/lib/validation/input-sanitizer'
import { WorkflowManager } from '@/lib/workflow/workflow-manager'
import { SubagentWorkflowManager } from '@/lib/workflow/subagent-workflow-manager'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, options = {} } = await request.json()
    
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing sessionId or message' },
        { status: 400 }
      )
    }

    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(`chat:${clientIP}`, 20, 60000) // 20 requests per minute
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitCheck.resetTime 
        },
        { status: 429 }
      )
    }

    // Validate session ID format (should be UUID)
    if (typeof sessionId !== 'string' || !sessionId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      )
    }

    // Validate chat message
    const messageValidation = validateChatMessage(message)
    if (!messageValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid message content',
          details: messageValidation.errors 
        },
        { status: 400 }
      )
    }

    const sanitizedMessage = messageValidation.sanitized

    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get workspace_id from session using service role
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // First get the session to find the workspace_id
    const { data: session, error: sessionError } = await serviceSupabase
      .from('sessions')
      .select('id, workspace_id, target_directory, metadata')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const workspaceId = session.workspace_id

    // Verify user has access to this workspace
    const { data: memberCheck } = await serviceSupabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!memberCheck) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Initialize enhanced workflow management with subagent support
    const workflowManager = new SubagentWorkflowManager(sessionId)
    let workflowState = await workflowManager.getWorkflowState()
    
    // If no workflow exists, initialize it
    if (!workflowState) {
      const projectMetadata = {
        projectName: session.metadata?.projectName || 'Untitled Project',
        projectType: session.metadata?.projectType || 'medium',
        targetTechnology: 'Next.js + Supabase'
      }
      workflowState = await workflowManager.initializeWorkflow(projectMetadata)
    }

    // Get current phase and system prompt
    const currentPhase = await workflowManager.getCurrentPhase()
    const phaseSystemPrompt = await workflowManager.getCurrentPhasePrompt()
    
    // Check if user is requesting subagent delegation
    const useSubagents = options.useSubagents !== false // Default to true unless explicitly disabled
    const hasArtifactReferences = /@[a-zA-Z0-9-]+/.test(sanitizedMessage) // Check for @agent-name syntax

    // Store user message
    await serviceSupabase
      .from('chat_messages')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        role: 'user',
        content: sanitizedMessage,
        metadata: {
          timestamp: new Date().toISOString(),
          ...options
        }
      })

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: any) => {
          const eventData = `data: ${JSON.stringify({ type, ...data })}\n\n`
          controller.enqueue(encoder.encode(eventData))
        }

        try {
          console.log(`[STREAM API] Starting execution for session ${sessionId}`)
          sendEvent('start', { message: 'Starting Claude Code execution in Target App...' })

          // Use singleton E2B sandbox manager to preserve cache across requests
          console.log('[STREAM API] Getting singleton E2BSandboxManager...')
          const { E2BSandboxManager } = await import('@/lib/e2b/sandbox-manager')
          
          console.log('[STREAM API] Using singleton sandbox manager instance...')
          console.log('[STREAM API] Environment template ID:', process.env.E2B_TEMPLATE_ID)
          
          const templateId = process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2'
          console.log('[STREAM API] Using template ID:', templateId)
          
          const sandboxManager = E2BSandboxManager.getInstance({
            template: templateId,
            apiKey: process.env.E2B_API_KEY!
          })
          
          console.log('[STREAM API] Sandbox manager created successfully')
          sendEvent('command', { 
            message: 'Executing command in E2B sandbox...' 
          })

          // Execute command in E2B sandbox and stream responses
          let claudeResponse = ''
          let hasError = false

          try {
            console.log(`[STREAM API] Checking for existing sandbox for session ${sessionId}`)
            // Check if sandbox exists, create if needed
            let environment = await sandboxManager.getSandbox(sessionId)
            console.log(`[STREAM API] getSandbox result:`, environment ? `Found environment with status: ${environment.status}` : 'No environment found')
            
            if (!environment || environment.status !== 'ready') {
              console.log(`[STREAM API] Creating new sandbox for session ${sessionId}`)
              sendEvent('message_chunk', {
                content: 'Creating E2B sandbox...\n',
                role: 'assistant'
              })
              
              const startTime = Date.now()
              environment = await sandboxManager.createSandbox(sessionId, { workspaceId })
              const duration = Date.now() - startTime
              console.log(`[STREAM API] Sandbox creation completed in ${duration}ms`)
              
              claudeResponse += 'E2B sandbox created successfully.\n'
              sendEvent('message_chunk', {
                content: 'E2B sandbox created successfully.\n',
                role: 'assistant'
              })
            } else {
              console.log(`[STREAM API] Using existing sandbox: ${environment.id}`)
              sendEvent('message_chunk', {
                content: 'Using existing E2B sandbox...\n',
                role: 'assistant'
              })
              claudeResponse += 'Using existing E2B sandbox.\n'
            }

            // Execute command using Claude Code SDK in the E2B sandbox
            console.log(`[STREAM API] Processing message: "${sanitizedMessage}"`)
            sendEvent('message_chunk', {
              content: 'Executing command in Claude Code SDK...\n',
              role: 'assistant'
            })

            // Determine if this looks like a shell command or a Claude Code request
            const isShellCommand = /^(ls|cat|pwd|cd|npm|node|echo|mkdir|rm|cp|mv|grep|find|which|whoami)/.test(sanitizedMessage.trim())
            console.log(`[STREAM API] Message type: ${isShellCommand ? 'SHELL_COMMAND' : 'CLAUDE_PROMPT'}`)
            
            if (isShellCommand) {
              try {
                console.log(`[STREAM API] Executing shell command: ${sanitizedMessage}`)
                const cmdStartTime = Date.now()
                
                // Execute shell command in the E2B sandbox
                const commandResult = await sandboxManager.executeCommand(sessionId, sanitizedMessage, {
                  cwd: environment.workingDirectory
                })
                
                const cmdDuration = Date.now() - cmdStartTime
                console.log(`[STREAM API] Command executed in ${cmdDuration}ms`)
                console.log(`[STREAM API] Command result - stdout:`, commandResult.stdout)
                console.log(`[STREAM API] Command result - stderr:`, commandResult.stderr)
                console.log(`[STREAM API] Command result - exitCode:`, commandResult.exitCode)

                const commandResponse = `$ ${sanitizedMessage}\n${commandResult.stdout || '(no output)'}\n${commandResult.stderr ? `Error: ${commandResult.stderr}\n` : ''}`
                
                claudeResponse += commandResponse
                sendEvent('message_chunk', {
                  content: commandResponse,
                  role: 'assistant'
                })

              } catch (cmdError) {
                console.error(`[STREAM API] Command execution failed:`, cmdError)
                const errorResponse = `$ ${sanitizedMessage}\nCommand failed: ${cmdError instanceof Error ? cmdError.message : 'Unknown error'}\n\nTry basic commands like: ls, pwd, cat package.json`
                
                claudeResponse += errorResponse
                sendEvent('message_chunk', {
                  content: errorResponse,
                  role: 'assistant'
                })
              }
            } else {
              console.log(`[STREAM API] Processing Claude Code prompt: "${sanitizedMessage}"`)
              try {
                // Use Claude SDK executor that runs inside the sandbox
                const { ClaudeSandboxExecutor } = await import('@/lib/e2b/claude-sandbox-executor')
                const claudeExecutor = new ClaudeSandboxExecutor(sandboxManager)
                
                // Determine if we should use subagent delegation
                let claudeResult: any
                
                if (useSubagents && currentPhase) {
                  console.log(`[STREAM API] Using subagent delegation for Phase ${currentPhase.number}`)
                  sendEvent('message_chunk', {
                    content: `Delegating to specialized subagent for Phase ${currentPhase?.number || 1}: ${currentPhase?.name || 'Requirements Gathering'}...\n`,
                    role: 'assistant'
                  })
                  
                  // Get the appropriate sub-agent for this phase
                  const subAgentName = workflowManager.getPhaseAgent(currentPhase.number)
                  console.log(`[STREAM API] Using sub-agent: ${subAgentName}`)
                  
                  // Send progress updates during subagent execution  
                  const subagentProgressInterval = setInterval(() => {
                    sendEvent('message_chunk', {
                      content: `⏳ ${subAgentName} is analyzing your request...\n`,
                      role: 'assistant'
                    })
                  }, 15000) // Every 15 seconds
                  
                  try {
                    // Execute with sub-agent inside the sandbox
                    claudeResult = await claudeExecutor.executeWithSubAgent(
                      sessionId,
                      sanitizedMessage,
                      subAgentName,
                      {
                        workingDirectory: environment.workingDirectory,
                        maxTurns: 10,
                        preserveContext: true
                      }
                    )
                  } finally {
                    clearInterval(subagentProgressInterval)
                  }
                  
                  if (claudeResult.success) {
                    // Send subagent delegation success notification
                    sendEvent('subagent_executed', {
                      agentName: subAgentName,
                      phase: currentPhase.number,
                      duration: claudeResult.duration,
                      artifactCount: claudeResult.artifacts?.length || 0
                    })
                    
                    console.log(`[STREAM API] Subagent execution completed in ${claudeResult.duration}ms`)
                  } else {
                    console.warn(`[STREAM API] Subagent delegation failed: ${claudeResult.error}`)
                    sendEvent('message_chunk', {
                      content: `Subagent delegation failed, falling back to direct execution...\n`,
                      role: 'assistant'
                    })
                  }
                } 
                
                // If not using subagents or subagent failed, use direct Claude execution
                if (!claudeResult || !claudeResult.success) {
                  console.log(`[STREAM API] Using direct Claude Code SDK execution`)
                  sendEvent('message_chunk', {
                    content: `Running Claude Code SDK (Phase ${currentPhase?.number || 1}: ${currentPhase?.name || 'Requirements Gathering'})...\n`,
                    role: 'assistant'
                  })
                  
                  // Prepare the full prompt with workflow context
                  let fullPrompt = sanitizedMessage
                  if (phaseSystemPrompt) {
                    fullPrompt = `${phaseSystemPrompt}\n\n---\n\nUser Request: ${sanitizedMessage}`
                    console.log(`[STREAM API] Using Phase ${currentPhase?.number} system prompt`)
                  }
                  
                  // Send progress updates during Claude execution
                  const progressInterval = setInterval(() => {
                    sendEvent('message_chunk', {
                      content: '⏳ Claude Code is processing your request...\n',
                      role: 'assistant'
                    })
                  }, 15000) // Every 15 seconds
                  
                  try {
                    claudeResult = await claudeExecutor.executeClaudeInSandbox({
                      sessionId,
                      prompt: fullPrompt,
                      workingDirectory: environment.workingDirectory,
                      maxTurns: 10
                    })
                  } finally {
                    clearInterval(progressInterval)
                  }
                }
                
                console.log(`[STREAM API] Claude Code execution completed in ${claudeResult.duration}ms`)
                console.log(`[STREAM API] Claude response length: ${claudeResult.response.length} characters`)
                
                // Stream the Claude response
                if (claudeResult.success) {
                  claudeResponse += claudeResult.response
                  sendEvent('message_chunk', {
                    content: claudeResult.response,
                    role: 'assistant'
                  })
                } else {
                  const errorMsg = `Error: ${claudeResult.error || 'Claude execution failed'}\n`
                  claudeResponse += errorMsg
                  sendEvent('message_chunk', {
                    content: errorMsg,
                    role: 'assistant'
                  })
                }

                // Update workflow progress based on response (only if not using subagents)
                if (!useSubagents && currentPhase && claudeResult.response.length > 100) {
                  // Increment progress for substantial responses
                  const currentProgress = currentPhase.progress || 0
                  const incrementAmount = Math.min(10, 100 - currentProgress) // Max 10 points per interaction
                  await workflowManager.updatePhaseProgress(currentProgress + incrementAmount)
                  
                  console.log(`[STREAM API] Updated Phase ${currentPhase.number} progress: ${currentProgress} -> ${currentProgress + incrementAmount}`)
                }

                // Phase-specific processing (only for non-subagent execution)
                // Note: Subagent execution handles extraction automatically
                if (!useSubagents && currentPhase?.number === 1) {
                  // Requirements Gathering Phase - Extract requirements automatically
                  console.log(`[STREAM API] Phase 1: Extracting requirements from conversation`)
                  try {
                    const { RequirementsExtractor } = await import('@/lib/requirements/requirements-extractor')
                    const extractedRequirements = RequirementsExtractor.extractFromText(
                      claudeResult.response,
                      { 
                        workflow_phase: currentPhase.number, 
                        session_id: sessionId,
                        workspace_id: workspaceId
                      }
                    )

                    // Store extracted requirements
                    if (extractedRequirements.length > 0) {
                      const { data: insertedReqs } = await serviceSupabase
                        .from('requirements')
                        .insert(extractedRequirements.map(req => ({
                          ...req,
                          workspace_id: workspaceId,
                          session_id: sessionId
                        })))
                        .select()

                      console.log(`[STREAM API] Extracted and stored ${extractedRequirements.length} requirements`)
                      
                      sendEvent('requirements_extracted', {
                        count: extractedRequirements.length,
                        requirements: insertedReqs
                      })
                    }
                  } catch (reqError) {
                    console.warn(`[STREAM API] Failed to extract requirements:`, reqError)
                  }
                } else if (!useSubagents && currentPhase?.number === 2) {
                  // Architecture & Technical Design Phase - Extract technical specifications
                  console.log(`[STREAM API] Phase 2: Extracting technical specifications from architecture analysis`)
                  try {
                    const { TechnicalSpecsExtractor } = await import('@/lib/technical-specs/tech-specs-extractor')
                    const extractedSpecs = TechnicalSpecsExtractor.extractFromText(
                      claudeResult.response,
                      { 
                        workflow_phase: currentPhase.number, 
                        session_id: sessionId,
                        workspace_id: workspaceId
                      }
                    )

                    // Store extracted technical specifications
                    if (extractedSpecs.length > 0) {
                      const { data: insertedSpecs } = await serviceSupabase
                        .from('technical_specs')
                        .insert(extractedSpecs.map(spec => ({
                          ...spec,
                          workspace_id: workspaceId,
                          session_id: sessionId
                        })))
                        .select()

                      console.log(`[STREAM API] Extracted and stored ${extractedSpecs.length} technical specifications`)
                      
                      sendEvent('technical_specs_extracted', {
                        count: extractedSpecs.length,
                        specifications: insertedSpecs
                      })

                      // Check for PRIA compliance issues
                      const nonCompliantSpecs = extractedSpecs.filter(spec => !spec.metadata.pria_compliance)
                      if (nonCompliantSpecs.length > 0) {
                        sendEvent('pria_compliance_warning', {
                          message: `${nonCompliantSpecs.length} specifications may not be PRIA-compliant`,
                          non_compliant_specs: nonCompliantSpecs.map(spec => spec.title)
                        })
                      }
                    }
                  } catch (specError) {
                    console.warn(`[STREAM API] Failed to extract technical specifications:`, specError)
                  }
                } else if (!useSubagents && currentPhase?.number === 3) {
                  // Implementation Planning Phase - Extract development tasks, sprints, and milestones
                  console.log(`[STREAM API] Phase 3: Extracting implementation plan from planning analysis`)
                  try {
                    const { TaskExtractor } = await import('@/lib/tasks/task-extractor')
                    
                    // Get requirements and technical specs for context
                    const { data: requirements } = await serviceSupabase
                      .from('requirements')
                      .select('*')
                      .eq('session_id', sessionId)
                      .eq('workspace_id', workspaceId)

                    const { data: technicalSpecs } = await serviceSupabase
                      .from('technical_specs')
                      .select('*')
                      .eq('session_id', sessionId)
                      .eq('workspace_id', workspaceId)

                    const extractedPlan = TaskExtractor.extractFromText(
                      claudeResult.response,
                      { 
                        workflow_phase: currentPhase.number, 
                        session_id: sessionId,
                        workspace_id: workspaceId,
                        requirements: requirements || [],
                        technical_specs: technicalSpecs || []
                      }
                    )

                    let totalInserted = 0

                    // Store extracted development tasks
                    if (extractedPlan.tasks.length > 0) {
                      const { data: insertedTasks } = await serviceSupabase
                        .from('development_tasks')
                        .insert(extractedPlan.tasks.map(task => ({
                          ...task,
                          workspace_id: workspaceId,
                          session_id: sessionId
                        })))
                        .select()

                      totalInserted += extractedPlan.tasks.length
                      console.log(`[STREAM API] Extracted and stored ${extractedPlan.tasks.length} development tasks`)
                      
                      sendEvent('tasks_extracted', {
                        count: extractedPlan.tasks.length,
                        tasks: insertedTasks
                      })
                    }

                    // Store extracted sprints
                    if (extractedPlan.sprints.length > 0) {
                      const { data: insertedSprints } = await serviceSupabase
                        .from('sprints')
                        .insert(extractedPlan.sprints.map(sprint => ({
                          ...sprint,
                          workspace_id: workspaceId,
                          session_id: sessionId
                        })))
                        .select()

                      totalInserted += extractedPlan.sprints.length
                      console.log(`[STREAM API] Extracted and stored ${extractedPlan.sprints.length} sprints`)
                      
                      sendEvent('sprints_extracted', {
                        count: extractedPlan.sprints.length,
                        sprints: insertedSprints
                      })
                    }

                    // Store extracted milestones
                    if (extractedPlan.milestones.length > 0) {
                      const { data: insertedMilestones } = await serviceSupabase
                        .from('milestones')
                        .insert(extractedPlan.milestones.map(milestone => ({
                          ...milestone,
                          workspace_id: workspaceId,
                          session_id: sessionId
                        })))
                        .select()

                      totalInserted += extractedPlan.milestones.length
                      console.log(`[STREAM API] Extracted and stored ${extractedPlan.milestones.length} milestones`)
                      
                      sendEvent('milestones_extracted', {
                        count: extractedPlan.milestones.length,
                        milestones: insertedMilestones
                      })
                    }

                    // Send comprehensive planning summary
                    if (totalInserted > 0) {
                      sendEvent('implementation_plan_extracted', {
                        total_items: totalInserted,
                        tasks: extractedPlan.tasks.length,
                        sprints: extractedPlan.sprints.length,
                        milestones: extractedPlan.milestones.length,
                        critical_path_tasks: extractedPlan.tasks.filter(t => t.metadata.critical_path).length,
                        estimated_total_hours: extractedPlan.tasks.reduce((sum, t) => sum + t.estimated_hours, 0)
                      })
                    }

                    // Check for high-risk tasks
                    const highRiskTasks = extractedPlan.tasks.filter(task => task.metadata.risk_level === 'high')
                    if (highRiskTasks.length > 0) {
                      sendEvent('high_risk_tasks_identified', {
                        message: `${highRiskTasks.length} high-risk tasks identified that may need special attention`,
                        high_risk_tasks: highRiskTasks.map(task => task.title)
                      })
                    }

                  } catch (planError) {
                    console.warn(`[STREAM API] Failed to extract implementation plan:`, planError)
                  }
                }

              } catch (claudeError) {
                console.error(`[STREAM API] Claude Code execution failed:`, claudeError)
                const errorResponse = `Claude Code execution failed: ${claudeError instanceof Error ? claudeError.message : 'Unknown error'}\n\nThe error might be due to:\n- Claude Code SDK not properly installed\n- Missing API key configuration\n- Network connectivity issues\n\nTry basic shell commands like \`ls\` or \`pwd\` to test the sandbox.`
                
                claudeResponse += errorResponse
                sendEvent('message_chunk', {
                  content: errorResponse,
                  role: 'assistant'
                })
              }
            }

          } catch (error) {
            console.error(`[STREAM API] Major error in sandbox execution:`, error)
            hasError = true
            claudeResponse = `Error executing command in E2B sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`
            sendEvent('error', { error: claudeResponse })
          }

          // If no content was received, provide a default response
          if (!claudeResponse.trim()) {
            claudeResponse = hasError 
              ? 'I encountered an error while processing your request.'
              : 'Command executed successfully in Target App.'
          }

          // Store Claude response
          const responseData = await serviceSupabase
            .from('chat_messages')
            .insert({
              workspace_id: workspaceId,
              session_id: sessionId,
              role: 'assistant',
              content: claudeResponse,
              metadata: {
                timestamp: new Date().toISOString(),
                source: 'target-app-claude-sdk',
                has_error: hasError,
                workflow_phase: currentPhase?.number,
                workflow_phase_name: currentPhase?.name,
                used_system_prompt: !!phaseSystemPrompt
              }
            })
            .select()
            .single()

          // Store operation record
          await serviceSupabase
            .from('claude_operations')
            .insert({
              workspace_id: workspaceId,
              session_id: sessionId,
              operation_type: 'stream_chat',
              status: hasError ? 'failed' : 'completed',
              input_data: {
                message: sanitizedMessage,
                options
              },
              output_data: {
                response: claudeResponse,
                source: 'target-app-claude-sdk'
              },
              completed_at: new Date().toISOString()
            })

          console.log(`[STREAM API] Preparing final response (${claudeResponse.length} characters)`)
          
          // Send final response
          sendEvent('message', {
            content: claudeResponse,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            metadata: {
              source: 'target-app-claude-sdk',
              session_id: sessionId,
              workflow_phase: currentPhase?.number,
              workflow_phase_name: currentPhase?.name,
              workflow_progress: currentPhase?.progress,
              used_system_prompt: !!phaseSystemPrompt
            }
          })

          // Check for file changes after command execution
          try {
            console.log(`[STREAM API] Getting project state for file changes...`)
            const projectState = await sandboxManager.getProjectState(sessionId)
            console.log(`[STREAM API] Project state retrieved - ${projectState.files.length} files`)
            sendEvent('project_update', {
              files: projectState.files,
              status: projectState.status
            })
          } catch (error) {
            console.warn('[STREAM API] Failed to get project state:', error)
          }

          console.log(`[STREAM API] Execution completed successfully for session ${sessionId}`)
          sendEvent('done', { message: 'Claude Code execution completed' })

        } catch (error) {
          console.error('Stream error:', error)
          
          // Store error message
          await serviceSupabase
            .from('chat_messages')
            .insert({
              workspace_id: workspaceId,
              session_id: sessionId,
              role: 'assistant',
              content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              metadata: {
                timestamp: new Date().toISOString(),
                error: true
              }
            })

          sendEvent('error', { 
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Stream API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}