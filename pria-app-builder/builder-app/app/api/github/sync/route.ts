import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createGitHubIntegration } from '@/lib/services/github-integration'
import { createGitHubSandboxSync, GitHubSandboxSyncService } from '@/lib/services/github-sandbox-sync'
import { createGitHubCodeSync, CodeSyncConfig } from '@/lib/services/github-code-sync'
import { E2BSandboxService } from '@/lib/services/e2b'
import { PRIAEncryption } from '@/lib/security/encryption'

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
    const { action, sessionId, sandboxId, commitMessage, branch, files } = body

    // Get GitHub auth
    const { data: githubAuth } = await supabase
      .from('github_auth')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!githubAuth) {
      return NextResponse.json({ error: 'GitHub authentication required' }, { status: 401 })
    }

    // Decrypt access token
    const accessToken = await decryptToken(githubAuth.access_token)
    
    // Initialize services
    const github = createGitHubIntegration({ accessToken })
    const sandboxSync = createGitHubSandboxSync({
      sessionId,
      workspaceId,
      sandboxId,
      githubToken: accessToken
    }, github)

    switch (action) {
      case 'create_repository':
        // Create or get repository for session
        const { workspaceName, projectName, description } = body
        
        if (!workspaceName || !projectName) {
          return NextResponse.json({ 
            error: 'Workspace name and project name required' 
          }, { status: 400 })
        }

        try {
          const repository = await sandboxSync.ensureRepository(
            workspaceName,
            projectName,
            description
          )

          return NextResponse.json({
            success: true,
            repository: {
              name: repository.name,
              full_name: repository.full_name,
              html_url: repository.html_url,
              clone_url: repository.clone_url,
              default_branch: repository.default_branch,
              private: repository.private
            }
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Failed to create repository: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'push_to_github':
        // Push sandbox changes to GitHub using advanced sync service
        if (!sandboxId) {
          return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 })
        }

        try {
          // Get sandbox instance
          const e2bService = new E2BSandboxService()
          const sandbox = await e2bService.getSandbox(sandboxId)
          
          if (!sandbox) {
            return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
          }

          // Check if repository exists for session
          const existingRepo = await GitHubSandboxSyncService.getRepositoryForSession(sessionId)
          if (!existingRepo) {
            return NextResponse.json({ 
              error: 'No repository found for session. Create a repository first.' 
            }, { status: 400 })
          }

          // Create advanced sync configuration
          const syncConfig: CodeSyncConfig = {
            sessionId,
            workspaceId,
            sandboxId,
            repositoryOwner: existingRepo.owner,
            repositoryName: existingRepo.name,
            branch: branch || existingRepo.default_branch,
            githubToken: accessToken
          }

          // Initialize advanced GitHub sync service
          const codeSync = createGitHubCodeSync(sandbox, syncConfig)

          // Parse additional options from request body
          const { createPullRequest, targetBranch, skipEmptyCommit, includePatterns, excludePatterns } = body

          // Push with advanced options
          const syncResult = await codeSync.pushToGitHub(
            commitMessage || `Update target app - ${new Date().toLocaleString()}`,
            {
              createPullRequest: createPullRequest || false,
              targetBranch: targetBranch,
              skipEmptyCommit: skipEmptyCommit !== false,
              includePatterns: includePatterns,
              excludePatterns: excludePatterns || ['node_modules/**', '.next/**', 'dist/**', '.env*']
            }
          )

          return NextResponse.json({
            success: syncResult.success,
            operation: {
              id: syncResult.operation.id,
              type: syncResult.operation.type,
              status: syncResult.operation.status,
              startTime: syncResult.operation.startTime,
              endTime: syncResult.operation.endTime,
              commit: syncResult.operation.commit
            },
            summary: syncResult.summary,
            nextActions: syncResult.nextActions,
            repository_url: existingRepo.html_url,
            // Legacy compatibility
            filesSync: {
              added: syncResult.summary.filesAdded,
              modified: syncResult.summary.filesModified,
              deleted: syncResult.summary.filesDeleted
            },
            errors: syncResult.operation.errors || []
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Push failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'pull_from_github':
        // Pull changes from GitHub to sandbox using advanced sync service
        if (!sandboxId) {
          return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 })
        }

        try {
          // Get sandbox instance
          const e2bService = new E2BSandboxService()
          const sandbox = await e2bService.getSandbox(sandboxId)
          
          if (!sandbox) {
            return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
          }

          // Check if repository exists for session
          const existingRepo = await GitHubSandboxSyncService.getRepositoryForSession(sessionId)
          if (!existingRepo) {
            return NextResponse.json({ 
              error: 'No repository found for session. Create a repository first.' 
            }, { status: 400 })
          }

          // Create advanced sync configuration
          const syncConfig: CodeSyncConfig = {
            sessionId,
            workspaceId,
            sandboxId,
            repositoryOwner: existingRepo.owner,
            repositoryName: existingRepo.name,
            branch: branch || existingRepo.default_branch,
            githubToken: accessToken
          }

          // Initialize advanced GitHub sync service
          const codeSync = createGitHubCodeSync(sandbox, syncConfig)

          // Parse additional options from request body
          const { strategy, resolveConflicts, backupLocal } = body

          // Pull with advanced options
          const syncResult = await codeSync.pullFromGitHub({
            strategy: strategy || 'merge', // merge, rebase, reset
            resolveConflicts: resolveConflicts || false,
            backupLocal: backupLocal !== false
          })

          return NextResponse.json({
            success: syncResult.success,
            operation: {
              id: syncResult.operation.id,
              type: syncResult.operation.type,
              status: syncResult.operation.status,
              startTime: syncResult.operation.startTime,
              endTime: syncResult.operation.endTime,
              conflicts: syncResult.operation.conflicts
            },
            summary: syncResult.summary,
            nextActions: syncResult.nextActions,
            conflicts: syncResult.operation.conflicts || [],
            // Legacy compatibility
            filesSync: {
              added: syncResult.summary.filesAdded,
              modified: syncResult.summary.filesModified,
              deleted: syncResult.summary.filesDeleted
            },
            errors: syncResult.operation.errors || []
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'get_sync_operations':
        // Get sync operation status and history
        if (!sandboxId) {
          return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 })
        }

        try {
          // Get sandbox instance
          const e2bService = new E2BSandboxService()
          const sandbox = await e2bService.getSandbox(sandboxId)
          
          if (!sandbox) {
            return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
          }

          // Check if repository exists for session
          const existingRepo = await GitHubSandboxSyncService.getRepositoryForSession(sessionId)
          if (!existingRepo) {
            return NextResponse.json({ 
              error: 'No repository found for session.' 
            }, { status: 400 })
          }

          // Create sync configuration
          const syncConfig: CodeSyncConfig = {
            sessionId,
            workspaceId,
            sandboxId,
            repositoryOwner: existingRepo.owner,
            repositoryName: existingRepo.name,
            branch: branch || existingRepo.default_branch,
            githubToken: accessToken
          }

          // Initialize GitHub sync service
          const codeSync = createGitHubCodeSync(sandbox, syncConfig)

          // Get operation by ID if provided, otherwise get all operations
          const { operationId } = body
          
          if (operationId) {
            const operation = codeSync.getOperation(operationId)
            return NextResponse.json({
              success: true,
              operation: operation || null
            })
          } else {
            const operations = codeSync.getAllOperations()
            return NextResponse.json({
              success: true,
              operations,
              totalOperations: operations.length
            })
          }

        } catch (error) {
          return NextResponse.json({ 
            error: `Failed to get operations: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'get_sandbox_files':
        // Get files from sandbox for preview
        if (!sandboxId) {
          return NextResponse.json({ error: 'Sandbox ID required' }, { status: 400 })
        }

        try {
          // Get sandbox instance
          const e2bService = new E2BSandboxService()
          const sandbox = await e2bService.getSandbox(sandboxId)
          
          if (!sandbox) {
            return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
          }

          // Initialize sandbox sync
          await sandboxSync.initializeSandbox(sandbox)

          // Get files
          const files = await sandboxSync.getSandboxFiles('/app')

          return NextResponse.json({
            success: true,
            files: files.map(f => ({
              path: f.path,
              size: f.content.length
            })),
            totalFiles: files.length
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Failed to get files: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub sync API:', error)
    return NextResponse.json(
      { error: 'Failed to process GitHub sync request' },
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

    switch (action) {
      case 'repository':
        // Get repository info for session
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const repository = await GitHubSandboxSyncService.getRepositoryForSession(sessionId)
        
        if (!repository) {
          return NextResponse.json({
            exists: false,
            message: 'No repository found for session'
          })
        }

        return NextResponse.json({
          exists: true,
          repository: {
            name: repository.name,
            full_name: repository.full_name,
            html_url: repository.html_url,
            clone_url: repository.clone_url,
            default_branch: repository.default_branch,
            private: repository.private,
            created_at: repository.created_at,
            updated_at: repository.updated_at
          }
        })

      case 'sync_history':
        // Get sync history for session
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const { data: syncHistory } = await supabase
          .from('github_sync_status')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('session_id', sessionId)
          .order('synced_at', { ascending: false })
          .limit(20)

        return NextResponse.json({
          success: true,
          history: syncHistory || [],
          totalSyncs: syncHistory?.length || 0
        })

      case 'repositories':
        // List all repositories in workspace
        const { data: repositories } = await supabase
          .from('github_repositories')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        return NextResponse.json({
          success: true,
          repositories: repositories || [],
          totalRepositories: repositories?.length || 0
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub sync GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get GitHub sync information' },
      { status: 500 }
    )
  }
}

/**
 * Decrypt GitHub token using proper encryption
 */
async function decryptToken(encryptedToken: string): Promise<string> {
  try {
    return PRIAEncryption.decryptGitHubToken(encryptedToken)
  } catch (error) {
    console.error('Failed to decrypt GitHub token:', error)
    throw new Error('Failed to decrypt GitHub token')
  }
}