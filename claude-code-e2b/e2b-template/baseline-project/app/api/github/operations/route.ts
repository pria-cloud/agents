import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { GitHubService } from '@/lib/services/github'

export async function POST(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { operation, session_id } = body
    
    if (!session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }
    
    // Get session with GitHub integration
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    if (!session.github_token || !session.github_repo_url) {
      return NextResponse.json({ error: 'GitHub not configured for this session' }, { status: 400 })
    }
    
    // Initialize GitHub service
    const githubService = GitHubService.fromSession(session)
    if (!githubService) {
      return NextResponse.json({ error: 'Invalid GitHub configuration' }, { status: 400 })
    }
    
    switch (operation) {
      case 'create_repository':
        return await handleCreateRepository(request, githubService, session, supabase)
      
      case 'sync_files':
        return await handleSyncFiles(request, githubService, session, supabase, workspaceId)
      
      case 'get_repository_info':
        return await handleGetRepositoryInfo(githubService)
      
      case 'get_file_history':
        return await handleGetFileHistory(request, githubService)
      
      case 'create_pull_request':
        return await handleCreatePullRequest(request, githubService)
      
      case 'list_files':
        return await handleListFiles(request, githubService)
      
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('GitHub operations error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

async function handleCreateRepository(
  request: NextRequest, 
  githubService: GitHubService, 
  session: any, 
  supabase: any
) {
  try {
    const body = await request.json()
    const { name, description, private: isPrivate = true, initialize = true } = body
    
    if (!name) {
      return NextResponse.json({ error: 'Repository name is required' }, { status: 400 })
    }
    
    // Create repository using GitHub API
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.github_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: description || `Generated by Claude Code - ${session.name}`,
        private: isPrivate,
        auto_init: initialize,
        gitignore_template: 'Node'
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ 
        error: `Failed to create repository: ${error.message || 'Unknown error'}` 
      }, { status: response.status })
    }
    
    const repoData = await response.json()
    
    // Update session with new repository URL
    await supabase
      .from('sessions')
      .update({
        github_repo_url: repoData.clone_url,
        github_branch: repoData.default_branch
      })
      .eq('id', session.id)
    
    return NextResponse.json({
      success: true,
      repository: {
        name: repoData.name,
        full_name: repoData.full_name,
        html_url: repoData.html_url,
        clone_url: repoData.clone_url,
        default_branch: repoData.default_branch
      }
    })
    
  } catch (error) {
    console.error('Create repository error:', error)
    return NextResponse.json({ error: 'Failed to create repository' }, { status: 500 })
  }
}

async function handleSyncFiles(
  request: NextRequest,
  githubService: GitHubService,
  session: any,
  supabase: any,
  workspaceId: string
) {
  try {
    // Get all generated files for the session
    const { data: files, error } = await supabase
      .from('generated_files')
      .select('*')
      .eq('session_id', session.id)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }
    
    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No files to sync',
        commit: null
      })
    }
    
    // Sync files to GitHub
    const result = await githubService.syncGeneratedFiles(files, session.name)
    
    // Log the sync operation
    await supabase
      .from('claude_operations')
      .insert({
        session_id: session.id,
        workspace_id: workspaceId,
        operation_type: 'sync_to_github',
        input_data: {
          files_count: files.length,
          repository: session.github_repo_url
        },
        output_data: result,
        status: 'completed'
      })
    
    return NextResponse.json({
      success: true,
      commit: result,
      files_synced: files.length
    })
    
  } catch (error) {
    console.error('Sync files error:', error)
    return NextResponse.json({ error: 'Failed to sync files to GitHub' }, { status: 500 })
  }
}

async function handleGetRepositoryInfo(githubService: GitHubService) {
  try {
    const repoInfo = await githubService.getRepoInfo()
    return NextResponse.json({ repository: repoInfo })
  } catch (error) {
    console.error('Get repository info error:', error)
    return NextResponse.json({ error: 'Failed to get repository information' }, { status: 500 })
  }
}

async function handleGetFileHistory(request: NextRequest, githubService: GitHubService) {
  try {
    const body = await request.json()
    const { path, limit = 10 } = body
    
    const history = await githubService.getCommitHistory(path, limit)
    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get file history error:', error)
    return NextResponse.json({ error: 'Failed to get file history' }, { status: 500 })
  }
}

async function handleCreatePullRequest(request: NextRequest, githubService: GitHubService) {
  try {
    const body = await request.json()
    const { title, head, base, description } = body
    
    if (!title || !head || !base) {
      return NextResponse.json({ 
        error: 'Title, head branch, and base branch are required' 
      }, { status: 400 })
    }
    
    const pullRequest = await githubService.createPullRequest(title, head, base, description)
    return NextResponse.json({ pull_request: pullRequest })
  } catch (error) {
    console.error('Create pull request error:', error)
    return NextResponse.json({ error: 'Failed to create pull request' }, { status: 500 })
  }
}

async function handleListFiles(request: NextRequest, githubService: GitHubService) {
  try {
    const body = await request.json()
    const { path = '' } = body
    
    const files = await githubService.listFiles(path)
    return NextResponse.json({ files })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}