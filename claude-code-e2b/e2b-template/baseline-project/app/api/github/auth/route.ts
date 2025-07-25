import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { GitHubUtils } from '@/lib/services/github'
import { githubSecurity, validateGitHubOperation } from '@/lib/security/github-security'
import { requireAuth } from '@/lib/auth/global-auth'
import { logger } from '@/lib/monitoring/logger'

// GitHub OAuth App Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    
    if (action === 'authorize') {
      // Generate authorization URL
      const state = Buffer.from(JSON.stringify({
        user_id: user.id,
        workspace_id: workspaceId,
        timestamp: Date.now()
      })).toString('base64')
      
      const authUrl = new URL('https://github.com/login/oauth/authorize')
      authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID!)
      authUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI)
      authUrl.searchParams.set('scope', 'repo,user:email')
      authUrl.searchParams.set('state', state)
      
      return NextResponse.json({ 
        authorization_url: authUrl.toString()
      })
    }
    
    if (action === 'status') {
      // Check GitHub integration status
      const { data: session } = await supabase
        .from('sessions')
        .select('github_repo_url, github_branch, github_token')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single()
      
      const isConnected = !!(session?.github_token)
      let repoInfo = null
      
      if (isConnected && session.github_repo_url) {
        try {
          const parsed = GitHubUtils.parseRepoUrl(session.github_repo_url)
          repoInfo = {
            owner: parsed?.owner,
            repo: parsed?.repo,
            url: session.github_repo_url,
            branch: session.github_branch || 'main'
          }
        } catch (error) {
          console.error('Failed to parse GitHub repo URL:', error)
        }
      }
      
      return NextResponse.json({
        connected: isConnected,
        repository: repoInfo
      })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('GitHub auth error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { action, token, repository_url, branch } = body
    
    if (action === 'connect') {
      // Validate GitHub token
      if (!token) {
        return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 })
      }
      
      // Use secure token validation
      const tokenValidation = await githubSecurity.validateTokenAndPermissions(token)
      if (!tokenValidation.valid) {
        logger.warn('GitHub token validation failed', {
          error: tokenValidation.error,
          workspaceId
        })
        return NextResponse.json({ 
          error: tokenValidation.error || 'Invalid GitHub token' 
        }, { status: 400 })
      }
      
      // Validate repository access if provided
      if (repository_url) {
        const repoValidation = await validateGitHubOperation(token, 'write', repository_url)
        if (!repoValidation.allowed) {
          return NextResponse.json({ 
            error: repoValidation.error || 'Insufficient repository permissions' 
          }, { status: 403 })
        }
      }
      
      // Encrypt token for secure storage
      const encryptedToken = githubSecurity.encryptToken(token)
      
      // Update active session with encrypted GitHub info
      const { data: session, error } = await supabase
        .from('sessions')
        .update({
          github_token: encryptedToken, // Store encrypted token
          github_repo_url: repository_url,
          github_branch: branch || 'main',
          github_user_id: tokenValidation.user?.id?.toString(),
          github_username: tokenValidation.user?.login
        })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .select()
        .single()
      
      logger.info('GitHub integration connected', {
        workspaceId,
        repositoryUrl: repository_url,
        branch: branch || 'main',
        githubUser: tokenValidation.user?.login
      })
      
      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: 'Failed to save GitHub integration' }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        session: session
      })
    }
    
    if (action === 'disconnect') {
      // Remove GitHub integration from active session
      const { error } = await supabase
        .from('sessions')
        .update({
          github_token: null,
          github_repo_url: null,
          github_branch: null
        })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
      
      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    
  } catch (error) {
    console.error('GitHub auth error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}