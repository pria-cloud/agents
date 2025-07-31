/**
 * GitHub Webhook API Endpoint
 * Handles incoming webhook events from GitHub for live code synchronization
 */

import { NextRequest, NextResponse } from 'next/server'
import { GitHubWebhookManager } from '@/lib/github/webhook-manager'
import { GitHubWebhookSetup } from '@/lib/github/webhook-setup'
import createServerClient from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Extract headers
    const signature = request.headers.get('x-hub-signature-256') || ''
    const event = request.headers.get('x-github-event') || ''
    const deliveryId = request.headers.get('x-github-delivery') || ''
    
    // Read payload
    const payload = await request.text()
    let parsedPayload: any
    
    try {
      parsedPayload = JSON.parse(payload)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    
    console.log(`[WEBHOOK] Received ${event} event (${deliveryId})`)
    
    // Get repository information from payload
    const repositoryName = parsedPayload.repository?.full_name
    if (!repositoryName) {
      console.error('[WEBHOOK] Missing repository information in payload')
      return NextResponse.json(
        { error: 'Missing repository information' },
        { status: 400 }
      )
    }
    
    // Get webhook secret from database
    let webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || ''
    
    try {
      const supabase = await createServerClient()
      const { data: repoData, error } = await supabase
        .from('github_repos')
        .select('webhook_secret')
        .eq('repository_name', repositoryName)
        .single()
      
      if (!error && repoData?.webhook_secret) {
        // Decrypt the webhook secret
        webhookSecret = await GitHubWebhookSetup.decryptWebhookSecret(repoData.webhook_secret)
        console.log(`[WEBHOOK] Using repository-specific webhook secret for ${repositoryName}`)
      } else {
        console.warn(`[WEBHOOK] No repository-specific secret found for ${repositoryName}, using environment default`)
      }
    } catch (error) {
      console.error('[WEBHOOK] Failed to retrieve webhook secret:', error)
      // Continue with environment default
    }
    
    // Initialize webhook manager with the appropriate secret
    const webhookManager = new GitHubWebhookManager(webhookSecret)
    
    // Verify signature
    const isValid = webhookManager.verifySignature(payload, signature)
    if (!isValid) {
      console.error(`[WEBHOOK] Invalid signature for ${repositoryName}`)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Process the webhook
    const result = await webhookManager.processWebhook(event, parsedPayload, signature)
    
    if (result.success) {
      console.log(`[WEBHOOK] Successfully processed ${event}: ${result.message}`)
      return NextResponse.json({ 
        message: result.message,
        event,
        deliveryId 
      })
    } else {
      console.error(`[WEBHOOK] Failed to process ${event}: ${result.message}`)
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('[WEBHOOK] Endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Health check for webhook endpoint
  try {
    const supabase = await createServerClient()
    
    // Check if we can connect to database
    const { data, error } = await supabase
      .from('webhook_events')
      .select('count(*)')
      .limit(1)
    
    if (error) {
      return NextResponse.json(
        { status: 'unhealthy', error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      webhookConfig: GitHubWebhookManager.getWebhookConfig()
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}