/**
 * GitHub Code Sync Service - Advanced push/pull functionality for target app code
 * Handles intelligent code synchronization with conflict resolution and change tracking
 */

import { Sandbox } from 'e2b'
import { GitHubIntegrationService } from './github-integration'
import { E2BGitHubSetupService } from './e2b-github-setup'
import createServerClient from '@/lib/supabase/server'

export interface CodeSyncConfig {
  sessionId: string
  workspaceId: string
  sandboxId: string
  repositoryOwner: string
  repositoryName: string
  branch: string
  githubToken: string
}

export interface FileChangeInfo {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  content?: string
  oldPath?: string
  size?: number
  lastModified?: string
}

export interface SyncOperation {
  id: string
  type: 'push' | 'pull'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'conflict'
  startTime: Date
  endTime?: Date
  changes: FileChangeInfo[]
  conflicts?: ConflictInfo[]
  commit?: {
    sha: string
    message: string
    author: string
    timestamp: string
  }
  errors?: string[]
}

export interface ConflictInfo {
  path: string
  conflictType: 'content' | 'rename' | 'delete_modify'
  localContent?: string
  remoteContent?: string
  resolution?: 'local' | 'remote' | 'merge' | 'manual'
}

export interface SyncResult {
  success: boolean
  operation: SyncOperation
  summary: {
    filesAdded: number
    filesModified: number
    filesDeleted: number
    filesRenamed: number
    conflicts: number
  }
  nextActions?: string[]
}

/**
 * GitHubCodeSyncService - Advanced GitHub synchronization
 */
export class GitHubCodeSyncService {
  private sandbox: Sandbox
  private config: CodeSyncConfig
  private github: GitHubIntegrationService
  private operations: Map<string, SyncOperation> = new Map()

  constructor(sandbox: Sandbox, config: CodeSyncConfig) {
    this.sandbox = sandbox
    this.config = config
    this.github = new GitHubIntegrationService({ accessToken: config.githubToken })
  }

  /**
   * Enhanced push operation with intelligent change detection
   */
  async pushToGitHub(
    commitMessage: string,
    options: {
      createPullRequest?: boolean
      targetBranch?: string
      skipEmptyCommit?: boolean
      includePatterns?: string[]
      excludePatterns?: string[]
    } = {}
  ): Promise<SyncResult> {
    const operationId = `push_${Date.now()}`
    const operation: SyncOperation = {
      id: operationId,
      type: 'push',
      status: 'pending',
      startTime: new Date(),
      changes: [],
      errors: []
    }

    this.operations.set(operationId, operation)

    try {
      operation.status = 'running'
      console.log(`[SYNC] Starting push operation: ${operationId}`)

      // 1. Verify GitHub setup
      const isSetup = await E2BGitHubSetupService.isGitHubSetup(this.sandbox)
      if (!isSetup) {
        throw new Error('GitHub not properly set up in sandbox')
      }

      // 2. Navigate to project directory
      const projectPath = '/app'
      
      // 3. Detect file changes
      const changes = await this.detectFileChanges(projectPath, options)
      operation.changes = changes

      if (changes.length === 0 && options.skipEmptyCommit) {
        operation.status = 'completed'
        operation.endTime = new Date()
        
        return {
          success: true,
          operation,
          summary: {
            filesAdded: 0,
            filesModified: 0,
            filesDeleted: 0,
            filesRenamed: 0,
            conflicts: 0
          },
          nextActions: ['No changes to push']
        }
      }

      // 4. Stage changes
      await this.stageChanges(projectPath, changes)

      // 5. Create commit
      const commitResult = await this.createCommit(projectPath, commitMessage)
      operation.commit = commitResult

      // 6. Push to repository
      const pushResult = await this.pushCommit(projectPath, this.config.branch)
      
      if (!pushResult.success) {
        throw new Error(pushResult.error || 'Push failed')
      }

      // 7. Create pull request if requested
      if (options.createPullRequest && options.targetBranch) {
        await this.createPullRequestFromPush(
          commitMessage,
          this.config.branch,
          options.targetBranch
        )
      }

      operation.status = 'completed'
      operation.endTime = new Date()

      // 8. Update database
      await this.recordSyncOperation(operation)

      const summary = this.calculateChangeSummary(changes)
      
      return {
        success: true,
        operation,
        summary,
        nextActions: this.generateNextActions(operation, summary)
      }

    } catch (error) {
      operation.status = 'failed'
      operation.endTime = new Date()
      operation.errors?.push(error instanceof Error ? error.message : 'Unknown error')
      
      await this.recordSyncOperation(operation)
      
      return {
        success: false,
        operation,
        summary: {
          filesAdded: 0,
          filesModified: 0,
          filesDeleted: 0,
          filesRenamed: 0,
          conflicts: 0
        }
      }
    }
  }

  /**
   * Enhanced pull operation with conflict detection
   */
  async pullFromGitHub(
    options: {
      strategy?: 'merge' | 'rebase' | 'reset'
      resolveConflicts?: boolean
      backupLocal?: boolean
    } = {}
  ): Promise<SyncResult> {
    const operationId = `pull_${Date.now()}`
    const operation: SyncOperation = {
      id: operationId,
      type: 'pull',
      status: 'pending',
      startTime: new Date(),
      changes: [],
      conflicts: [],
      errors: []
    }

    this.operations.set(operationId, operation)

    try {
      operation.status = 'running'
      console.log(`[SYNC] Starting pull operation: ${operationId}`)

      const projectPath = '/app'

      // 1. Backup local changes if requested
      if (options.backupLocal) {
        await this.createLocalBackup(projectPath)
      }

      // 2. Fetch latest changes
      await this.fetchRemoteChanges(projectPath)

      // 3. Detect conflicts
      const conflicts = await this.detectConflicts(projectPath, this.config.branch)
      operation.conflicts = conflicts

      if (conflicts.length > 0 && !options.resolveConflicts) {
        operation.status = 'conflict'
        operation.endTime = new Date()
        
        return {
          success: false,
          operation,
          summary: {
            filesAdded: 0,
            filesModified: 0,
            filesDeleted: 0,
            filesRenamed: 0,
            conflicts: conflicts.length
          }
        }
      }

      // 4. Pull changes with specified strategy
      const pullResult = await this.executePullStrategy(projectPath, options.strategy || 'merge')

      // 5. Detect what changed after pull
      const changes = await this.detectPulledChanges(projectPath)
      operation.changes = changes

      operation.status = 'completed'
      operation.endTime = new Date()

      await this.recordSyncOperation(operation)

      const summary = this.calculateChangeSummary(changes)
      
      return {
        success: true,
        operation,
        summary,
        nextActions: this.generateNextActions(operation, summary)
      }

    } catch (error) {
      operation.status = 'failed'
      operation.endTime = new Date()
      operation.errors?.push(error instanceof Error ? error.message : 'Unknown error')
      
      await this.recordSyncOperation(operation)
      
      return {
        success: false,
        operation,
        summary: {
          filesAdded: 0,
          filesModified: 0,
          filesDeleted: 0,
          filesRenamed: 0,
          conflicts: operation.conflicts?.length || 0
        }
      }
    }
  }

  /**
   * Detect file changes in the project
   */
  private async detectFileChanges(
    projectPath: string,
    options: {
      includePatterns?: string[]
      excludePatterns?: string[]
    }
  ): Promise<FileChangeInfo[]> {
    const changes: FileChangeInfo[] = []

    // Get git status
    const statusResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git status --porcelain=v2`
    )

    if (statusResult.exitCode !== 0) {
      throw new Error(`Failed to get git status: ${statusResult.stderr}`)
    }

    const statusLines = statusResult.stdout.split('\n').filter(Boolean)

    for (const line of statusLines) {
      if (line.startsWith('1 ') || line.startsWith('2 ')) {
        // Changed file
        const parts = line.split(' ')
        const statusCode = parts[1]
        const path = parts.slice(-1)[0]

        // Skip if doesn't match patterns
        if (!this.matchesPatterns(path, options.includePatterns, options.excludePatterns)) {
          continue
        }

        let status: FileChangeInfo['status'] = 'modified'
        if (statusCode.includes('A')) status = 'added'
        else if (statusCode.includes('D')) status = 'deleted'
        else if (statusCode.includes('R')) status = 'renamed'

        const change: FileChangeInfo = {
          path,
          status
        }

        // Get file content for non-deleted files
        if (status !== 'deleted') {
          try {
            const content = await this.sandbox.filesystem.readTextFile(`${projectPath}/${path}`)
            change.content = content
            change.size = content.length
          } catch (error) {
            console.warn(`[SYNC] Could not read file ${path}:`, error)
          }
        }

        changes.push(change)
      }
    }

    return changes
  }

  /**
   * Stage changes for commit
   */
  private async stageChanges(projectPath: string, changes: FileChangeInfo[]): Promise<void> {
    for (const change of changes) {
      if (change.status === 'deleted') {
        await this.sandbox.process.startAndWait(
          `cd ${projectPath} && git rm "${change.path}"`
        )
      } else {
        await this.sandbox.process.startAndWait(
          `cd ${projectPath} && git add "${change.path}"`
        )
      }
    }
  }

  /**
   * Create commit with changes
   */
  private async createCommit(
    projectPath: string,
    message: string
  ): Promise<{ sha: string; message: string; author: string; timestamp: string }> {
    const commitResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git commit -m "${message}"`
    )

    if (commitResult.exitCode !== 0) {
      throw new Error(`Commit failed: ${commitResult.stderr}`)
    }

    // Get commit info
    const shaResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git rev-parse HEAD`
    )
    
    const authorResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git log -1 --format="%an <%ae>"`
    )

    return {
      sha: shaResult.stdout.trim(),
      message,
      author: authorResult.stdout.trim(),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Push commit to remote
   */
  private async pushCommit(
    projectPath: string,
    branch: string
  ): Promise<{ success: boolean; error?: string }> {
    const pushResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git push origin ${branch}`
    )

    return {
      success: pushResult.exitCode === 0,
      error: pushResult.exitCode !== 0 ? pushResult.stderr : undefined
    }
  }

  /**
   * Fetch remote changes
   */
  private async fetchRemoteChanges(projectPath: string): Promise<void> {
    const fetchResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git fetch origin ${this.config.branch}`
    )

    if (fetchResult.exitCode !== 0) {
      throw new Error(`Fetch failed: ${fetchResult.stderr}`)
    }
  }

  /**
   * Detect conflicts between local and remote
   */
  private async detectConflicts(projectPath: string, branch: string): Promise<ConflictInfo[]> {
    // Check for merge conflicts
    const mergeResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git merge-tree $(git merge-base HEAD origin/${branch}) HEAD origin/${branch}`
    )

    const conflicts: ConflictInfo[] = []

    if (mergeResult.stdout.trim()) {
      // Parse conflict information
      const conflictFiles = mergeResult.stdout.split('\n').filter(line => 
        line.includes('<<<<<<< ') || line.includes('=======') || line.includes('>>>>>>> ')
      )

      // This is a simplified conflict detection - in production, use more sophisticated parsing
      for (const line of conflictFiles) {
        if (line.includes('<<<<<<<')) {
          const path = line.split(' ')[1] || 'unknown'
          conflicts.push({
            path,
            conflictType: 'content'
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Execute pull strategy
   */
  private async executePullStrategy(
    projectPath: string,
    strategy: 'merge' | 'rebase' | 'reset'
  ): Promise<void> {
    let command: string

    switch (strategy) {
      case 'rebase':
        command = `cd ${projectPath} && git rebase origin/${this.config.branch}`
        break
      case 'reset':
        command = `cd ${projectPath} && git reset --hard origin/${this.config.branch}`
        break
      case 'merge':
      default:
        command = `cd ${projectPath} && git merge origin/${this.config.branch}`
        break
    }

    const result = await this.sandbox.process.startAndWait(command)
    
    if (result.exitCode !== 0) {
      throw new Error(`${strategy} failed: ${result.stderr}`)
    }
  }

  /**
   * Detect changes after pull
   */
  private async detectPulledChanges(projectPath: string): Promise<FileChangeInfo[]> {
    // Compare with previous HEAD to see what changed
    const diffResult = await this.sandbox.process.startAndWait(
      `cd ${projectPath} && git diff --name-status HEAD@{1} HEAD`
    )

    const changes: FileChangeInfo[] = []

    if (diffResult.exitCode === 0 && diffResult.stdout.trim()) {
      const lines = diffResult.stdout.split('\n').filter(Boolean)
      
      for (const line of lines) {
        const [statusCode, path] = line.split('\t')
        
        let status: FileChangeInfo['status'] = 'modified'
        if (statusCode === 'A') status = 'added'
        else if (statusCode === 'D') status = 'deleted'
        else if (statusCode.startsWith('R')) status = 'renamed'

        changes.push({ path, status })
      }
    }

    return changes
  }

  /**
   * Create local backup
   */
  private async createLocalBackup(projectPath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `/tmp/backup-${timestamp}`
    
    await this.sandbox.process.startAndWait(
      `cp -r ${projectPath} ${backupPath}`
    )
    
    console.log(`[SYNC] Created local backup at ${backupPath}`)
  }

  /**
   * Create pull request from push
   */
  private async createPullRequestFromPush(
    title: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<void> {
    await this.github.createPullRequest(
      this.config.repositoryOwner,
      this.config.repositoryName,
      title,
      sourceBranch,
      targetBranch,
      'Automated pull request created by PRIA App Builder'
    )
  }

  /**
   * Record sync operation in database
   */
  private async recordSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      const summary = this.calculateChangeSummary(operation.changes)
      
      await supabase.from('github_sync_status').insert({
        workspace_id: this.config.workspaceId,
        session_id: this.config.sessionId,
        repository_owner: this.config.repositoryOwner,
        repository_name: this.config.repositoryName,
        sync_type: operation.type,
        sync_status: operation.status === 'completed' ? 'success' : 
                    operation.status === 'conflict' ? 'partial' : 'failed',
        files_added: summary.filesAdded,
        files_modified: summary.filesModified,
        files_deleted: summary.filesDeleted,
        commit_shas: operation.commit ? [operation.commit.sha] : [],
        error_messages: operation.errors || [],
        synced_at: operation.endTime?.toISOString() || new Date().toISOString()
      })
    } catch (error) {
      console.error('[SYNC] Failed to record operation:', error)
    }
  }

  /**
   * Calculate change summary
   */
  private calculateChangeSummary(changes: FileChangeInfo[]): {
    filesAdded: number
    filesModified: number
    filesDeleted: number
    filesRenamed: number
    conflicts: number
  } {
    return {
      filesAdded: changes.filter(c => c.status === 'added').length,
      filesModified: changes.filter(c => c.status === 'modified').length,
      filesDeleted: changes.filter(c => c.status === 'deleted').length,
      filesRenamed: changes.filter(c => c.status === 'renamed').length,
      conflicts: 0
    }
  }

  /**
   * Generate next action suggestions
   */
  private generateNextActions(operation: SyncOperation, summary: any): string[] {
    const actions: string[] = []

    if (operation.type === 'push' && operation.status === 'completed') {
      actions.push('Code successfully pushed to GitHub')
      if (summary.filesAdded > 0) actions.push(`${summary.filesAdded} new files added`)
      if (summary.filesModified > 0) actions.push(`${summary.filesModified} files updated`)
    }

    if (operation.type === 'pull' && operation.status === 'completed') {
      actions.push('Latest changes pulled from GitHub')
      if (summary.filesAdded > 0) actions.push(`${summary.filesAdded} new files received`)
    }

    if (operation.conflicts && operation.conflicts.length > 0) {
      actions.push('Resolve conflicts before proceeding')
    }

    return actions
  }

  /**
   * Check if path matches patterns
   */
  private matchesPatterns(
    path: string,
    includePatterns?: string[],
    excludePatterns?: string[]
  ): boolean {
    // Exclude patterns take precedence
    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        if (this.matchesGlob(path, pattern)) return false
      }
    }

    // If no include patterns, include everything (that's not excluded)
    if (!includePatterns || includePatterns.length === 0) return true

    // Check include patterns
    for (const pattern of includePatterns) {
      if (this.matchesGlob(path, pattern)) return true
    }

    return false
  }

  /**
   * Simple glob pattern matching
   */
  private matchesGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    
    return new RegExp(regexPattern).test(path)
  }

  /**
   * Get operation status
   */
  getOperation(operationId: string): SyncOperation | null {
    return this.operations.get(operationId) || null
  }

  /**
   * Get all operations
   */
  getAllOperations(): SyncOperation[] {
    return Array.from(this.operations.values())
  }
}

// Factory function
export function createGitHubCodeSync(
  sandbox: Sandbox,
  config: CodeSyncConfig
): GitHubCodeSyncService {
  return new GitHubCodeSyncService(sandbox, config)
}