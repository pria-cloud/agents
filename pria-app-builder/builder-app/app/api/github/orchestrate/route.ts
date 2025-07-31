/**
 * GitHub Sync Orchestration API
 * High-level endpoint for managing complete GitHub integration workflows
 */

import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { GitHubSyncOrchestrator } from '@/lib/github/github-sync-orchestrator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { action, sessionId, sandboxId } = body

    if (!sessionId || !sandboxId) {
      return NextResponse.json({ 
        error: 'Session ID and Sandbox ID are required' 
      }, { status: 400 })
    }

    // Get session info and target app path
    const { data: session } = await supabase
      .from('sessions')
      .select('target_directory')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const orchestrator = new GitHubSyncOrchestrator({
      sessionId,
      workspaceId,
      sandboxId,
      targetAppPath: session.target_directory || '/app',
      autoSync: body.autoSync !== false,
      webhookEvents: body.webhookEvents || ['push', 'pull_request']
    })

    switch (action) {
      case 'setup':
        // Complete GitHub integration setup
        const { repositoryName, description } = body
        
        if (!repositoryName) {
          return NextResponse.json({ 
            error: 'Repository name is required for setup' 
          }, { status: 400 })
        }

        try {
          const setupResult = await orchestrator.orchestrateFullSetup(
            repositoryName,
            description
          )

          return NextResponse.json({
            success: setupResult.success,
            operations: setupResult.operations,
            repository: setupResult.repository,
            errors: setupResult.errors,
            warnings: setupResult.warnings,
            message: setupResult.success 
              ? 'GitHub integration setup completed successfully'
              : 'GitHub integration setup failed'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'sync_to_github':
        // Sync changes from sandbox to GitHub
        const { commitMessage, createPullRequest, targetBranch, includePatterns, excludePatterns } = body

        try {
          const syncResult = await orchestrator.syncToGitHub(
            commitMessage || `Update from PRIA session ${sessionId.slice(0, 8)}`,
            {
              createPullRequest,
              targetBranch,
              includePatterns,
              excludePatterns
            }
          )

          return NextResponse.json({
            success: syncResult.success,
            commitSha: syncResult.commitSha,
            filesChanged: syncResult.filesChanged,
            pullRequestUrl: syncResult.pullRequestUrl,
            error: syncResult.error,
            message: syncResult.success 
              ? `Successfully synced ${syncResult.filesChanged} file(s) to GitHub`
              : 'Sync to GitHub failed'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Sync to GitHub failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'sync_from_github':
        // Sync changes from GitHub to sandbox
        const { strategy, resolveConflicts, backupLocal } = body

        try {
          const pullResult = await orchestrator.syncFromGitHub({
            strategy: strategy || 'merge',
            resolveConflicts: resolveConflicts || false,
            backupLocal: backupLocal !== false
          })

          return NextResponse.json({
            success: pullResult.success,
            filesChanged: pullResult.filesChanged,
            conflicts: pullResult.conflicts,
            error: pullResult.error,
            message: pullResult.success 
              ? `Successfully synced ${pullResult.filesChanged} file(s) from GitHub`
              : 'Sync from GitHub failed'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Sync from GitHub failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub orchestration API:', error)
    return NextResponse.json(
      { error: 'Failed to process GitHub orchestration request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const action = searchParams.get('action') || 'status'

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    switch (action) {
      case 'status':
        // Get GitHub integration status for session
        const { data: repoData } = await supabase
          .from('github_repositories')
          .select('*')
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)
          .single()

        const { data: authData } = await supabase
          .from('github_auth')
          .select('github_username, github_email, created_at')
          .eq('workspace_id', workspaceId)
          .single()

        const { data: syncHistory } = await supabase
          .from('github_sync_status')
          .select('*')
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)
          .order('synced_at', { ascending: false })
          .limit(5)

        return NextResponse.json({
          success: true,
          status: {
            hasRepository: !!repoData,
            hasAuth: !!authData,
            repository: repoData ? {
              name: repoData.repository_name,
              owner: repoData.repository_owner,
              url: repoData.repository_url,
              branch: repoData.default_branch,
              private: repoData.is_private,
              created: repoData.created_at
            } : null,
            auth: authData ? {
              username: authData.github_username,
              email: authData.github_email,
              connected: authData.created_at
            } : null,
            recentSyncs: syncHistory || []
          }
        })

      case 'health':
        // Health check for GitHub integration
        try {
          // Check if GitHub auth exists
          const { data: auth } = await supabase
            .from('github_auth')
            .select('access_token')
            .eq('workspace_id', workspaceId)
            .single()

          const hasAuth = !!auth?.access_token

          // Check recent sync activity
          const { data: recentSync } = await supabase
            .from('github_sync_status')
            .select('synced_at, sync_status')
            .eq('workspace_id', workspaceId)
            .order('synced_at', { ascending: false })
            .limit(1)
            .single()

          return NextResponse.json({
            success: true,
            health: {
              authenticated: hasAuth,
              lastSync: recentSync?.synced_at || null,
              lastSyncStatus: recentSync?.sync_status || null,
              operational: hasAuth,
              timestamp: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            health: {
              authenticated: false,
              operational: false,
              error: error instanceof Error ? error.message : 'Health check failed',
              timestamp: new Date().toISOString()
            }
          })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub orchestration GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get GitHub orchestration information' },
      { status: 500 }
    )
  }
}