/**
 * GitHub Webhook Setup Utility
 * Handles webhook creation, configuration, and management for repositories
 */

import { Octokit } from 'octokit'
import createServerClient from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { PRIAEncryption } from '@/lib/security/encryption'

export interface WebhookSetupConfig {
  repositoryOwner: string
  repositoryName: string
  accessToken: string
  webhookUrl?: string
  events?: string[]
  secret?: string
}

export interface WebhookSetupResult {
  success: boolean
  webhookId?: number
  webhookUrl?: string
  secret?: string
  error?: string
}

export class GitHubWebhookSetup {
  private octokit: Octokit
  private baseUrl: string
  
  constructor(accessToken: string, baseUrl?: string) {
    this.octokit = new Octokit({ auth: accessToken })
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3008'
  }
  
  /**
   * Set up webhook for a repository
   */
  async setupWebhook(config: WebhookSetupConfig): Promise<WebhookSetupResult> {
    try {
      const webhookUrl = config.webhookUrl || `${this.baseUrl}/api/github/webhook`
      const secret = config.secret || this.generateWebhookSecret()
      const events = config.events || [
        'push',
        'pull_request',
        'create',
        'delete',
        'repository'
      ]
      
      console.log(`[WEBHOOK_SETUP] Setting up webhook for ${config.repositoryOwner}/${config.repositoryName}`)
      
      // Check if webhook already exists
      const existingWebhook = await this.findExistingWebhook(
        config.repositoryOwner,
        config.repositoryName,
        webhookUrl
      )
      
      if (existingWebhook) {
        console.log(`[WEBHOOK_SETUP] Webhook already exists with ID: ${existingWebhook.id}`)
        
        // Update existing webhook
        const updatedWebhook = await this.updateWebhook(
          config.repositoryOwner,
          config.repositoryName,
          existingWebhook.id,
          { events, secret }
        )
        
        if (updatedWebhook) {
          await this.storeWebhookConfig(config, updatedWebhook.id, webhookUrl, secret)
          return {
            success: true,
            webhookId: updatedWebhook.id,
            webhookUrl,
            secret
          }
        }
      }
      
      // Create new webhook
      const response = await this.octokit.rest.repos.createWebhook({
        owner: config.repositoryOwner,
        repo: config.repositoryName,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret,
          insecure_ssl: process.env.NODE_ENV === 'development' ? '1' : '0'
        },
        events: events,
        active: true
      })
      
      const webhookId = response.data.id
      console.log(`[WEBHOOK_SETUP] Created webhook with ID: ${webhookId}`)
      
      // Store webhook configuration in database
      await this.storeWebhookConfig(config, webhookId, webhookUrl, secret)
      
      return {
        success: true,
        webhookId,
        webhookUrl,
        secret
      }
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to setup webhook:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Remove webhook from repository
   */
  async removeWebhook(
    repositoryOwner: string,
    repositoryName: string,
    webhookId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.octokit.rest.repos.deleteWebhook({
        owner: repositoryOwner,
        repo: repositoryName,
        hook_id: webhookId
      })
      
      // Remove from database
      await this.removeWebhookConfig(repositoryOwner, repositoryName, webhookId)
      
      console.log(`[WEBHOOK_SETUP] Removed webhook ${webhookId} from ${repositoryOwner}/${repositoryName}`)
      
      return { success: true }
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to remove webhook:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Test webhook by sending a ping
   */
  async testWebhook(
    repositoryOwner: string,
    repositoryName: string,
    webhookId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.octokit.rest.repos.pingWebhook({
        owner: repositoryOwner,
        repo: repositoryName,
        hook_id: webhookId
      })
      
      console.log(`[WEBHOOK_SETUP] Pinged webhook ${webhookId}`)
      return { success: true }
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to ping webhook:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * List webhooks for a repository
   */
  async listWebhooks(
    repositoryOwner: string,
    repositoryName: string
  ): Promise<Array<{
    id: number
    url: string
    events: string[]
    active: boolean
    created_at: string
    updated_at: string
  }>> {
    try {
      const response = await this.octokit.rest.repos.listWebhooks({
        owner: repositoryOwner,
        repo: repositoryName
      })
      
      return response.data.map(webhook => ({
        id: webhook.id,
        url: webhook.config.url || '',
        events: webhook.events,
        active: webhook.active,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at
      }))
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to list webhooks:', error)
      return []
    }
  }
  
  /**
   * Find existing webhook by URL
   */
  private async findExistingWebhook(
    owner: string,
    repo: string,
    url: string
  ): Promise<{ id: number } | null> {
    try {
      const webhooks = await this.listWebhooks(owner, repo)
      return webhooks.find(webhook => webhook.url === url) || null
    } catch {
      return null
    }
  }
  
  /**
   * Update existing webhook
   */
  private async updateWebhook(
    owner: string,
    repo: string,
    webhookId: number,
    updates: { events?: string[]; secret?: string }
  ): Promise<{ id: number } | null> {
    try {
      const response = await this.octokit.rest.repos.updateWebhook({
        owner,
        repo,
        hook_id: webhookId,
        config: {
          secret: updates.secret
        },
        events: updates.events,
        active: true
      })
      
      return { id: response.data.id }
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to update webhook:', error)
      return null
    }
  }
  
  /**
   * Generate secure webhook secret
   */
  private generateWebhookSecret(): string {
    return randomBytes(32).toString('hex')
  }
  
  /**
   * Store webhook configuration in database
   */
  private async storeWebhookConfig(
    config: WebhookSetupConfig,
    webhookId: number,
    webhookUrl: string,
    secret: string
  ): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      // Get workspace from user context (this would need to be passed in)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.app_metadata?.workspace_id) {
        throw new Error('No workspace context available')
      }
      
      const repositoryName = `${config.repositoryOwner}/${config.repositoryName}`
      
      // Encrypt the access token and secret using proper encryption
      const encryptedToken = PRIAEncryption.encryptGitHubToken(config.accessToken)
      const encryptedSecret = PRIAEncryption.encryptWebhookSecret(secret)
      
      const { error } = await supabase
        .from('github_repos')
        .upsert({
          workspace_id: user.app_metadata.workspace_id,
          repository_name: repositoryName,
          webhook_id: webhookId,
          webhook_url: webhookUrl,
          webhook_secret: encryptedSecret,
          access_token_encrypted: encryptedToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id,repository_name'
        })
      
      if (error) {
        console.error('[WEBHOOK_SETUP] Failed to store webhook config:', error)
        throw error
      }
      
      console.log(`[WEBHOOK_SETUP] Stored webhook config for ${repositoryName}`)
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Database storage error:', error)
      throw error
    }
  }
  
  /**
   * Remove webhook configuration from database
   */
  private async removeWebhookConfig(
    owner: string,
    repo: string,
    webhookId: number
  ): Promise<void> {
    try {
      const supabase = await createServerClient()
      const repositoryName = `${owner}/${repo}`
      
      const { error } = await supabase
        .from('github_repos')
        .delete()
        .eq('repository_name', repositoryName)
        .eq('webhook_id', webhookId)
      
      if (error) {
        console.error('[WEBHOOK_SETUP] Failed to remove webhook config:', error)
        throw error
      }
      
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Database removal error:', error)
      throw error
    }
  }
  
  /**
   * Decrypt GitHub token for API usage
   */
  static async decryptGitHubToken(encryptedToken: string): Promise<string> {
    try {
      return PRIAEncryption.decryptGitHubToken(encryptedToken)
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to decrypt GitHub token:', error)
      throw new Error('Failed to decrypt GitHub token')
    }
  }

  /**
   * Decrypt webhook secret for verification
   */
  static async decryptWebhookSecret(encryptedSecret: string): Promise<string> {
    try {
      return PRIAEncryption.decryptWebhookSecret(encryptedSecret)
    } catch (error) {
      console.error('[WEBHOOK_SETUP] Failed to decrypt webhook secret:', error)
      throw new Error('Failed to decrypt webhook secret')
    }
  }
  
  /**
   * Validate webhook setup
   */
  static async validateSetup(
    repositoryOwner: string,
    repositoryName: string,
    accessToken: string
  ): Promise<{
    canAccess: boolean
    hasWebhookPermission: boolean
    existingWebhooks: number
    error?: string
  }> {
    try {
      const octokit = new Octokit({ auth: accessToken })
      
      // Check repository access
      const repoResponse = await octokit.rest.repos.get({
        owner: repositoryOwner,
        repo: repositoryName
      })
      
      const canAccess = !!repoResponse.data
      const hasWebhookPermission = repoResponse.data.permissions?.admin || false
      
      // Count existing webhooks
      const webhooksResponse = await octokit.rest.repos.listWebhooks({
        owner: repositoryOwner,
        repo: repositoryName
      })
      
      return {
        canAccess,
        hasWebhookPermission,
        existingWebhooks: webhooksResponse.data.length
      }
      
    } catch (error) {
      return {
        canAccess: false,
        hasWebhookPermission: false,
        existingWebhooks: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}