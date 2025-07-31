/**
 * Claude Code SDK Cleanup API
 * Handles cleanup of Target App sandboxes and resources
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

    const { sessionId, saveArtifacts = true, cleanup = 'sandbox' } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Get Claude SDK instance
    const claudeSDK = getClaudeSDKInstance(supabase)

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'Session not found or access denied' 
      }, { status: 404 })
    }

    let savedFiles = []

    // Save artifacts if requested
    if (saveArtifacts) {
      try {
        const filesData = await claudeSDK.getGeneratedFiles(sessionId)
        
        if (filesData.files.length > 0) {
          // Store files in database for later retrieval
          const { error: filesError } = await supabase
            .from('generated_files')
            .upsert({
              session_id: sessionId,
              workspace_id: workspaceId,
              files: filesData.files,
              generated_at: filesData.timestamp,
              updated_at: new Date().toISOString()
            })

          if (filesError) {
            console.error('Failed to save generated files:', filesError)
          } else {
            savedFiles = filesData.files.map(f => f.path)
          }
        }
      } catch (error) {
        console.error('Failed to retrieve files for saving:', error)
      }
    }

    let cleanupResult = { success: false, message: '' }

    // Perform cleanup based on type
    if (cleanup === 'sandbox' || cleanup === 'all') {
      // Cleanup sandbox
      const sandboxCleanup = await claudeSDK.cleanupSession(sessionId)
      
      if (sandboxCleanup) {
        // Update session status in database
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            target_app_initialized: false,
            sandbox_id: null,
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .eq('workspace_id', workspaceId)

        // Update workflow session
        await supabase
          .from('workflow_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)

        cleanupResult = { 
          success: true, 
          message: 'Sandbox cleaned up successfully' 
        }
      } else {
        cleanupResult = { 
          success: false, 
          message: 'Failed to cleanup sandbox' 
        }
      }
    }

    // Additional cleanup for 'all' option
    if (cleanup === 'all') {
      try {
        // Archive interaction history (don't delete, just mark as archived)
        await supabase
          .from('claude_interactions')
          .update({ archived: true })
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)

        cleanupResult.message += ' and archived interaction history'
      } catch (error) {
        console.error('Failed to archive interaction history:', error)
      }
    }

    return NextResponse.json({
      success: cleanupResult.success,
      message: cleanupResult.message,
      sessionId,
      savedFiles: savedFiles.length,
      artifactsPaths: savedFiles,
      cleanupType: cleanup
    })

  } catch (error) {
    console.error('Cleanup failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Cleanup operation failed',
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

    // Get Claude SDK instance
    const claudeSDK = getClaudeSDKInstance(supabase)

    // Get active sessions
    const activeSessions = claudeSDK.getActiveSessions()

    // Get session information from database
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        id,
        project_name,
        created_at,
        last_activity,
        status,
        target_app_initialized,
        sandbox_id
      `)
      .eq('workspace_id', workspaceId)
      .eq('target_app_initialized', true)
      .in('status', ['active', 'paused'])

    if (error) {
      throw error
    }

    // Match database sessions with active sandboxes
    const sessionStatus = sessions?.map(session => ({
      ...session,
      sandboxActive: activeSessions.includes(session.id),
      canCleanup: true
    })) || []

    return NextResponse.json({
      success: true,
      activeSandboxes: activeSessions.length,
      sessions: sessionStatus,
      totalSessions: sessionStatus.length
    })

  } catch (error) {
    console.error('Failed to get cleanup status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get cleanup status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}