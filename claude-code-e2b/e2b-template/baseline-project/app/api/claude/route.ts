import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { createClaudeAgent, type ClaudeAgentConfig } from '@/lib/claude-sdk/agent'

// POST /api/claude - Execute Claude Code SDK operations
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { operation, sessionId, workspaceId, ...operationData } = body

    // Validate required fields
    if (!operation || !sessionId || !workspaceId) {
      return NextResponse.json({ 
        error: 'Missing required fields: operation, sessionId, workspaceId' 
      }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('owner_id', user.id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    }

    // Get session information
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Create Claude agent configuration
    const agentConfig: ClaudeAgentConfig = {
      sessionId,
      workspaceId,
      projectPath: `/code/sessions/${sessionId}`,
      githubRepoUrl: session.github_repo_url || undefined,
      githubBranch: session.github_branch
    }

    const agent = createClaudeAgent(agentConfig)

    // Execute operation based on type
    let result: any = null

    switch (operation) {
      case 'analyze_requirements':
        const { requirement_ids } = operationData
        
        if (!requirement_ids || !Array.isArray(requirement_ids)) {
          return NextResponse.json({ error: 'requirement_ids array is required' }, { status: 400 })
        }

        // Fetch requirements
        const { data: requirements, error: reqError } = await supabase
          .from('requirements')
          .select('*')
          .in('id', requirement_ids)
          .eq('session_id', sessionId)

        if (reqError || !requirements) {
          return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 })
        }

        result = await agent.analyzeRequirements(requirements)
        break

      case 'generate_code':
        const { requirement_ids: codeReqIds, generate_tests } = operationData

        if (!codeReqIds || !Array.isArray(codeReqIds)) {
          return NextResponse.json({ error: 'requirement_ids array is required' }, { status: 400 })
        }

        // Fetch requirements
        const { data: codeRequirements, error: codeReqError } = await supabase
          .from('requirements')
          .select('*')
          .in('id', codeReqIds)
          .eq('session_id', sessionId)

        if (codeReqError || !codeRequirements) {
          return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 })
        }

        // Fetch technical specs if available
        const { data: techSpecs } = await supabase
          .from('technical_specs')
          .select('*')
          .in('requirement_id', codeReqIds)
          .eq('session_id', sessionId)

        result = await agent.generateCode({
          requirements: codeRequirements,
          techSpecs: techSpecs || [],
          generateTests: generate_tests || false
        })
        break

      case 'update_code':
        const { requirement_id, changes } = operationData

        if (!requirement_id || !changes) {
          return NextResponse.json({ error: 'requirement_id and changes are required' }, { status: 400 })
        }

        result = await agent.updateCode(requirement_id, changes)
        break

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      operation,
      result 
    })

  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json({ 
      error: 'Claude operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/claude - Get Claude operations history
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Fetch Claude operations with workspace isolation enforced by RLS
    const { data: operations, error } = await supabase
      .from('claude_operations')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 })
    }

    return NextResponse.json({ operations })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}