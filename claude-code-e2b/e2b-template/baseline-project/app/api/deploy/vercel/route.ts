import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { GitHubService } from '@/lib/services/github'
import { e2bSandboxService } from '@/lib/services/e2b'

export async function POST(request: NextRequest) {
  try {
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
    
    // Get session with integrations
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    switch (operation) {
      case 'setup_vercel_project':
        return await handleSetupVercelProject(request, session, supabase)
      
      case 'deploy_preview':
        return await handleDeployPreview(request, session, supabase, workspaceId)
      
      case 'deploy_production':
        return await handleDeployProduction(request, session, supabase, workspaceId)
      
      case 'get_deployments':
        return await handleGetDeployments(session)
      
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Vercel deployment error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

async function handleSetupVercelProject(
  request: NextRequest,
  session: any,
  supabase: any
) {
  try {
    const body = await request.json()
    const { vercel_project_id, vercel_org_id, domain_name } = body
    
    if (!vercel_project_id) {
      return NextResponse.json({ error: 'Vercel project ID is required' }, { status: 400 })
    }
    
    // Update session with Vercel configuration
    const { error } = await supabase
      .from('sessions')
      .update({
        vercel_project_id,
        vercel_org_id,
        vercel_domain: domain_name,
        deployment_status: 'configured'
      })
      .eq('id', session.id)
    
    if (error) {
      return NextResponse.json({ error: 'Failed to save Vercel configuration' }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Vercel project configured successfully'
    })
    
  } catch (error) {
    console.error('Setup Vercel project error:', error)
    return NextResponse.json({ error: 'Failed to setup Vercel project' }, { status: 500 })
  }
}

async function handleDeployPreview(
  request: NextRequest,
  session: any,
  supabase: any,
  workspaceId: string
) {
  try {
    const body = await request.json()
    const { branch_name = 'develop', commit_message } = body
    
    // Step 1: Sync files from E2B to GitHub
    const syncResult = await syncFilesToGitHub(session, workspaceId, supabase, branch_name)
    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error }, { status: 500 })
    }
    
    // Step 2: Trigger Vercel deployment via GitHub webhook
    const deploymentResult = await triggerVercelDeployment(session, branch_name, 'preview')
    
    // Step 3: Log deployment operation
    await supabase
      .from('claude_operations')
      .insert({
        session_id: session.id,
        workspace_id: workspaceId,
        operation_type: 'deploy_preview',
        input_data: {
          branch: branch_name,
          commit_message,
          vercel_project: session.vercel_project_id
        },
        output_data: deploymentResult,
        status: deploymentResult.success ? 'completed' : 'failed'
      })
    
    return NextResponse.json(deploymentResult)
    
  } catch (error) {
    console.error('Deploy preview error:', error)
    return NextResponse.json({ error: 'Failed to deploy preview' }, { status: 500 })
  }
}

async function handleDeployProduction(
  request: NextRequest,
  session: any,
  supabase: any,
  workspaceId: string
) {
  try {
    const body = await request.json()
    const { commit_message = 'Production deployment from PRIA' } = body
    
    // Step 1: Sync files from E2B to GitHub main branch
    const syncResult = await syncFilesToGitHub(session, workspaceId, supabase, 'main')
    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error }, { status: 500 })
    }
    
    // Step 2: Trigger Vercel production deployment
    const deploymentResult = await triggerVercelDeployment(session, 'main', 'production')
    
    // Step 3: Update session status
    await supabase
      .from('sessions')
      .update({
        deployment_status: deploymentResult.success ? 'deployed' : 'failed',
        production_url: deploymentResult.deployment_url
      })
      .eq('id', session.id)
    
    // Step 4: Log deployment operation
    await supabase
      .from('claude_operations')
      .insert({
        session_id: session.id,
        workspace_id: workspaceId,
        operation_type: 'deploy_production',
        input_data: {
          commit_message,
          vercel_project: session.vercel_project_id
        },
        output_data: deploymentResult,
        status: deploymentResult.success ? 'completed' : 'failed'
      })
    
    return NextResponse.json(deploymentResult)
    
  } catch (error) {
    console.error('Deploy production error:', error)
    return NextResponse.json({ error: 'Failed to deploy to production' }, { status: 500 })
  }
}

async function handleGetDeployments(session: any) {
  try {
    if (!session.vercel_project_id || !process.env.VERCEL_TOKEN) {
      return NextResponse.json({ deployments: [] })
    }
    
    // Fetch deployments from Vercel API
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${session.vercel_project_id}&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch Vercel deployments')
    }
    
    const data = await response.json()
    
    const deployments = data.deployments?.map((deployment: any) => ({
      id: deployment.uid,
      url: deployment.url,
      state: deployment.state,
      type: deployment.type,
      created_at: deployment.createdAt,
      git_branch: deployment.meta?.githubCommitRef,
      git_commit: deployment.meta?.githubCommitSha?.slice(0, 7)
    })) || []
    
    return NextResponse.json({ deployments })
    
  } catch (error) {
    console.error('Get deployments error:', error)
    return NextResponse.json({ error: 'Failed to fetch deployments' }, { status: 500 })
  }
}

// Helper functions

async function syncFilesToGitHub(
  session: any,
  workspaceId: string,
  supabase: any,
  branch: string
): Promise<{ success: boolean; error?: string; commit_sha?: string }> {
  try {
    if (!session.github_token || !session.github_repo_url) {
      return { success: false, error: 'GitHub not configured for this session' }
    }
    
    // Get GitHub service
    const githubService = GitHubService.fromSession(session)
    if (!githubService) {
      return { success: false, error: 'Invalid GitHub configuration' }
    }
    
    // Get generated files
    const { data: files, error } = await supabase
      .from('generated_files')
      .select('*')
      .eq('session_id', session.id)
      .eq('workspace_id', workspaceId)
    
    if (error || !files?.length) {
      return { success: false, error: 'No files to sync' }
    }
    
    // Sync files to GitHub
    const syncResult = await githubService.syncGeneratedFiles(files, session.name)
    
    return {
      success: true,
      commit_sha: syncResult.sha
    }
    
  } catch (error) {
    console.error('Sync to GitHub error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errorMessage }
  }
}

async function triggerVercelDeployment(
  session: any,
  branch: string,
  environment: 'preview' | 'production'
): Promise<any> {
  try {
    if (!process.env.VERCEL_TOKEN || !session.vercel_project_id) {
      return {
        success: false,
        error: 'Vercel not configured'
      }
    }
    
    // Create deployment via Vercel API
    const deploymentData = {
      name: session.name,
      gitSource: {
        type: 'github',
        repo: session.github_repo_url?.replace('https://github.com/', ''),
        ref: branch
      },
      projectSettings: {
        framework: 'nextjs'
      },
      target: environment === 'production' ? 'production' : 'preview'
    }
    
    const response = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deploymentData)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Vercel deployment failed')
    }
    
    const deployment = await response.json()
    
    return {
      success: true,
      deployment_id: deployment.id,
      deployment_url: `https://${deployment.url}`,
      environment,
      branch,
      status: deployment.readyState
    }
    
  } catch (error) {
    console.error('Trigger Vercel deployment error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return {
      success: false,
      error: errorMessage
    }
  }
}