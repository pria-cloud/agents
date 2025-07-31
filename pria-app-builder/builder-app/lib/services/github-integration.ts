/**
 * GitHub Integration Service - Manages GitHub repository operations for target app code
 * Handles authentication, repository creation, and code synchronization
 */

import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device'

export interface GitHubConfig {
  accessToken?: string
  appId?: string
  privateKey?: string
  installationId?: number
  clientId?: string
  clientSecret?: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    id: number
    type: 'User' | 'Organization'
  }
  private: boolean
  html_url: string
  clone_url: string
  ssh_url: string
  default_branch: string
  created_at: string
  updated_at: string
}

export interface GitHubFile {
  path: string
  content: string
  mode?: '100644' | '100755' | '040000' | '160000' | '120000'
  type?: 'blob' | 'tree' | 'commit'
}

export interface GitHubCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  url: string
}

export interface GitHubBranch {
  name: string
  commit: {
    sha: string
    url: string
  }
  protected: boolean
}

export interface GitHubUser {
  login: string
  id: number
  name?: string
  email?: string
  avatar_url: string
  html_url: string
}

/**
 * GitHubIntegrationService - Core service for GitHub operations
 */
export class GitHubIntegrationService {
  private octokit: Octokit
  private authenticated: boolean = false
  private currentUser: GitHubUser | null = null

  constructor(config: GitHubConfig) {
    // Initialize Octokit based on authentication method
    if (config.accessToken) {
      // Personal Access Token authentication
      this.octokit = new Octokit({
        auth: config.accessToken
      })
      this.authenticated = true
    } else if (config.appId && config.privateKey && config.installationId) {
      // GitHub App authentication
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.privateKey,
          installationId: config.installationId
        }
      })
      this.authenticated = true
    } else if (config.clientId) {
      // OAuth Device Flow authentication
      this.octokit = new Octokit({
        authStrategy: createOAuthDeviceAuth,
        auth: {
          clientType: 'oauth-app',
          clientId: config.clientId
        }
      })
    } else {
      // Unauthenticated (limited functionality)
      this.octokit = new Octokit()
    }
  }

  /**
   * Authenticate with GitHub using OAuth Device Flow
   */
  async authenticateWithDeviceFlow(
    clientId: string,
    onVerification: (verification: { user_code: string; verification_uri: string }) => void
  ): Promise<void> {
    const auth = createOAuthDeviceAuth({
      clientType: 'oauth-app',
      clientId: clientId,
      onVerification
    })

    const { token } = await auth({ type: 'oauth' })
    
    // Reinitialize Octokit with the new token
    this.octokit = new Octokit({ auth: token })
    this.authenticated = true
    
    // Get current user info
    await this.getCurrentUser()
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub')
    }

    try {
      const { data } = await this.octokit.users.getAuthenticated()
      this.currentUser = {
        login: data.login,
        id: data.id,
        name: data.name || undefined,
        email: data.email || undefined,
        avatar_url: data.avatar_url,
        html_url: data.html_url
      }
      return this.currentUser
    } catch (error) {
      console.error('Failed to get current user:', error)
      return null
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(
    name: string,
    options: {
      description?: string
      private?: boolean
      auto_init?: boolean
      gitignore_template?: string
      license_template?: string
      organization?: string
    } = {}
  ): Promise<GitHubRepository> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub')
    }

    try {
      const createOptions = {
        name,
        description: options.description || 'Created by PRIA App Builder',
        private: options.private ?? true,
        auto_init: options.auto_init ?? true,
        gitignore_template: options.gitignore_template || 'Node',
        license_template: options.license_template
      }

      const { data } = options.organization
        ? await this.octokit.repos.createInOrg({
            org: options.organization,
            ...createOptions
          })
        : await this.octokit.repos.createForAuthenticatedUser(createOptions)

      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        owner: {
          login: data.owner.login,
          id: data.owner.id,
          type: data.owner.type as 'User' | 'Organization'
        },
        private: data.private,
        html_url: data.html_url,
        clone_url: data.clone_url,
        ssh_url: data.ssh_url,
        default_branch: data.default_branch,
        created_at: data.created_at,
        updated_at: data.updated_at
      }
    } catch (error) {
      console.error('Failed to create repository:', error)
      throw error
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository | null> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo })
      
      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        owner: {
          login: data.owner.login,
          id: data.owner.id,
          type: data.owner.type as 'User' | 'Organization'
        },
        private: data.private,
        html_url: data.html_url,
        clone_url: data.clone_url,
        ssh_url: data.ssh_url,
        default_branch: data.default_branch,
        created_at: data.created_at,
        updated_at: data.updated_at
      }
    } catch (error) {
      console.error('Failed to get repository:', error)
      return null
    }
  }

  /**
   * Create or update multiple files in a repository
   */
  async createOrUpdateFiles(
    owner: string,
    repo: string,
    branch: string,
    files: GitHubFile[],
    commitMessage: string,
    options: {
      author?: { name: string; email: string }
      committer?: { name: string; email: string }
    } = {}
  ): Promise<GitHubCommit> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub')
    }

    try {
      // Get the current commit SHA for the branch
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      })
      const currentCommitSha = refData.object.sha

      // Get the tree SHA for the current commit
      const { data: commitData } = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha
      })
      const currentTreeSha = commitData.tree.sha

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const { data } = await this.octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64'
          })
          return {
            path: file.path,
            mode: file.mode || '100644',
            type: 'blob' as const,
            sha: data.sha
          }
        })
      )

      // Create a new tree
      const { data: treeData } = await this.octokit.git.createTree({
        owner,
        repo,
        tree: blobs,
        base_tree: currentTreeSha
      })

      // Create a new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: treeData.sha,
        parents: [currentCommitSha],
        author: options.author,
        committer: options.committer
      })

      // Update the branch reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      })

      return {
        sha: newCommit.sha,
        message: newCommit.message,
        author: {
          name: newCommit.author.name,
          email: newCommit.author.email,
          date: newCommit.author.date
        },
        url: newCommit.html_url
      }
    } catch (error) {
      console.error('Failed to create or update files:', error)
      throw error
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string } | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref
      })

      if ('content' in data && data.type === 'file') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        return {
          content,
          sha: data.sha
        }
      }

      return null
    } catch (error) {
      console.error('Failed to get file content:', error)
      return null
    }
  }

  /**
   * List repository branches
   */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      const { data } = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100
      })

      return data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        protected: branch.protected
      }))
    } catch (error) {
      console.error('Failed to list branches:', error)
      return []
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    branch: string,
    fromBranch: string = 'main'
  ): Promise<boolean> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub')
    }

    try {
      // Get the SHA of the branch to branch from
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${fromBranch}`
      })

      // Create the new branch
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: refData.object.sha
      })

      return true
    } catch (error) {
      console.error('Failed to create branch:', error)
      return false
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<{ number: number; html_url: string } | null> {
    if (!this.authenticated) {
      throw new Error('Not authenticated with GitHub')
    }

    try {
      const { data } = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body: body || 'Created by PRIA App Builder'
      })

      return {
        number: data.number,
        html_url: data.html_url
      }
    } catch (error) {
      console.error('Failed to create pull request:', error)
      return null
    }
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({ owner, repo })
      return true
    } catch (error) {
      if ((error as any).status === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Generate repository name based on session/workspace
   */
  generateRepositoryName(
    workspaceName: string,
    projectName: string,
    sessionId: string
  ): string {
    // Clean and format the repository name
    const cleanWorkspace = workspaceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const cleanProject = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const shortSessionId = sessionId.split('-')[0]
    
    return `${cleanWorkspace}-${cleanProject}-${shortSessionId}`
  }

  /**
   * Check authentication status
   */
  isAuthenticated(): boolean {
    return this.authenticated
  }

  /**
   * Get current user info
   */
  getUserInfo(): GitHubUser | null {
    return this.currentUser
  }
}

// Factory function to create GitHub integration service
export function createGitHubIntegration(config: GitHubConfig): GitHubIntegrationService {
  return new GitHubIntegrationService(config)
}