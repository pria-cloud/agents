/**
 * Claude Code SDK Context Synchronization API
 * Handles bidirectional context sync between Builder App and Target App
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { ClaudeSDKIntegrationService } from '@/lib/services/claude-sdk-integration'

// Store active Claude SDK instances
const claudeSDKInstances = new Map<string, ClaudeSDKIntegrationService>()

function getClaudeSDKInstance(supabase: any): ClaudeSDKIntegrationService {
  const instanceKey = 'default'
  
  if (!claudeSDKInstances.has(instanceKey)) {
    const instance = new ClaudeSDKIntegrationService({
      templateId: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      builderAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007',
      timeoutMs: 120000
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

    const { sessionId, direction = 'to_target', contextData } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get Claude SDK instance
    const claudeSDK = getClaudeSDKInstance(supabase)

    if (direction === 'to_target') {
      // Sync context from Builder App to Target App
      await claudeSDK.syncContextToTargetApp(sessionId, contextData)
      
      return NextResponse.json({
        success: true,
        message: 'Context synchronized to Target App',
        direction: 'to_target'
      })

    } else if (direction === 'from_target') {
      // Get context from Target App and update Builder App
      const sandbox = claudeSDK.getSandbox(sessionId)
      if (!sandbox) {
        return NextResponse.json({ 
          error: 'No active sandbox found' 
        }, { status: 404 })
      }

      // Read context files from Target App
      try {
        const [
          currentPhaseContent,
          requirementsContent,
          techSpecsContent,
          tasksContent,
          artifactsContent,
          progressContent
        ] = await Promise.all([
          sandbox.filesystem.readTextFile('.pria/current-phase.json').catch(() => '{}'),
          sandbox.filesystem.readTextFile('.pria/requirements.json').catch(() => '{}'),
          sandbox.filesystem.readTextFile('.pria/technical-specs.json').catch(() => '{}'),
          sandbox.filesystem.readTextFile('.pria/tasks.json').catch(() => '{}'),
          sandbox.filesystem.readTextFile('.pria/artifacts.json').catch(() => '{}'),
          sandbox.filesystem.readTextFile('.pria/progress-tracking.json').catch(() => '{}')
        ])

        const currentPhase = JSON.parse(currentPhaseContent)
        const requirements = JSON.parse(requirementsContent)
        const techSpecs = JSON.parse(techSpecsContent)
        const tasks = JSON.parse(tasksContent)
        const artifacts = JSON.parse(artifactsContent)
        const progress = JSON.parse(progressContent)

        // Update Builder App database with Target App context
        const updates = []

        // Update workflow session
        if (currentPhase.phase && currentPhase.subagent) {
          updates.push(
            supabase
              .from('workflow_sessions')
              .update({
                current_phase: currentPhase.phase,
                subagent_role: currentPhase.subagent,
                updated_at: new Date().toISOString()
              })
              .eq('session_id', sessionId)
              .eq('workspace_id', workspaceId)
          )
        }

        // Update requirements if they exist
        if (requirements.requirements && requirements.requirements.length > 0) {
          for (const req of requirements.requirements) {
            updates.push(
              supabase
                .from('requirements')
                .upsert({
                  ...req,
                  session_id: sessionId,
                  workspace_id: workspaceId,
                  updated_at: new Date().toISOString()
                })
            )
          }
        }

        // Update technical specifications
        if (techSpecs.specifications) {
          updates.push(
            supabase
              .from('technical_specifications')
              .upsert({
                session_id: sessionId,
                workspace_id: workspaceId,
                specifications: techSpecs.specifications,
                architecture: techSpecs.architecture,
                updated_at: new Date().toISOString()
              })
          )
        }

        // Update tasks
        if (tasks.tasks && tasks.tasks.length > 0) {
          for (const task of tasks.tasks) {
            updates.push(
              supabase
                .from('implementation_tasks')
                .upsert({
                  ...task,
                  session_id: sessionId,
                  workspace_id: workspaceId,
                  updated_at: new Date().toISOString()
                })
            )
          }
        }

        // Update artifacts
        if (artifacts.artifacts) {
          updates.push(
            supabase
              .from('workflow_artifacts')
              .upsert({
                session_id: sessionId,
                workspace_id: workspaceId,
                artifacts: artifacts.artifacts,
                updated_at: new Date().toISOString()
              })
          )
        }

        // Execute all updates
        await Promise.all(updates)

        return NextResponse.json({
          success: true,
          message: 'Context synchronized from Target App',
          direction: 'from_target',
          context: {
            currentPhase: currentPhase.phase,
            subagentRole: currentPhase.subagent,
            requirementsCount: requirements.requirements?.length || 0,
            tasksCount: tasks.tasks?.length || 0,
            artifactsCount: Object.keys(artifacts.artifacts || {}).length,
            lastSync: new Date().toISOString()
          }
        })

      } catch (error) {
        console.error('Failed to read Target App context:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to read context from Target App'
        }, { status: 500 })
      }

    } else {
      return NextResponse.json({ 
        error: 'Invalid direction. Use "to_target" or "from_target"' 
      }, { status: 400 })
    }

  } catch (error) {
    console.error('Context synchronization failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Context synchronization failed',
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

    // Get sync status
    const sandbox = claudeSDK.getSandbox(sessionId)
    const isActive = !!sandbox

    // Get last sync information from database
    const { data: lastInteraction } = await supabase
      .from('claude_interactions')
      .select('created_at')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      success: true,
      sessionId,
      status: {
        sandboxActive: isActive,
        lastInteraction: lastInteraction?.created_at,
        activeSessions: claudeSDK.getActiveSessions().length
      }
    })

  } catch (error) {
    console.error('Failed to get sync status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get synchronization status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}