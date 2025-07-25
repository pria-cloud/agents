import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { githubSecurity } from '@/lib/security/github-security'
import { logger } from '@/lib/monitoring/logger'
import { createAPIHandler } from '@/lib/validation/api-validation'
import { z } from 'zod'

// GitHub webhook event schema
const GitHubWebhookSchema = z.object({
  action: z.string(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    html_url: z.string(),
    owner: z.object({
      login: z.string(),
      id: z.number()
    })
  }).optional(),
  sender: z.object({
    login: z.string(),
    id: z.number()
  }),
  ref: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  commits: z.array(z.any()).optional(),
  head_commit: z.object({
    id: z.string(),
    message: z.string(),
    timestamp: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string()
    })
  }).optional()
})

/**
 * GitHub Webhook Handler
 * Securely processes GitHub webhook events with signature verification
 */
export const POST = createAPIHandler(
  {
    schemas: {
      body: GitHubWebhookSchema
    },
    rateLimit: {
      requests: 100,
      windowMs: 60000 // 100 webhooks per minute
    },
    requireAuth: false // Webhooks use signature verification instead
  },
  async (request, { validatedData }) => {
    const startTime = Date.now()
    
    try {
      // Get raw body for signature verification
      const rawBody = await request.text()
      const signature = request.headers.get('x-hub-signature-256')
      
      if (!signature) {
        logger.warn('GitHub webhook received without signature', {
          headers: Object.fromEntries(request.headers.entries())
        })
        return NextResponse.json(
          { error: 'Missing webhook signature' },
          { status: 401 }
        )
      }

      // Verify webhook signature
      const isValidSignature = githubSecurity.verifyWebhookSignature(rawBody, signature)
      if (!isValidSignature) {
        logger.error('GitHub webhook signature verification failed', {
          signature,
          bodyLength: rawBody.length
        })
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }

      // Parse the webhook payload
      const event = JSON.parse(rawBody)
      const eventType = request.headers.get('x-github-event')
      const deliveryId = request.headers.get('x-github-delivery')

      logger.info('GitHub webhook received', {
        eventType,
        deliveryId,
        action: event.action,
        repository: event.repository?.full_name,
        sender: event.sender?.login
      })

      // Process the webhook event
      const result = await processWebhookEvent(eventType!, event, deliveryId!)
      
      const duration = Date.now() - startTime
      logger.info('GitHub webhook processed', {
        eventType,
        deliveryId,
        duration,
        success: result.success
      })

      return NextResponse.json({
        success: result.success,
        message: result.message,
        processed: true,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('GitHub webhook processing failed', error, {
        duration,
        url: request.url
      })

      return NextResponse.json(
        {
          error: 'Webhook processing failed',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
  }
)

/**
 * Process different types of GitHub webhook events
 */
async function processWebhookEvent(
  eventType: string,
  payload: any,
  deliveryId: string
): Promise<{ success: boolean; message: string }> {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    switch (eventType) {
      case 'push':
        return await handlePushEvent(supabase, payload, deliveryId)
      
      case 'pull_request':
        return await handlePullRequestEvent(supabase, payload, deliveryId)
      
      case 'repository':
        return await handleRepositoryEvent(supabase, payload, deliveryId)
      
      case 'installation':
      case 'installation_repositories':
        return await handleInstallationEvent(supabase, payload, deliveryId)
      
      case 'ping':
        return handlePingEvent(payload)
      
      default:
        logger.warn('Unhandled webhook event type', {
          eventType,
          deliveryId,
          action: payload.action
        })
        return {
          success: true,
          message: `Event type '${eventType}' acknowledged but not processed`
        }
    }
  } catch (error) {
    logger.error('Webhook event processing error', error, {
      eventType,
      deliveryId
    })
    throw error
  }
}

/**
 * Handle repository push events
 */
async function handlePushEvent(
  supabase: any,
  payload: any,
  deliveryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { repository, ref, commits, head_commit } = payload
    
    if (!repository || !head_commit) {
      return { success: true, message: 'No commits to process' }
    }

    // Find sessions associated with this repository
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, workspace_id, github_repo_url, github_branch')
      .eq('github_repo_url', repository.html_url)
      .eq('status', 'active')

    if (error) {
      logger.error('Failed to fetch sessions for push event', error)
      return { success: false, message: 'Database error' }
    }

    if (!sessions || sessions.length === 0) {
      return { success: true, message: 'No active sessions for this repository' }
    }

    // Process commits for each session
    for (const session of sessions) {
      // Check if push is to the monitored branch
      const branchName = ref.replace('refs/heads/', '')
      if (session.github_branch && session.github_branch !== branchName) {
        continue
      }

      // Log the push event in session history
      await supabase
        .from('session_history')
        .insert({
          session_id: session.id,
          workspace_id: session.workspace_id,
          event_type: 'github_push',
          event_title: `Push to ${branchName}`,
          event_description: head_commit.message,
          event_data: {
            repository: repository.full_name,
            branch: branchName,
            commit_sha: head_commit.id,
            commit_message: head_commit.message,
            commits_count: commits?.length || 1,
            author: head_commit.author,
            delivery_id: deliveryId
          },
          performed_by: head_commit.author.name
        })

      logger.info('Push event logged for session', {
        sessionId: session.id,
        repository: repository.full_name,
        branch: branchName,
        commitSha: head_commit.id
      })
    }

    return {
      success: true,
      message: `Processed push event for ${sessions.length} session(s)`
    }
  } catch (error) {
    logger.error('Push event handling failed', error)
    return { success: false, message: 'Push event processing failed' }
  }
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(
  supabase: any,
  payload: any,
  deliveryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { action, pull_request, repository } = payload
    
    if (!pull_request || !repository) {
      return { success: true, message: 'Invalid pull request payload' }
    }

    // Find sessions associated with this repository
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, workspace_id, github_repo_url')
      .eq('github_repo_url', repository.html_url)
      .eq('status', 'active')

    if (error) {
      logger.error('Failed to fetch sessions for PR event', error)
      return { success: false, message: 'Database error' }
    }

    if (!sessions || sessions.length === 0) {
      return { success: true, message: 'No active sessions for this repository' }
    }

    // Process PR event for each session
    for (const session of sessions) {
      await supabase
        .from('session_history')
        .insert({
          session_id: session.id,
          workspace_id: session.workspace_id,
          event_type: 'github_pr',
          event_title: `Pull Request ${action}`,
          event_description: `PR #${pull_request.number}: ${pull_request.title}`,
          event_data: {
            repository: repository.full_name,
            action,
            pr_number: pull_request.number,
            pr_title: pull_request.title,
            pr_url: pull_request.html_url,
            base_branch: pull_request.base.ref,
            head_branch: pull_request.head.ref,
            author: pull_request.user.login,
            delivery_id: deliveryId
          },
          performed_by: pull_request.user.login
        })
    }

    return {
      success: true,
      message: `Processed PR ${action} event for ${sessions.length} session(s)`
    }
  } catch (error) {
    logger.error('Pull request event handling failed', error)
    return { success: false, message: 'Pull request event processing failed' }
  }
}

/**
 * Handle repository events (created, deleted, etc.)
 */
async function handleRepositoryEvent(
  supabase: any,
  payload: any,
  deliveryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { action, repository } = payload
    
    logger.info('Repository event received', {
      action,
      repository: repository?.full_name,
      deliveryId
    })

    // For repository deletion, clean up any sessions
    if (action === 'deleted' && repository) {
      const { error } = await supabase
        .from('sessions')
        .update({
          github_token: null,
          github_repo_url: null,
          github_branch: null
        })
        .eq('github_repo_url', repository.html_url)

      if (error) {
        logger.error('Failed to clean up sessions for deleted repository', error)
      }
    }

    return {
      success: true,
      message: `Repository ${action} event processed`
    }
  } catch (error) {
    logger.error('Repository event handling failed', error)
    return { success: false, message: 'Repository event processing failed' }
  }
}

/**
 * Handle GitHub App installation events
 */
async function handleInstallationEvent(
  supabase: any,
  payload: any,
  deliveryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { action, installation } = payload
    
    logger.info('Installation event received', {
      action,
      installationId: installation?.id,
      account: installation?.account?.login,
      deliveryId
    })

    // Log installation events but don't process them yet
    // Future enhancement: Handle GitHub App installations
    
    return {
      success: true,
      message: `Installation ${action} event acknowledged`
    }
  } catch (error) {
    logger.error('Installation event handling failed', error)
    return { success: false, message: 'Installation event processing failed' }
  }
}

/**
 * Handle ping events (webhook test)
 */
function handlePingEvent(payload: any): { success: boolean; message: string } {
  const { zen, hook_id } = payload
  
  logger.info('GitHub webhook ping received', {
    zen,
    hookId: hook_id
  })

  return {
    success: true,
    message: 'Pong! Webhook is working correctly'
  }
}