import simpleGit, { SimpleGit, StatusResult } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'

export interface CommitRequest {
  message: string
  files?: string[]
  author?: {
    name: string
    email: string
  }
}

export interface BranchRequest {
  name: string
  action: 'create' | 'switch' | 'create_and_switch'
  from?: string
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicts: string[]
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: string
}

export class GitService {
  private git: SimpleGit | null = null
  private readonly projectRoot: string
  private isInitialized: boolean = false

  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project'
    this.initialize()
  }

  private async initialize() {
    try {
      // Ensure project directory exists
      await fs.mkdir(this.projectRoot, { recursive: true })
      
      // Initialize simple-git after directory exists
      this.git = simpleGit(this.projectRoot)
      
      // Check if git repository exists
      const isRepo = await this.git.checkIsRepo()
      
      if (!isRepo) {
        console.log('📁 Initializing git repository...')
        await this.git.init()
        
        // Set default configuration if not set
        try {
          await this.git.addConfig('user.name', 'Claude Code E2B')
          await this.git.addConfig('user.email', 'claude@anthropic.com')
        } catch (error) {
          // Config might already exist, continue
        }
      }

      this.isInitialized = true
      console.log('✅ Git service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Git service:', error)
      console.warn('⚠️ Git service will have limited functionality')
    }
  }

  async commit(request: CommitRequest): Promise<{ hash: string; message: string; filesCommitted: number }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      // Set author if provided
      if (request.author) {
        await this.git.addConfig('user.name', request.author.name, false, 'local')
        await this.git.addConfig('user.email', request.author.email, false, 'local')
      }

      // Stage files
      if (request.files && request.files.length > 0) {
        // Stage specific files
        for (const file of request.files) {
          await this.git.add(file)
        }
      } else {
        // Stage all changes
        await this.git.add('.')
      }

      // Get status to count staged files
      const status = await this.git.status()
      const stagedCount = status.staged.length

      if (stagedCount === 0) {
        throw new Error('No changes to commit')
      }

      // Commit changes
      const result = await this.git.commit(request.message)

      return {
        hash: result.commit,
        message: request.message,
        filesCommitted: stagedCount
      }
    } catch (error) {
      console.error('Git commit error:', error)
      throw new Error(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async push(remote: string = 'origin', branch?: string): Promise<{ success: boolean; details: string }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      // Get current branch if not specified
      if (!branch) {
        const status = await this.git.status()
        branch = status.current || 'main'
      }

      // Push to remote
      const result = await this.git.push(remote, branch)
      
      return {
        success: true,
        details: `Successfully pushed to ${remote}/${branch}`
      }
    } catch (error) {
      console.error('Git push error:', error)
      throw new Error(`Failed to push: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async pull(remote: string = 'origin', branch?: string): Promise<{ success: boolean; changes: number }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      // Get current branch if not specified
      if (!branch) {
        const status = await this.git.status()
        branch = status.current || 'main'
      }

      // Pull from remote
      const result = await this.git.pull(remote, branch)
      
      return {
        success: true,
        changes: result.files.length
      }
    } catch (error) {
      console.error('Git pull error:', error)
      throw new Error(`Failed to pull: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getStatus(): Promise<GitStatus> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      const status: StatusResult = await this.git.status()
      
      return {
        branch: status.current || 'unknown',
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        conflicts: status.conflicted
      }
    } catch (error) {
      console.error('Git status error:', error)
      throw new Error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async manageBranch(request: BranchRequest): Promise<{ success: boolean; currentBranch: string }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      switch (request.action) {
        case 'create':
          await this.git.checkoutLocalBranch(request.name)
          break
          
        case 'switch':
          await this.git.checkout(request.name)
          break
          
        case 'create_and_switch':
          if (request.from) {
            await this.git.checkoutBranch(request.name, request.from)
          } else {
            await this.git.checkoutLocalBranch(request.name)
          }
          break
          
        default:
          throw new Error(`Unknown branch action: ${request.action}`)
      }

      const status = await this.git.status()
      
      return {
        success: true,
        currentBranch: status.current || request.name
      }
    } catch (error) {
      console.error('Git branch error:', error)
      throw new Error(`Failed to manage branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getBranches(): Promise<{ current: string; all: string[]; remote: string[] }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      const branches = await this.git.branch(['-a'])
      
      return {
        current: branches.current,
        all: branches.all.filter(b => !b.startsWith('remotes/')),
        remote: branches.all.filter(b => b.startsWith('remotes/'))
      }
    } catch (error) {
      console.error('Git branches error:', error)
      throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getCommitHistory(limit: number = 10): Promise<CommitInfo[]> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      const log = await this.git.log({ maxCount: limit })
      
      return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        author: commit.author_name,
        date: commit.date
      }))
    } catch (error) {
      console.error('Git history error:', error)
      throw new Error(`Failed to get commit history: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async clone(gitUrl: string, directory?: string, branch?: string): Promise<{ success: boolean; path: string }> {
    try {
      const targetPath = directory || path.join('/code/repos', path.basename(gitUrl, '.git'))
      
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      
      // Clone repository
      await simpleGit().clone(gitUrl, targetPath, branch ? ['--branch', branch] : undefined)
      
      return {
        success: true,
        path: targetPath
      }
    } catch (error) {
      console.error('Git clone error:', error)
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async addRemote(name: string, url: string): Promise<{ success: boolean }> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      await this.git.addRemote(name, url)
      
      return { success: true }
    } catch (error) {
      console.error('Git add remote error:', error)
      throw new Error(`Failed to add remote: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getRemotes(): Promise<Array<{ name: string; url: string }>> {
    if (!this.isInitialized || !this.git) {
      throw new Error('Git service not initialized')
    }

    try {
      const remotes = await this.git.getRemotes(true)
      
      return remotes.map(remote => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push
      }))
    } catch (error) {
      console.error('Git remotes error:', error)
      throw new Error(`Failed to get remotes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  isHealthy(): boolean {
    return this.isInitialized && !!this.git
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      projectRoot: this.projectRoot
    }
  }
}