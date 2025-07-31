import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { targetAppRegistry } from '@/lib/e2b/target-app-client'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const action = searchParams.get('action')
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter' },
      { status: 400 }
    )
  }

  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, target_directory, status')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get Target App client
    const targetAppClient = targetAppRegistry.getClient(sessionId)

    // Handle specific actions
    if (action === 'get_file_content') {
      const filePath = searchParams.get('filePath')
      if (!filePath) {
        return NextResponse.json(
          { error: 'Missing filePath parameter' },
          { status: 400 }
        )
      }

      try {
        // Get file content from Target App via E2B
        const fileContentResult = await targetAppClient.getFileContent(filePath)
        
        return NextResponse.json({
          content: fileContentResult.content || '',
          exists: fileContentResult.exists || false,
          path: filePath,
          size: fileContentResult.size || 0,
          lastModified: fileContentResult.lastModified || new Date().toISOString(),
          success: true
        })
        
      } catch (error) {
        console.error('Failed to get file content from Target App:', error)
        return NextResponse.json({
          content: '',
          exists: false,
          path: filePath,
          error: 'Failed to read file from Target App',
          success: false
        })
      }
    }

    if (action === 'get_todos') {
      try {
        // Execute a command in the Target App to get Claude's current todo list
        const todosResult = await targetAppClient.executeClaudeCommand(
          sessionId,
          'Please provide your current todo list in JSON format. Use this exact structure: {"todos": [{"content": "task description", "status": "pending|in_progress|completed", "priority": "high|medium|low", "id": "unique_id"}]}. Only respond with the JSON, no additional text.'
        )
        
        let todos = []
        try {
          // Try to parse the response as JSON
          const response = todosResult.response || '{}'
          // Look for JSON in the response
          const jsonMatch = response.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const todoData = JSON.parse(jsonMatch[0])
            todos = todoData.todos || []
          }
        } catch (parseError) {
          console.warn('Failed to parse todos from Claude response:', parseError)
          // If parsing fails, create a default todo from the response text
          if (todosResult.response && todosResult.response.trim()) {
            todos = [{
              content: todosResult.response.substring(0, 200) + '...',
              status: 'in_progress',
              priority: 'medium',
              id: Date.now().toString()
            }]
          }
        }

        return NextResponse.json({
          todos,
          success: true,
          lastUpdated: new Date().toISOString(),
          source: 'claude-code-sdk'
        })
        
      } catch (error) {
        console.error('Failed to get todos from Target App:', error)
        return NextResponse.json({
          todos: [],
          success: false,
          error: 'Failed to communicate with Target App Claude Code SDK',
          lastUpdated: new Date().toISOString()
        })
      }
    }

    if (action === 'check_dev_server') {
      try {
        const status = await targetAppClient.checkDevServerStatus()
        return NextResponse.json({
          running: status.running,
          port: status.port,
          error: status.error,
          success: true
        })
      } catch (error) {
        console.error('Failed to check dev server status:', error)
        return NextResponse.json({
          running: false,
          success: false,
          error: 'Failed to check dev server status'
        })
      }
    }

    if (action === 'start_dev_server') {
      try {
        const result = await targetAppClient.ensureDevServerRunning()
        return NextResponse.json({
          success: result.success,
          started: result.started,
          error: result.error,
          previewUrl: result.success ? targetAppClient.getPreviewUrlSync() : null
        })
      } catch (error) {
        console.error('Failed to start dev server:', error)
        return NextResponse.json({
          success: false,
          started: false,
          error: 'Failed to start dev server'
        })
      }
    }

    // Default: Get project state
    const projectState = await targetAppClient.getProjectState()

    return NextResponse.json({
      session,
      projectState,
      files: projectState.files,
      devServerStatus: projectState.devServerStatus,
      previewUrl: targetAppClient.getPreviewUrlSync()
    })

  } catch (error) {
    console.error('Project state error:', error)
    return NextResponse.json(
      { error: 'Failed to get project state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, action, data } = await request.json()
    
    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Missing sessionId or action' },
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

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, target_directory')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const targetAppClient = targetAppRegistry.getClient(sessionId)

    let result

    switch (action) {
      case 'refresh':
        result = await targetAppClient.getProjectState()
        break
        
      case 'execute_command':
        if (!data?.command) {
          return NextResponse.json(
            { error: 'Missing command in data' },
            { status: 400 }
          )
        }
        
        // Send command to Claude Code SDK in Target App
        const commandResult = await targetAppClient.sendClaudeMessage(data.command)
        result = commandResult
        
        // Log command execution
        await supabase
          .from('claude_operations')
          .insert({
            workspace_id: workspaceId,
            session_id: sessionId,
            operation_type: 'command_execution',
            status: commandResult.success ? 'completed' : 'failed',
            input_data: { command: data.command },
            output_data: commandResult,
            metadata: { manual: true, source: 'target-app-claude-sdk' }
          })
        break
        
      case 'start_dev_server':
        result = await targetAppClient.startDevServer()
        break
        
      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('Project operation error:', error)
    return NextResponse.json(
      { error: 'Failed to execute project operation' },
      { status: 500 }
    )
  }
}