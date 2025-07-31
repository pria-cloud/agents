/**
 * GitHub Sandbox Sync Service - Manages code synchronization between E2B sandboxes and GitHub
 * Handles target app code push/pull operations and repository management
 */

import { Sandbox } from 'e2b'
import { GitHubIntegrationService, GitHubFile, GitHubRepository } from './github-integration'
import createServerClient from '@/lib/supabase/server'

export interface SandboxSyncConfig {
  sessionId: string
  workspaceId: string
  sandboxId: string
  githubToken?: string
  repository?: {
    owner: string
    name: string
  }
}

export interface SyncResult {
  success: boolean
  commits?: string[]
  errors?: string[]
  filesSync: {
    added: number
    modified: number
    deleted: number
  }
  repository?: GitHubRepository
}

export interface FileChange {
  path: string
  content?: string
  action: 'add' | 'modify' | 'delete'
}

/**
 * GitHubSandboxSyncService - Manages GitHub sync for E2B sandboxes
 */
export class GitHubSandboxSyncService {
  private github: GitHubIntegrationService
  private config: SandboxSyncConfig
  private sandbox?: Sandbox

  constructor(config: SandboxSyncConfig, githubService?: GitHubIntegrationService) {
    this.config = config
    this.github = githubService || new GitHubIntegrationService({
      accessToken: config.githubToken
    })
  }

  /**
   * Initialize sandbox connection
   */
  async initializeSandbox(sandbox: Sandbox): Promise<void> {
    this.sandbox = sandbox
    
    // Install git in sandbox if not already present
    await this.sandbox.process.startAndWait('apt-get update && apt-get install -y git')
    
    // Configure git with user info
    await this.configureGitInSandbox()
  }

  /**
   * Configure git settings in sandbox
   */
  private async configureGitInSandbox(): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized')

    const userInfo = this.github.getUserInfo()
    if (userInfo) {
      await this.sandbox.process.startAndWait(
        `git config --global user.name "${userInfo.name || userInfo.login}"`
      )
      await this.sandbox.process.startAndWait(
        `git config --global user.email "${userInfo.email || `${userInfo.login}@users.noreply.github.com`}"`
      )
    } else {
      // Default configuration
      await this.sandbox.process.startAndWait(
        'git config --global user.name "PRIA App Builder"'
      )
      await this.sandbox.process.startAndWait(
        'git config --global user.email "pria@example.com"'
      )
    }
  }

  /**
   * Create or get repository for session
   */
  async ensureRepository(
    workspaceName: string,
    projectName: string,
    description?: string
  ): Promise<GitHubRepository> {
    const repoName = this.github.generateRepositoryName(
      workspaceName,
      projectName,
      this.config.sessionId
    )

    const userInfo = this.github.getUserInfo()
    if (!userInfo) {
      throw new Error('GitHub user not authenticated')
    }

    // Check if repository already exists
    const existingRepo = await this.github.getRepository(userInfo.login, repoName)
    if (existingRepo) {
      this.config.repository = {
        owner: userInfo.login,
        name: repoName
      }
      return existingRepo
    }

    // Create new repository
    const newRepo = await this.github.createRepository(repoName, {
      description: description || `PRIA App Builder - ${projectName}`,
      private: true,
      auto_init: true,
      gitignore_template: 'Node'
    })

    this.config.repository = {
      owner: userInfo.login,
      name: repoName
    }

    // Store repository info in database
    await this.storeRepositoryInfo(newRepo)

    return newRepo
  }

  /**
   * Clone repository to sandbox
   */
  async cloneToSandbox(cloneUrl: string, directory: string = '/app'): Promise<void> {
    if (!this.sandbox) throw new Error('Sandbox not initialized')

    // Clone repository with token authentication
    const urlWithToken = this.config.githubToken
      ? cloneUrl.replace('https://', `https://${this.config.githubToken}@`)
      : cloneUrl

    const result = await this.sandbox.process.startAndWait(
      `git clone ${urlWithToken} ${directory}`
    )

    if (result.exitCode !== 0) {
      throw new Error(`Failed to clone repository: ${result.stderr}`)
    }

    // Set up git remote without token in URL for security
    if (this.config.githubToken) {
      await this.sandbox.process.startAndWait(
        `cd ${directory} && git remote set-url origin ${cloneUrl}`
      )
    }
  }

  /**
   * Push sandbox changes to GitHub
   */
  async pushToGitHub(
    directory: string = '/app',
    commitMessage?: string,
    branch: string = 'main'
  ): Promise<SyncResult> {
    if (!this.sandbox) throw new Error('Sandbox not initialized')
    if (!this.config.repository) throw new Error('Repository not configured')

    const result: SyncResult = {
      success: false,
      commits: [],
      errors: [],
      filesSync: { added: 0, modified: 0, deleted: 0 }
    }

    try {
      // Check for changes
      const statusResult = await this.sandbox.process.startAndWait(
        `cd ${directory} && git status --porcelain`
      )

      if (!statusResult.stdout.trim()) {
        result.success = true
        return result // No changes to push
      }

      // Parse changes
      const changes = this.parseGitStatus(statusResult.stdout)
      result.filesSync.added = changes.filter(c => c.action === 'add').length
      result.filesSync.modified = changes.filter(c => c.action === 'modify').length
      result.filesSync.deleted = changes.filter(c => c.action === 'delete').length

      // Add all changes
      await this.sandbox.process.startAndWait(`cd ${directory} && git add -A`)

      // Create commit
      const message = commitMessage || this.generateCommitMessage(changes)
      const commitResult = await this.sandbox.process.startAndWait(
        `cd ${directory} && git commit -m "${message}"`
      )

      if (commitResult.exitCode === 0) {
        // Extract commit SHA
        const commitSha = await this.sandbox.process.startAndWait(
          `cd ${directory} && git rev-parse HEAD`
        )
        result.commits?.push(commitSha.stdout.trim())
      }

      // Push changes with authentication
      const pushCommand = this.config.githubToken
        ? `cd ${directory} && git -c http.extraheader="Authorization: Bearer ${this.config.githubToken}" push origin ${branch}`
        : `cd ${directory} && git push origin ${branch}`

      const pushResult = await this.sandbox.process.startAndWait(pushCommand)

      if (pushResult.exitCode === 0) {
        result.success = true
        
        // Update sync status in database
        await this.updateSyncStatus(result)
      } else {
        result.errors?.push(`Push failed: ${pushResult.stderr}`)
      }

    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Pull changes from GitHub to sandbox
   */
  async pullFromGitHub(
    directory: string = '/app',
    branch: string = 'main'
  ): Promise<SyncResult> {
    if (!this.sandbox) throw new Error('Sandbox not initialized')
    if (!this.config.repository) throw new Error('Repository not configured')

    const result: SyncResult = {
      success: false,
      commits: [],
      errors: [],
      filesSync: { added: 0, modified: 0, deleted: 0 }
    }

    try {
      // Fetch latest changes
      const fetchCommand = this.config.githubToken
        ? `cd ${directory} && git -c http.extraheader="Authorization: Bearer ${this.config.githubToken}" fetch origin ${branch}`
        : `cd ${directory} && git fetch origin ${branch}`

      await this.sandbox.process.startAndWait(fetchCommand)

      // Check for differences
      const diffResult = await this.sandbox.process.startAndWait(
        `cd ${directory} && git diff HEAD origin/${branch} --name-status`
      )

      if (!diffResult.stdout.trim()) {
        result.success = true
        return result // No changes to pull
      }

      // Parse changes
      const changes = this.parseGitDiff(diffResult.stdout)
      result.filesSync.added = changes.filter(c => c.action === 'add').length
      result.filesSync.modified = changes.filter(c => c.action === 'modify').length
      result.filesSync.deleted = changes.filter(c => c.action === 'delete').length

      // Pull changes
      const pullCommand = this.config.githubToken
        ? `cd ${directory} && git -c http.extraheader="Authorization: Bearer ${this.config.githubToken}" pull origin ${branch}`
        : `cd ${directory} && git pull origin ${branch}`

      const pullResult = await this.sandbox.process.startAndWait(pullCommand)

      if (pullResult.exitCode === 0) {
        result.success = true
        
        // Get pulled commits
        const logResult = await this.sandbox.process.startAndWait(
          `cd ${directory} && git log --oneline -n 5`
        )
        result.commits = logResult.stdout.split('\n').filter(Boolean).map(line => line.split(' ')[0])
        
        // Update sync status
        await this.updateSyncStatus(result)
      } else {
        result.errors?.push(`Pull failed: ${pullResult.stderr}`)
      }

    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Sync specific files to GitHub
   */
  async syncFiles(
    files: GitHubFile[],
    commitMessage: string,
    branch: string = 'main'
  ): Promise<SyncResult> {
    if (!this.config.repository) throw new Error('Repository not configured')

    const result: SyncResult = {
      success: false,
      commits: [],
      errors: [],
      filesSync: { added: files.length, modified: 0, deleted: 0 }
    }

    try {
      const commit = await this.github.createOrUpdateFiles(
        this.config.repository.owner,
        this.config.repository.name,
        branch,
        files,
        commitMessage,
        {
          author: {
            name: 'PRIA App Builder',
            email: 'pria@example.com'
          }
        }
      )

      result.success = true
      result.commits?.push(commit.sha)
      
      // Update sync status
      await this.updateSyncStatus(result)

    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  /**
   * Get sandbox files for sync
   */
  async getSandboxFiles(directory: string = '/app'): Promise<GitHubFile[]> {
    if (!this.sandbox) throw new Error('Sandbox not initialized')

    const files: GitHubFile[] = []
    
    // Get all files recursively
    const findResult = await this.sandbox.process.startAndWait(
      `find ${directory} -type f -not -path "*/\\.*" -not -path "*/node_modules/*" | head -100`
    )

    const filePaths = findResult.stdout.split('\n').filter(Boolean)

    // Read each file
    for (const filePath of filePaths) {
      try {
        const content = await this.sandbox.filesystem.readTextFile(filePath)
        const relativePath = filePath.replace(`${directory}/`, '')
        
        files.push({
          path: relativePath,
          content: content
        })
      } catch (error) {
        console.error(`Failed to read file ${filePath}:`, error)
      }
    }

    return files
  }

  /**
   * Parse git status output
   */
  private parseGitStatus(statusOutput: string): FileChange[] {
    const changes: FileChange[] = []
    const lines = statusOutput.split('\n').filter(Boolean)

    for (const line of lines) {
      const [status, ...pathParts] = line.trim().split(' ')
      const path = pathParts.join(' ')

      if (status.includes('A') || status.includes('?')) {
        changes.push({ path, action: 'add' })
      } else if (status.includes('M')) {
        changes.push({ path, action: 'modify' })
      } else if (status.includes('D')) {
        changes.push({ path, action: 'delete' })
      }
    }

    return changes
  }

  /**
   * Parse git diff output
   */
  private parseGitDiff(diffOutput: string): FileChange[] {
    const changes: FileChange[] = []
    const lines = diffOutput.split('\n').filter(Boolean)

    for (const line of lines) {
      const [status, path] = line.split('\t')
      
      if (status === 'A') {
        changes.push({ path, action: 'add' })
      } else if (status === 'M') {
        changes.push({ path, action: 'modify' })
      } else if (status === 'D') {
        changes.push({ path, action: 'delete' })
      }
    }

    return changes
  }

  /**
   * Generate commit message based on changes
   */
  private generateCommitMessage(changes: FileChange[]): string {
    const summary = {
      added: changes.filter(c => c.action === 'add').length,
      modified: changes.filter(c => c.action === 'modify').length,
      deleted: changes.filter(c => c.action === 'delete').length
    }

    const parts = []
    if (summary.added > 0) parts.push(`Add ${summary.added} files`)
    if (summary.modified > 0) parts.push(`Update ${summary.modified} files`)
    if (summary.deleted > 0) parts.push(`Remove ${summary.deleted} files`)

    return parts.join(', ') || 'Update project files'
  }

  /**
   * Store repository info in database
   */
  private async storeRepositoryInfo(repository: GitHubRepository): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase.from('github_repositories').upsert({
        workspace_id: this.config.workspaceId,
        session_id: this.config.sessionId,
        repository_id: repository.id,
        repository_name: repository.name,
        repository_owner: repository.owner.login,
        repository_url: repository.html_url,
        clone_url: repository.clone_url,
        ssh_url: repository.ssh_url,
        default_branch: repository.default_branch,
        is_private: repository.private,
        created_at: repository.created_at,
        updated_at: repository.updated_at
      })
    } catch (error) {
      console.error('Failed to store repository info:', error)
    }
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(result: SyncResult): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase.from('github_sync_status').insert({
        workspace_id: this.config.workspaceId,
        session_id: this.config.sessionId,
        repository_owner: this.config.repository?.owner,
        repository_name: this.config.repository?.name,
        sync_type: result.commits?.length ? 'push' : 'pull',
        sync_status: result.success ? 'success' : 'failed',
        files_added: result.filesSync.added,
        files_modified: result.filesSync.modified,
        files_deleted: result.filesSync.deleted,
        commit_shas: result.commits,
        error_messages: result.errors,
        synced_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to update sync status:', error)
    }
  }

  /**
   * Get repository info from database
   */
  static async getRepositoryForSession(
    sessionId: string
  ): Promise<GitHubRepository | null> {
    try {
      const supabase = await createServerClient()
      
      const { data } = await supabase
        .from('github_repositories')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!data) return null

      return {
        id: data.repository_id,
        name: data.repository_name,
        full_name: `${data.repository_owner}/${data.repository_name}`,
        owner: {
          login: data.repository_owner,
          id: 0, // Not stored
          type: 'User'
        },
        private: data.is_private,
        html_url: data.repository_url,
        clone_url: data.clone_url,
        ssh_url: data.ssh_url,
        default_branch: data.default_branch,
        created_at: data.created_at,
        updated_at: data.updated_at
      }
    } catch (error) {
      console.error('Failed to get repository for session:', error)
      return null
    }
  }
}

// Factory function
export function createGitHubSandboxSync(
  config: SandboxSyncConfig,
  githubService?: GitHubIntegrationService
): GitHubSandboxSyncService {
  return new GitHubSandboxSyncService(config, githubService)
}