/**
 * E2B GitHub Setup Service - Configures GitHub access within E2B sandboxes
 * Handles authentication, git configuration, and repository setup in target app environment
 */

import { Sandbox } from 'e2b'
import createServerClient from '@/lib/supabase/server'

export interface E2BGitHubConfig {
  sessionId: string
  workspaceId: string
  sandboxId: string
  githubToken?: string
  githubUsername?: string
  githubEmail?: string
  repositoryUrl?: string
  branch?: string
}

export interface GitSetupResult {
  success: boolean
  gitVersion?: string
  userConfigured: boolean
  repositoryCloned: boolean
  errors?: string[]
  sshKeyGenerated?: boolean
  tokenConfigured?: boolean
}

/**
 * E2BGitHubSetupService - Manages GitHub configuration in E2B sandboxes
 */
export class E2BGitHubSetupService {
  private sandbox: Sandbox
  private config: E2BGitHubConfig

  constructor(sandbox: Sandbox, config: E2BGitHubConfig) {
    this.sandbox = sandbox
    this.config = config
  }

  /**
   * Complete GitHub setup in E2B sandbox
   */
  async setupGitHubAccess(): Promise<GitSetupResult> {
    const result: GitSetupResult = {
      success: false,
      userConfigured: false,
      repositoryCloned: false,
      errors: []
    }

    try {
      console.log('[E2B-GITHUB] Starting GitHub setup in sandbox...')
      
      // 1. Install git if not present
      await this.installGit()
      result.gitVersion = await this.getGitVersion()

      // 2. Configure git user
      const userConfigSuccess = await this.configureGitUser()
      result.userConfigured = userConfigSuccess

      // 3. Configure GitHub authentication
      const authSuccess = await this.configureGitHubAuth()
      result.tokenConfigured = authSuccess

      // 4. Generate SSH key for additional security (optional)
      const sshSuccess = await this.generateSSHKey()
      result.sshKeyGenerated = sshSuccess

      // 5. Clone repository if URL provided
      if (this.config.repositoryUrl) {
        const cloneSuccess = await this.cloneRepository()
        result.repositoryCloned = cloneSuccess
      }

      // 6. Verify setup
      const verificationSuccess = await this.verifySetup()
      result.success = verificationSuccess && userConfigSuccess && authSuccess

      if (result.success) {
        console.log('[E2B-GITHUB] GitHub setup completed successfully')
        await this.updateSetupStatus('completed')
      } else {
        console.log('[E2B-GITHUB] GitHub setup completed with issues')
        await this.updateSetupStatus('partial')
      }

    } catch (error) {
      console.error('[E2B-GITHUB] GitHub setup failed:', error)
      result.success = false
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error')
      await this.updateSetupStatus('failed')
    }

    return result
  }

  /**
   * Install git in the sandbox
   */
  private async installGit(): Promise<void> {
    console.log('[E2B-GITHUB] Installing git...')
    
    // Update package lists
    await this.sandbox.process.startAndWait('apt-get update')
    
    // Install git and related tools
    const installResult = await this.sandbox.process.startAndWait(
      'apt-get install -y git git-lfs curl wget'
    )
    
    if (installResult.exitCode !== 0) {
      throw new Error(`Git installation failed: ${installResult.stderr}`)
    }
    
    console.log('[E2B-GITHUB] Git installed successfully')
  }

  /**
   * Get git version to verify installation
   */
  private async getGitVersion(): Promise<string> {
    const result = await this.sandbox.process.startAndWait('git --version')
    if (result.exitCode === 0) {
      return result.stdout.trim()
    }
    throw new Error('Git not properly installed')
  }

  /**
   * Configure git user settings
   */
  private async configureGitUser(): Promise<boolean> {
    try {
      console.log('[E2B-GITHUB] Configuring git user...')
      
      // Get GitHub user info from database if not provided
      let username = this.config.githubUsername
      let email = this.config.githubEmail
      
      if (!username || !email) {
        const authInfo = await this.getGitHubAuthInfo()
        username = username || authInfo?.username || 'PRIA App Builder'
        email = email || authInfo?.email || 'pria@example.com'
      }

      // Configure git user globally
      await this.sandbox.process.startAndWait(
        `git config --global user.name "${username}"`
      )
      
      await this.sandbox.process.startAndWait(
        `git config --global user.email "${email}"`
      )

      // Set additional git configurations for better experience
      await this.sandbox.process.startAndWait(
        'git config --global init.defaultBranch main'
      )
      
      await this.sandbox.process.startAndWait(
        'git config --global pull.rebase false'
      )
      
      await this.sandbox.process.startAndWait(
        'git config --global push.default simple'
      )

      console.log(`[E2B-GITHUB] Git user configured: ${username} <${email}>`)
      return true
      
    } catch (error) {
      console.error('[E2B-GITHUB] Failed to configure git user:', error)
      return false
    }
  }

  /**
   * Configure GitHub authentication
   */
  private async configureGitHubAuth(): Promise<boolean> {
    try {
      console.log('[E2B-GITHUB] Configuring GitHub authentication...')
      
      // Get GitHub token from database if not provided
      let token = this.config.githubToken
      if (!token) {
        const authInfo = await this.getGitHubAuthInfo()
        token = authInfo?.token
      }

      if (!token) {
        console.warn('[E2B-GITHUB] No GitHub token available for authentication')
        return false
      }

      // Configure git credential helper for GitHub
      await this.sandbox.process.startAndWait(
        'git config --global credential.helper store'
      )

      // Create git credentials file with token
      const credentialsContent = `https://${token}@github.com`
      await this.sandbox.filesystem.writeTextFile(
        '/root/.git-credentials',
        credentialsContent
      )

      // Set file permissions for security
      await this.sandbox.process.startAndWait('chmod 600 /root/.git-credentials')

      // Configure GitHub CLI if available
      await this.installAndConfigureGitHubCLI(token)

      console.log('[E2B-GITHUB] GitHub authentication configured')
      return true
      
    } catch (error) {
      console.error('[E2B-GITHUB] Failed to configure GitHub auth:', error)
      return false
    }
  }

  /**
   * Install and configure GitHub CLI
   */
  private async installAndConfigureGitHubCLI(token: string): Promise<void> {
    try {
      // Install GitHub CLI
      await this.sandbox.process.startAndWait(
        'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg'
      )
      
      await this.sandbox.process.startAndWait(
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null'
      )
      
      await this.sandbox.process.startAndWait('apt update')
      const ghInstallResult = await this.sandbox.process.startAndWait('apt install -y gh')
      
      if (ghInstallResult.exitCode === 0) {
        // Configure GitHub CLI with token
        const authResult = await this.sandbox.process.startAndWait(
          `echo "${token}" | gh auth login --with-token`
        )
        
        if (authResult.exitCode === 0) {
          console.log('[E2B-GITHUB] GitHub CLI configured successfully')
        }
      }
    } catch (error) {
      console.warn('[E2B-GITHUB] GitHub CLI setup failed (non-critical):', error)
    }
  }

  /**
   * Generate SSH key for GitHub (optional additional security)
   */
  private async generateSSHKey(): Promise<boolean> {
    try {
      console.log('[E2B-GITHUB] Generating SSH key...')
      
      const email = this.config.githubEmail || 'pria@example.com'
      
      // Generate SSH key
      const keyGenResult = await this.sandbox.process.startAndWait(
        `ssh-keygen -t ed25519 -C "${email}" -f /root/.ssh/id_ed25519 -N ""`
      )
      
      if (keyGenResult.exitCode !== 0) {
        throw new Error('SSH key generation failed')
      }

      // Start SSH agent and add key
      await this.sandbox.process.startAndWait('eval "$(ssh-agent -s)"')
      await this.sandbox.process.startAndWait('ssh-add /root/.ssh/id_ed25519')

      // Add GitHub to known hosts
      await this.sandbox.process.startAndWait(
        'ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts'
      )

      // Get public key for potential manual upload
      const pubKeyResult = await this.sandbox.process.startAndWait('cat /root/.ssh/id_ed25519.pub')
      if (pubKeyResult.exitCode === 0) {
        console.log('[E2B-GITHUB] SSH key generated. Public key:')
        console.log(pubKeyResult.stdout)
      }

      return true
      
    } catch (error) {
      console.error('[E2B-GITHUB] SSH key generation failed:', error)
      return false
    }
  }

  /**
   * Clone repository if URL is provided
   */
  private async cloneRepository(): Promise<boolean> {
    try {
      if (!this.config.repositoryUrl) {
        return false
      }

      console.log(`[E2B-GITHUB] Cloning repository: ${this.config.repositoryUrl}`)
      
      // Create target directory
      await this.sandbox.process.startAndWait('mkdir -p /app')
      
      // Clone repository
      const cloneResult = await this.sandbox.process.startAndWait(
        `git clone ${this.config.repositoryUrl} /app`
      )
      
      if (cloneResult.exitCode !== 0) {
        throw new Error(`Repository clone failed: ${cloneResult.stderr}`)
      }

      // Switch to specified branch if provided
      if (this.config.branch && this.config.branch !== 'main') {
        const branchResult = await this.sandbox.process.startAndWait(
          `cd /app && git checkout ${this.config.branch}`
        )
        
        if (branchResult.exitCode !== 0) {
          console.warn(`[E2B-GITHUB] Failed to switch to branch ${this.config.branch}`)
        }
      }

      console.log('[E2B-GITHUB] Repository cloned successfully')
      return true
      
    } catch (error) {
      console.error('[E2B-GITHUB] Repository clone failed:', error)
      return false
    }
  }

  /**
   * Verify the GitHub setup
   */
  private async verifySetup(): Promise<boolean> {
    try {
      console.log('[E2B-GITHUB] Verifying GitHub setup...')
      
      // Test git configuration
      const userResult = await this.sandbox.process.startAndWait('git config --global user.name')
      const emailResult = await this.sandbox.process.startAndWait('git config --global user.email')
      
      if (userResult.exitCode !== 0 || emailResult.exitCode !== 0) {
        throw new Error('Git user configuration verification failed')
      }

      // Test GitHub connectivity
      const connectivityResult = await this.sandbox.process.startAndWait(
        'curl -s -o /dev/null -w "%{http_code}" https://api.github.com'
      )
      
      if (connectivityResult.stdout.trim() !== '200') {
        throw new Error('GitHub connectivity test failed')
      }

      // Test GitHub authentication if token is available
      if (this.config.githubToken) {
        const authTestResult = await this.sandbox.process.startAndWait(
          `curl -s -H "Authorization: Bearer ${this.config.githubToken}" https://api.github.com/user`
        )
        
        if (authTestResult.exitCode !== 0) {
          throw new Error('GitHub authentication test failed')
        }
      }

      console.log('[E2B-GITHUB] GitHub setup verification passed')
      return true
      
    } catch (error) {
      console.error('[E2B-GITHUB] Setup verification failed:', error)
      return false
    }
  }

  /**
   * Get GitHub authentication info from database
   */
  private async getGitHubAuthInfo(): Promise<{
    username?: string
    email?: string
    token?: string
  } | null> {
    try {
      const supabase = await createServerClient()
      
      const { data } = await supabase
        .from('github_auth')
        .select('github_username, github_email, access_token')
        .eq('workspace_id', this.config.workspaceId)
        .single()
      
      if (!data) return null
      
      return {
        username: data.github_username,
        email: data.github_email,
        token: data.access_token ? await this.decryptToken(data.access_token) : undefined
      }
    } catch (error) {
      console.error('[E2B-GITHUB] Failed to get auth info:', error)
      return null
    }
  }

  /**
   * Update setup status in database
   */
  private async updateSetupStatus(status: 'completed' | 'partial' | 'failed'): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase
        .from('github_sync_status')
        .insert({
          workspace_id: this.config.workspaceId,
          session_id: this.config.sessionId,
          repository_owner: 'system',
          repository_name: 'setup',
          sync_type: 'setup',
          sync_status: status === 'completed' ? 'success' : status === 'partial' ? 'partial' : 'failed',
          files_added: 0,
          files_modified: 0,
          files_deleted: 0,
          commit_shas: [],
          error_messages: status === 'failed' ? ['GitHub setup failed'] : [],
          synced_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('[E2B-GITHUB] Failed to update setup status:', error)
    }
  }

  /**
   * Decrypt GitHub token (placeholder - replace with actual decryption)
   */
  private async decryptToken(encryptedToken: string): Promise<string> {
    // In production, use proper decryption with a key management service
    return Buffer.from(encryptedToken, 'base64').toString('utf-8')
  }

  /**
   * Static method to create and run complete GitHub setup
   */
  static async setupGitHubInSandbox(
    sandbox: Sandbox,
    config: E2BGitHubConfig
  ): Promise<GitSetupResult> {
    const setupService = new E2BGitHubSetupService(sandbox, config)
    return await setupService.setupGitHubAccess()
  }

  /**
   * Check if GitHub is already set up in sandbox
   */
  static async isGitHubSetup(sandbox: Sandbox): Promise<boolean> {
    try {
      // Check if git is installed and configured
      const gitVersionResult = await sandbox.process.startAndWait('git --version')
      if (gitVersionResult.exitCode !== 0) return false

      const userResult = await sandbox.process.startAndWait('git config --global user.name')
      if (userResult.exitCode !== 0) return false

      const emailResult = await sandbox.process.startAndWait('git config --global user.email')
      if (emailResult.exitCode !== 0) return false

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get git configuration from sandbox
   */
  static async getGitConfig(sandbox: Sandbox): Promise<{
    name?: string
    email?: string
    version?: string
  }> {
    try {
      const versionResult = await sandbox.process.startAndWait('git --version')
      const nameResult = await sandbox.process.startAndWait('git config --global user.name')
      const emailResult = await sandbox.process.startAndWait('git config --global user.email')

      return {
        version: versionResult.exitCode === 0 ? versionResult.stdout.trim() : undefined,
        name: nameResult.exitCode === 0 ? nameResult.stdout.trim() : undefined,
        email: emailResult.exitCode === 0 ? emailResult.stdout.trim() : undefined
      }
    } catch (error) {
      return {}
    }
  }
}

// Factory function
export function createE2BGitHubSetup(
  sandbox: Sandbox,
  config: E2BGitHubConfig
): E2BGitHubSetupService {
  return new E2BGitHubSetupService(sandbox, config)
}