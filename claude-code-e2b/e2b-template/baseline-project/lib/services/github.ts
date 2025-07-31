// GitHub Integration Service for File Persistence and Version Control
import type { Session, GeneratedFile } from '@/lib/supabase/types'

export interface GitHubConfig {
  owner: string
  repo: string
  branch?: string
  token?: string
}

export interface GitHubFileOperation {
  path: string
  content: string
  message: string
  sha?: string
}

export interface GitHubCommitResult {
  sha: string
  url: string
  files: string[]
  message: string
}

export class GitHubService {
  private config: GitHubConfig
  private baseUrl = 'https://api.github.com'

  constructor(config: GitHubConfig) {
    this.config = {
      ...config,
      branch: config.branch || 'main'
    }
  }

  /**
   * Initialize GitHub integration for a session
   */
  static fromSession(session: Session): GitHubService | null {
    if (!session.github_repo_url) {
      return null
    }

    try {
      const repoUrl = new URL(session.github_repo_url)
      const pathParts = repoUrl.pathname.slice(1).split('/')
      
      if (pathParts.length < 2) {
        throw new Error('Invalid GitHub repository URL')
      }

      return new GitHubService({
        owner: pathParts[0],
        repo: pathParts[1].replace('.git', ''),
        branch: session.github_branch || 'main',
        token: process.env.GITHUB_TOKEN
      })
    } catch (error) {
      console.error('Failed to parse GitHub URL:', error)
      return null
    }
  }

  /**
   * Get file content from GitHub
   */
  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const response = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`
      )

      if (response.type !== 'file') {
        return null
      }

      const content = Buffer.from(response.content, 'base64').toString('utf-8')
      return { content, sha: response.sha }
    } catch (error: any) {
      if (error.status === 404) {
        return null // File doesn't exist
      }
      throw error
    }
  }

  /**
   * Create or update a file in GitHub
   */
  async createOrUpdateFile(operation: GitHubFileOperation): Promise<GitHubCommitResult> {
    const { path, content, message, sha } = operation

    const body: any = {
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch: this.config.branch
    }

    if (sha) {
      body.sha = sha
    }

    const response = await this.apiCall(
      `/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify(body)
      }
    )

    return {
      sha: response.commit.sha,
      url: response.commit.html_url,
      files: [path],
      message
    }
  }

  /**
   * Create multiple files in a single commit
   */
  async createMultipleFiles(
    files: GitHubFileOperation[],
    message: string
  ): Promise<GitHubCommitResult> {
    if (files.length === 0) {
      throw new Error('No files provided')
    }

    if (files.length === 1) {
      return this.createOrUpdateFile({ ...files[0], message })
    }

    // For multiple files, use the Git Data API
    try {
      // Get the current commit SHA
      const branchRef = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/git/ref/heads/${this.config.branch}`
      )
      const currentCommitSha = branchRef.object.sha

      // Get the current tree
      const currentCommit = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/git/commits/${currentCommitSha}`
      )
      const currentTreeSha = currentCommit.tree.sha

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const blobResponse = await this.apiCall(
            `/repos/${this.config.owner}/${this.config.repo}/git/blobs`,
            {
              method: 'POST',
              body: JSON.stringify({
                content: Buffer.from(file.content, 'utf-8').toString('base64'),
                encoding: 'base64'
              })
            }
          )
          return {
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobResponse.sha
          }
        })
      )

      // Create new tree
      const newTree = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/git/trees`,
        {
          method: 'POST',
          body: JSON.stringify({
            base_tree: currentTreeSha,
            tree: blobs
          })
        }
      )

      // Create new commit
      const newCommit = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/git/commits`,
        {
          method: 'POST',
          body: JSON.stringify({
            message,
            tree: newTree.sha,
            parents: [currentCommitSha]
          })
        }
      )

      // Update branch reference
      await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/${this.config.branch}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            sha: newCommit.sha
          })
        }
      )

      return {
        sha: newCommit.sha,
        url: newCommit.html_url,
        files: files.map(f => f.path),
        message
      }
    } catch (error) {
      console.error('Failed to create multiple files:', error)
      throw error
    }
  }

  /**
   * Delete a file from GitHub
   */
  async deleteFile(path: string, message: string): Promise<GitHubCommitResult> {
    // Get file SHA first
    const file = await this.getFile(path)
    if (!file) {
      throw new Error(`File ${path} not found`)
    }

    const response = await this.apiCall(
      `/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message,
          sha: file.sha,
          branch: this.config.branch
        })
      }
    )

    return {
      sha: response.commit.sha,
      url: response.commit.html_url,
      files: [path],
      message
    }
  }

  /**
   * Get repository information
   */
  async getRepoInfo(): Promise<{
    name: string
    full_name: string
    html_url: string
    clone_url: string
    default_branch: string
  }> {
    const response = await this.apiCall(
      `/repos/${this.config.owner}/${this.config.repo}`
    )

    return {
      name: response.name,
      full_name: response.full_name,
      html_url: response.html_url,
      clone_url: response.clone_url,
      default_branch: response.default_branch
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = ''): Promise<Array<{
    name: string
    path: string
    type: 'file' | 'dir'
    size?: number
  }>> {
    try {
      const response = await this.apiCall(
        `/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`
      )

      if (!Array.isArray(response)) {
        return []
      }

      return response.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'dir' : 'file',
        size: item.type === 'file' ? item.size : undefined
      }))
    } catch (error: any) {
      if (error.status === 404) {
        return []
      }
      throw error
    }
  }

  /**
   * Get commit history for a file or directory
   */
  async getCommitHistory(path?: string, limit: number = 10): Promise<Array<{
    sha: string
    message: string
    author: string
    date: string
    url: string
  }>> {
    let url = `/repos/${this.config.owner}/${this.config.repo}/commits?per_page=${limit}&sha=${this.config.branch}`
    
    if (path) {
      url += `&path=${path}`
    }

    const response = await this.apiCall(url)

    return response.map((commit: any) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }))
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<{
    number: number
    url: string
    title: string
  }> {
    const response = await this.apiCall(
      `/repos/${this.config.owner}/${this.config.repo}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          head,
          base,
          body: body || ''
        })
      }
    )

    return {
      number: response.number,
      url: response.html_url,
      title: response.title
    }
  }

  /**
   * Sync generated files to GitHub
   */
  async syncGeneratedFiles(
    files: GeneratedFile[],
    sessionName: string
  ): Promise<GitHubCommitResult> {
    const operations: GitHubFileOperation[] = []

    for (const file of files) {
      if (file.content !== null) {
        operations.push({
          path: file.file_path,
          content: file.content,
          message: `Generated by Claude Code: ${file.file_type} for ${sessionName}`
        })
      }
    }

    const message = `🤖 Generated ${files.length} files for session: ${sessionName}

Generated by Claude Code SDK:
${files.map(f => `- ${f.file_path} (${f.file_type})`).join('\n')}

Co-Authored-By: Claude <noreply@anthropic.com>`

    return this.createMultipleFiles(operations, message)
  }

  /**
   * Make API call to GitHub
   */
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'GitHub API error' }))
      throw new Error(`GitHub API error (${response.status}): ${error.message}`)
    }

    return response.json()
  }
}

/**
 * Utility functions for GitHub integration
 */
export class GitHubUtils {
  /**
   * Parse GitHub repository URL
   */
  static parseRepoUrl(url: string): { owner: string; repo: string } | null {
    try {
      const parsedUrl = new URL(url)
      const pathParts = parsedUrl.pathname.slice(1).split('/')
      
      if (pathParts.length < 2) {
        return null
      }

      return {
        owner: pathParts[0],
        repo: pathParts[1].replace('.git', '')
      }
    } catch {
      return null
    }
  }

  /**
   * Validate GitHub token
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Generate commit message for Claude Code operations
   */
  static generateCommitMessage(
    operationType: string,
    files: string[],
    description?: string
  ): string {
    const emoji = operationType === 'generate_code' ? '🤖' : 
                 operationType === 'analyze_requirements' ? '📋' : '✨'
    
    const filesList = files.length > 5 
      ? `${files.slice(0, 5).join(', ')} and ${files.length - 5} more`
      : files.join(', ')

    let message = `${emoji} ${operationType.replace('_', ' ')}: ${filesList}`
    
    if (description) {
      message += `\n\n${description}`
    }

    message += `\n\n🤖 Generated with Claude Code SDK\n\nCo-Authored-By: Claude <noreply@anthropic.com>`

    return message
  }
}