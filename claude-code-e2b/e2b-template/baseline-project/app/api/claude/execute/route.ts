import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { ClaudeAgent } from '@/lib/claude-sdk/agent'
import { createAPIHandler } from '@/lib/validation/api-validation'
import { CodeExecutionRequestSchema } from '@/lib/validation/schemas'

export const POST = createAPIHandler(
  {
    schemas: {
      body: CodeExecutionRequestSchema
    },
    rateLimit: {
      requests: 10,
      windowMs: 60000 // 10 requests per minute for code execution
    },
    requireAuth: true
  },
  async (request, { validatedData, workspaceId }) => {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { session_id, entry_point, files } = validatedData.body!
    
    // Verify session belongs to workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', session_id)
      .eq('workspace_id', workspaceId!)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }
    
    // Initialize Claude agent with proper config
    const agent = new ClaudeAgent({
      sessionId: session_id,
      workspaceId: workspaceId!,
      projectPath: `/tmp/claude-workspace/${session_id}`
    })
    
    // Get files from database if not provided in request
    let executionFiles = files || []
    if (!executionFiles.length) {
      const { data: dbFiles, error: filesError } = await supabase
        .from('generated_files')
        .select('file_path, content, file_type')
        .eq('workspace_id', workspaceId!)
        .eq('session_id', session_id)
      
      if (filesError) {
        console.error('Database error:', filesError)
        return NextResponse.json(
          { error: 'Failed to fetch files' },
          { status: 500 }
        )
      }
      
      executionFiles = dbFiles || []
    }
    
    if (!executionFiles.length) {
      return NextResponse.json(
        { error: 'No files available for execution' },
        { status: 400 }
      )
    }
    
    // Execute code using Claude agent with real E2B integration
    const result = await agent.executeCode({
      files: executionFiles,
      entryPoint: entry_point,
      sessionId: session_id,
      workspaceId: workspaceId!
    })
    
    // Store execution result in database
    const { error: insertError } = await supabase
      .from('execution_results')
      .insert({
        workspace_id: workspaceId!,
        session_id,
        entry_point,
        result: result.output,
        status: result.success ? 'success' : 'error',
        execution_time: result.executionTime,
        errors: result.errors || null
      })
    
    if (insertError) {
      console.error('Failed to store execution result:', insertError)
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({
      success: result.success,
      output: result.output,
      errors: result.errors,
      executionTime: result.executionTime,
      timestamp: new Date().toISOString()
    })
  }
)