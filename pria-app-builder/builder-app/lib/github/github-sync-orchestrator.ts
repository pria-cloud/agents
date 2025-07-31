/**
 * GitHub Sync Orchestrator - Manages high-level GitHub synchronization workflows
 * Coordinates between sandbox code generation and GitHub repository operations
 */

import { Sandbox } from 'e2b'
import { GitHubWebhookSetup } from './webhook-setup'
import { GitHubCodeSyncService, CodeSyncConfig } from '../services/github-code-sync'
import { GitHubSandboxSyncService, SandboxSyncConfig } from '../services/github-sandbox-sync'
import { E2BGitHubSetupService, E2BGitHubConfig } from '../services/e2b-github-setup'
import createServerClient from '@/lib/supabase/server'
import { PRIAEncryption } from '@/lib/security/encryption'

export interface SyncOrchestrationConfig {
  sessionId: string
  workspaceId: string
  sandboxId: string
  targetAppPath: string
  autoSync?: boolean
  webhookEvents?: string[]
}

export interface OrchestrationResult {
  success: boolean
  operations: {
    repositorySetup: boolean
    webhookConfigured: boolean
    initialSync: boolean
    autoSyncEnabled: boolean
  }
  repository?: {
    name: string
    url: string
    branch: string
  }
  errors: string[]
  warnings: string[]
}

export class GitHubSyncOrchestrator {
  private config: SyncOrchestrationConfig
  private sandbox: Sandbox | null = null

  constructor(config: SyncOrchestrationConfig) {
    this.config = config
  }

  /**
   * Complete end-to-end GitHub integration setup for a session
   */
  async orchestrateFullSetup(
    repositoryName: string,
    description?: string
  ): Promise<OrchestrationResult> {
    const result: OrchestrationResult = {
      success: false,
      operations: {
        repositorySetup: false,
        webhookConfigured: false,
        initialSync: false,
        autoSyncEnabled: false
      },
      errors: [],
      warnings: []
    }

    try {
      console.log(`[SYNC ORCHESTRATOR] Starting full GitHub setup for session: ${this.config.sessionId}`)

      // 1. Get or create GitHub authentication
      const githubAuth = await this.getGitHubAuth()
      if (!githubAuth) {
        result.errors.push('GitHub authentication required')
        return result
      }

      // 2. Get or create E2B sandbox
      const sandbox = await this.getSandbox()
      if (!sandbox) {
        result.errors.push('E2B sandbox not available')
        return result
      }

      // 3. Set up GitHub repository
      const repoResult = await this.setupRepository(repositoryName, description, githubAuth)
      if (!repoResult.success) {
        result.errors.push(...repoResult.errors)
        return result
      }
      
      result.operations.repositorySetup = true
      result.repository = repoResult.repository

      // 4. Configure GitHub in E2B sandbox
      const sandboxSetup = await this.setupSandboxGitHub(sandbox, githubAuth, repoResult.repository!)
      if (!sandboxSetup.success) {
        result.errors.push(...sandboxSetup.errors)
        return result
      }

      // 5. Perform initial code sync
      const initialSync = await this.performInitialSync(sandbox, githubAuth, repoResult.repository!)
      if (!initialSync.success) {
        result.warnings.push('Initial sync failed but setup can continue')
        result.warnings.push(...initialSync.errors)
      } else {
        result.operations.initialSync = true
      }

      // 6. Set up webhooks for auto-sync
      if (this.config.autoSync) {
        const webhookResult = await this.setupWebhooks(githubAuth, repoResult.repository!)
        if (!webhookResult.success) {
          result.warnings.push('Webhook setup failed - manual sync will be required')
          result.warnings.push(webhookResult.error || 'Unknown webhook error')
        } else {
          result.operations.webhookConfigured = true
          result.operations.autoSyncEnabled = true
        }
      }

      result.success = true
      console.log(`[SYNC ORCHESTRATOR] GitHub setup completed successfully`)

      return result

    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Setup failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }

  /**
   * Sync changes from sandbox to GitHub
   */
  async syncToGitHub(
    commitMessage?: string,
    options: {
      createPullRequest?: boolean
      targetBranch?: string
      includePatterns?: string[]
      excludePatterns?: string[]
    } = {}
  ): Promise<{
    success: boolean
    commitSha?: string
    filesChanged: number
    pullRequestUrl?: string
    error?: string
  }> {
    try {
      console.log(`[SYNC ORCHESTRATOR] Syncing to GitHub for session: ${this.config.sessionId}`)

      const githubAuth = await this.getGitHubAuth()
      const sandbox = await this.getSandbox()
      const repository = await this.getRepositoryInfo()

      if (!githubAuth || !sandbox || !repository) {
        return {
          success: false,
          filesChanged: 0,
          error: 'GitHub setup not complete'
        }
      }

      // Create sync service
      const syncConfig: CodeSyncConfig = {
        sessionId: this.config.sessionId,
        workspaceId: this.config.workspaceId,
        sandboxId: this.config.sandboxId,
        repositoryOwner: repository.owner,
        repositoryName: repository.name,
        branch: repository.branch,
        githubToken: githubAuth.token
      }

      const codeSync = new GitHubCodeSyncService(sandbox, syncConfig)

      // Perform sync
      const syncResult = await codeSync.pushToGitHub(
        commitMessage || `Update from PRIA session ${this.config.sessionId.slice(0, 8)}`,
        {
          ...options,
          excludePatterns: options.excludePatterns || ['node_modules/**', '.next/**', 'dist/**', '.env*']
        }
      )

      return {
        success: syncResult.success,
        commitSha: syncResult.operation.commit?.sha,
        filesChanged: syncResult.summary.filesAdded + syncResult.summary.filesModified + syncResult.summary.filesDeleted,
        error: syncResult.success ? undefined : syncResult.operation.errors?.join(', ')
      }

    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Sync to GitHub failed:', error)
      return {
        success: false,
        filesChanged: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Sync changes from GitHub to sandbox
   */
  async syncFromGitHub(
    options: {
      strategy?: 'merge' | 'rebase' | 'reset'
      resolveConflicts?: boolean
      backupLocal?: boolean
    } = {}
  ): Promise<{
    success: boolean
    filesChanged: number
    conflicts: string[]
    error?: string
  }> {
    try {
      console.log(`[SYNC ORCHESTRATOR] Syncing from GitHub for session: ${this.config.sessionId}`)

      const githubAuth = await this.getGitHubAuth()
      const sandbox = await this.getSandbox()
      const repository = await this.getRepositoryInfo()

      if (!githubAuth || !sandbox || !repository) {
        return {
          success: false,
          filesChanged: 0,
          conflicts: [],
          error: 'GitHub setup not complete'
        }
      }

      // Create sync service
      const syncConfig: CodeSyncConfig = {
        sessionId: this.config.sessionId,
        workspaceId: this.config.workspaceId,
        sandboxId: this.config.sandboxId,
        repositoryOwner: repository.owner,
        repositoryName: repository.name,
        branch: repository.branch,
        githubToken: githubAuth.token
      }

      const codeSync = new GitHubCodeSyncService(sandbox, syncConfig)

      // Perform pull
      const pullResult = await codeSync.pullFromGitHub(options)

      return {
        success: pullResult.success,
        filesChanged: pullResult.summary.filesAdded + pullResult.summary.filesModified + pullResult.summary.filesDeleted,
        conflicts: pullResult.operation.conflicts?.map(c => c.path) || [],
        error: pullResult.success ? undefined : pullResult.operation.errors?.join(', ')
      }

    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Sync from GitHub failed:', error)
      return {
        success: false,
        filesChanged: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Private helper methods

  private async getGitHubAuth(): Promise<{ token: string; username: string; email: string } | null> {
    try {
      const supabase = await createServerClient()
      
      const { data: authData } = await supabase
        .from('github_auth')
        .select('access_token, github_username, github_email')
        .eq('workspace_id', this.config.workspaceId)
        .single()

      if (!authData?.access_token) {
        return null
      }

      // Decrypt the token
      const decryptedToken = PRIAEncryption.decryptGitHubToken(authData.access_token)

      return {
        token: decryptedToken,
        username: authData.github_username || 'pria-user',
        email: authData.github_email || 'pria@example.com'
      }
    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Failed to get GitHub auth:', error)
      return null
    }
  }

  private async getSandbox(): Promise<Sandbox | null> {
    if (this.sandbox) {
      return this.sandbox
    }

    try {
      // Get sandbox from E2B manager or reconnect
      this.sandbox = await Sandbox.reconnect(this.config.sandboxId)
      return this.sandbox
    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Failed to get sandbox:', error)
      return null
    }
  }

  private async getRepositoryInfo(): Promise<{
    owner: string
    name: string
    branch: string
    url: string
  } | null> {
    try {
      const supabase = await createServerClient()
      
      const { data: repoData } = await supabase
        .from('github_repositories')
        .select('repository_owner, repository_name, default_branch, repository_url')
        .eq('session_id', this.config.sessionId)
        .single()

      if (!repoData) {
        return null
      }

      return {
        owner: repoData.repository_owner,
        name: repoData.repository_name,
        branch: repoData.default_branch,
        url: repoData.repository_url
      }
    } catch (error) {
      console.error('[SYNC ORCHESTRATOR] Failed to get repository info:', error)
      return null
    }
  }

  private async setupRepository(
    name: string,
    description: string | undefined,
    auth: { token: string; username: string; email: string }
  ): Promise<{
    success: boolean
    repository?: {
      owner: string
      name: string
      branch: string
      url: string
    }
    errors: string[]
  }> {
    try {
      // Use GitHubSandboxSyncService to create/ensure repository
      const sandboxSyncConfig: SandboxSyncConfig = {
        sessionId: this.config.sessionId,
        workspaceId: this.config.workspaceId,
        sandboxId: this.config.sandboxId,
        githubToken: auth.token
      }

      const sandboxSync = new GitHubSandboxSyncService(sandboxSyncConfig)
      const repository = await sandboxSync.ensureRepository(
        `workspace-${this.config.workspaceId.slice(0, 8)}`,
        name,
        description
      )

      return {
        success: true,
        repository: {
          owner: repository.owner.login,
          name: repository.name,
          branch: repository.default_branch,
          url: repository.html_url
        },
        errors: []
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Repository setup failed']
      }
    }
  }

  private async setupSandboxGitHub(
    sandbox: Sandbox,
    auth: { token: string; username: string; email: string },
    repository: { owner: string; name: string; branch: string; url: string }
  ): Promise<{
    success: boolean
    errors: string[]
  }> {
    try {
      const githubSetup = new E2BGitHubSetupService(sandbox, {
        sessionId: this.config.sessionId,
        workspaceId: this.config.workspaceId,
        sandboxId: this.config.sandboxId,
        githubToken: auth.token,
        githubUsername: auth.username,
        githubEmail: auth.email,
        repositoryUrl: repository.url,
        branch: repository.branch
      })

      const setupResult = await githubSetup.setupGitHubAccess()
      
      return {
        success: setupResult.success,
        errors: setupResult.errors || []
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Sandbox GitHub setup failed']
      }
    }
  }

  private async performInitialSync(
    sandbox: Sandbox,
    auth: { token: string; username: string; email: string },
    repository: { owner: string; name: string; branch: string; url: string }
  ): Promise<{
    success: boolean
    errors: string[]
  }> {
    try {
      // Perform initial push of target app code to repository
      const syncConfig: CodeSyncConfig = {
        sessionId: this.config.sessionId,
        workspaceId: this.config.workspaceId,
        sandboxId: this.config.sandboxId,
        repositoryOwner: repository.owner,
        repositoryName: repository.name,
        branch: repository.branch,
        githubToken: auth.token
      }

      const codeSync = new GitHubCodeSyncService(sandbox, syncConfig)
      const syncResult = await codeSync.pushToGitHub('Initial PRIA app commit', {
        skipEmptyCommit: false
      })

      return {
        success: syncResult.success,
        errors: syncResult.operation.errors || []
      }
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Initial sync failed']
      }
    }
  }

  private async setupWebhooks(
    auth: { token: string; username: string; email: string },
    repository: { owner: string; name: string; branch: string; url: string }
  ): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const webhookSetup = new GitHubWebhookSetup(auth.token)
      
      const result = await webhookSetup.setupWebhook({
        repositoryOwner: repository.owner,
        repositoryName: repository.name,
        accessToken: auth.token,
        events: this.config.webhookEvents || ['push', 'pull_request']
      })

      return {
        success: result.success,
        error: result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook setup failed'
      }
    }
  }
}