/**
 * GitHub Webhook Manager - Handles webhook events for live code synchronization
 * Manages real-time updates between GitHub repositories and E2B sandboxes
 */

import { createHmac } from 'crypto'
import createServerClient from '@/lib/supabase/server'
import { E2BManager } from '../e2b/e2b-manager'

export interface WebhookEvent {
  id: string
  name: string
  payload: any
  signature: string
  timestamp: Date
}

export interface PushEvent {
  ref: string
  repository: {
    id: number
    name: string
    full_name: string
    clone_url: string
  }
  commits: Array<{
    id: string
    message: string
    author: {
      name: string
      email: string
    }
    added: string[]
    removed: string[]
    modified: string[]
  }>
  pusher: {
    name: string
    email: string
  }
}

export interface PullRequestEvent {
  action: 'opened' | 'synchronize' | 'closed' | 'reopened'
  pull_request: {
    id: number
    number: number
    title: string
    body: string
    state: 'open' | 'closed'
    head: {
      ref: string
      sha: string
    }
    base: {
      ref: string
      sha: string
    }
  }
  repository: {
    id: number
    name: string
    full_name: string
  }
}

export class GitHubWebhookManager {
  private secret: string
  
  constructor(secret: string = process.env.GITHUB_WEBHOOK_SECRET || '') {
    this.secret = secret
  }
  
  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.secret) {
      console.warn('[WEBHOOK] No webhook secret configured')
      return true // Allow in development
    }
    
    const hmac = createHmac('sha256', this.secret)
    hmac.update(payload)
    const calculatedSignature = `sha256=${hmac.digest('hex')}`
    
    return calculatedSignature === signature
  }
  
  /**
   * Process incoming webhook event
   */
  async processWebhook(
    event: string,
    payload: any,
    signature: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Log webhook event
      console.log(`[WEBHOOK] Processing ${event} event`)
      
      // Store webhook event in database
      await this.storeWebhookEvent(event, payload)
      
      // Route to appropriate handler
      switch (event) {
        case 'push':
          return await this.handlePushEvent(payload as PushEvent)
        case 'pull_request':
          return await this.handlePullRequestEvent(payload as PullRequestEvent)
        case 'create':
          return await this.handleCreateEvent(payload)
        case 'delete':
          return await this.handleDeleteEvent(payload)
        default:
          console.log(`[WEBHOOK] Unhandled event type: ${event}`)
          return { success: true, message: `Event ${event} acknowledged` }
      }
    } catch (error) {
      console.error('[WEBHOOK] Processing error:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  /**
   * Handle push events - sync code to E2B sandboxes
   */
  private async handlePushEvent(payload: PushEvent): Promise<{ success: boolean; message: string }> {
    console.log(`[WEBHOOK] Push to ${payload.repository.full_name} on ${payload.ref}`)
    
    const supabase = await createServerClient()
    
    // Find sessions linked to this repository
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*, github_repos!inner(repository_name)')
      .eq('github_repos.repository_name', payload.repository.full_name)
      .eq('status', 'active')
    
    if (error) {
      console.error('[WEBHOOK] Failed to find sessions:', error)
      return { success: false, message: 'Failed to find linked sessions' }
    }
    
    if (!sessions || sessions.length === 0) {
      return { success: true, message: 'No active sessions linked to repository' }
    }
    
    // Sync code to each active E2B sandbox
    const syncPromises = sessions.map(async (session) => {
      try {
        const e2bManager = new E2BManager()
        const sandbox = await e2bManager.getSandbox(session.id)
        
        if (!sandbox) {
          console.warn(`[WEBHOOK] No sandbox found for session ${session.id}`)
          return
        }
        
        // Pull latest changes in the sandbox
        const pullResult = await sandbox.process.startAndWait(
          `cd /workspace && git pull origin ${payload.ref.replace('refs/heads/', '')}`
        )
        
        if (pullResult.exitCode !== 0) {
          console.error(`[WEBHOOK] Git pull failed for session ${session.id}:`, pullResult.stderr)
          return
        }
        
        console.log(`[WEBHOOK] Successfully synced changes to session ${session.id}`)
        
        // Notify connected clients via real-time updates
        await this.notifyCodeSync(session.id, payload)
        
      } catch (error) {
        console.error(`[WEBHOOK] Sync error for session ${session.id}:`, error)
      }
    })
    
    await Promise.all(syncPromises)
    
    return { 
      success: true, 
      message: `Synced changes to ${sessions.length} active sessions` 
    }
  }
  
  /**
   * Handle pull request events
   */
  private async handlePullRequestEvent(payload: PullRequestEvent): Promise<{ success: boolean; message: string }> {
    console.log(`[WEBHOOK] Pull request ${payload.action}: #${payload.pull_request.number}`)
    
    const supabase = await createServerClient()
    
    // Store PR event for tracking
    const { error } = await supabase
      .from('github_events')
      .insert({
        event_type: 'pull_request',
        action: payload.action,
        repository_name: payload.repository.full_name,
        pr_number: payload.pull_request.number,
        pr_title: payload.pull_request.title,
        pr_state: payload.pull_request.state,
        payload: payload
      })
    
    if (error) {
      console.error('[WEBHOOK] Failed to store PR event:', error)
    }
    
    // If PR is merged, trigger sync
    if (payload.action === 'closed' && payload.pull_request.state === 'closed') {
      // Check if PR was merged (GitHub doesn't directly indicate this in the event)
      // You would need to check the PR merge status via API
      console.log(`[WEBHOOK] PR #${payload.pull_request.number} closed`)
    }
    
    return { success: true, message: 'Pull request event processed' }
  }
  
  /**
   * Handle repository create events (branches, tags)
   */
  private async handleCreateEvent(payload: any): Promise<{ success: boolean; message: string }> {
    console.log(`[WEBHOOK] Create event: ${payload.ref_type} ${payload.ref}`)
    
    if (payload.ref_type === 'branch') {
      // New branch created - could trigger sandbox creation
      console.log(`[WEBHOOK] New branch created: ${payload.ref}`)
    }
    
    return { success: true, message: 'Create event processed' }
  }
  
  /**
   * Handle repository delete events (branches, tags)
   */
  private async handleDeleteEvent(payload: any): Promise<{ success: boolean; message: string }> {
    console.log(`[WEBHOOK] Delete event: ${payload.ref_type} ${payload.ref}`)
    
    if (payload.ref_type === 'branch') {
      // Branch deleted - could trigger sandbox cleanup
      console.log(`[WEBHOOK] Branch deleted: ${payload.ref}`)
    }
    
    return { success: true, message: 'Delete event processed' }
  }
  
  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(event: string, payload: any): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      const { error } = await supabase
        .from('webhook_events')
        .insert({
          event_type: event,
          payload: payload,
          repository_name: payload.repository?.full_name || 'unknown',
          processed_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('[WEBHOOK] Failed to store event:', error)
      }
    } catch (error) {
      console.error('[WEBHOOK] Storage error:', error)
    }
  }
  
  /**
   * Notify connected clients about code sync
   */
  private async notifyCodeSync(sessionId: string, pushEvent: PushEvent): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      // Create a notification for the session
      const notification = {
        session_id: sessionId,
        type: 'code_sync',
        title: 'Code Updated from GitHub',
        message: `Received ${pushEvent.commits.length} new commits`,
        data: {
          repository: pushEvent.repository.full_name,
          branch: pushEvent.ref.replace('refs/heads/', ''),
          commits: pushEvent.commits.map(c => ({
            id: c.id.substring(0, 7),
            message: c.message,
            author: c.author.name
          }))
        },
        created_at: new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('notifications')
        .insert(notification)
      
      if (error) {
        console.error('[WEBHOOK] Failed to create notification:', error)
      }
      
      // Real-time notification would be handled by Supabase Realtime
      console.log(`[WEBHOOK] Notification sent for session ${sessionId}`)
      
    } catch (error) {
      console.error('[WEBHOOK] Notification error:', error)
    }
  }
  
  /**
   * Set up webhook endpoint configuration
   */
  static getWebhookConfig(): {
    events: string[]
    contentType: 'json'
    active: boolean
  } {
    return {
      events: [
        'push',
        'pull_request',
        'create',
        'delete',
        'repository'
      ],
      contentType: 'json',
      active: true
    }
  }
}