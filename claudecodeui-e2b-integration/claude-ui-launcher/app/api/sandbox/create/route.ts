import { NextRequest, NextResponse } from 'next/server'
import { Sandbox } from 'e2b'

// Store active sandboxes in memory (in production, use a database)
const activeSandboxes = new Map<string, Sandbox>()

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Session ID is required' 
      }, { status: 400 })
    }

    // Get E2B configuration from environment
    const e2bApiKey = process.env.E2B_API_KEY
    const templateId = process.env.E2B_TEMPLATE_ID
    
    if (!e2bApiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'E2B API key not configured' 
      }, { status: 500 })
    }

    if (!templateId) {
      return NextResponse.json({ 
        success: false, 
        error: 'E2B template ID not configured' 
      }, { status: 500 })
    }

    console.log(`Creating E2B sandbox for session: ${sessionId} using template: ${templateId}`)
    
    // Log API key status for debugging
    const launcherApiKey = process.env.ANTHROPIC_API_KEY
    console.log(`Launcher ANTHROPIC_API_KEY: ${launcherApiKey ? `PRESENT (${launcherApiKey.length} chars)` : 'MISSING'}`)
    
    const startTime = Date.now()

    // Create E2B sandbox with extended timeout and better error handling
    const sandbox = await Promise.race([
      Sandbox.create(templateId, {
        apiKey: e2bApiKey,
        timeoutMs: 1200000, // 20 minutes (20 * 60 * 1000)
        envs: {
          // Only pass API keys if they exist in launcher environment
          // Template has API key baked in, don't override with empty values
          ...(process.env.ANTHROPIC_API_KEY && { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
          ...(process.env.GITHUB_TOKEN && { GITHUB_TOKEN: process.env.GITHUB_TOKEN }),
          GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || 'https://github.com/pria-cloud/workspaces',
          ...(process.env.SUPABASE_URL && { SUPABASE_URL: process.env.SUPABASE_URL }),
          ...(process.env.SUPABASE_ANON_KEY && { SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY }),
          SESSION_ID: sessionId,
          PROJECT_NAME: 'baseline-project'
        },
        metadata: {
          sessionId,
          createdAt: new Date().toISOString(),
          templateVersion: '2.0.0'
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sandbox creation timed out after 60 seconds')), 60000)
      )
    ]) as Sandbox

    const creationTime = Date.now() - startTime
    console.log(`Sandbox created in ${creationTime}ms with ID: ${sandbox.sandboxId}`)

    // Store the sandbox reference
    activeSandboxes.set(sessionId, sandbox)

    // The template has a ready_cmd that waits for the service to be available
    // The sandbox should be ready to use immediately
    console.log('Sandbox ready! Claude Code UI should be available.')

    // Get the sandbox URL for the frontend port (3009)
    const sandboxUrl = `https://${sandbox.getHost(3009)}`
    
    console.log(`Claude Code UI available at: ${sandboxUrl}`)
    
    // Return sandbox URL immediately for fast user experience
    const response = NextResponse.json({
      success: true,
      url: sandboxUrl,
      sandboxId: sandbox.sandboxId,
      sessionId
    })

    // Initialize the sandbox instance with project and GitHub sync in background
    // Don't await this - let it happen asynchronously
    console.log('Starting background initialization for sandbox instance...')
    setImmediate(async () => {
      try {
        // Wait a moment for sandbox services to be ready
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const initResponse = await fetch(`https://${sandbox.getHost(3008)}/api/instance/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            projectName: 'baseline-project'
            // Environment variables are already set during sandbox creation
          })
        })
        
        const initResult = await initResponse.json()
        console.log('Background initialization result:', initResult)
        
        if (!initResult.success) {
          console.error('Background initialization failed:', initResult.error)
        } else {
          console.log('✅ Sandbox instance initialization completed successfully')
        }
      } catch (error) {
        console.error('Background initialization error:', error)
        // Sandbox is still usable even if initialization fails
      }
    })

    return response

  } catch (error) {
    console.error('Error creating sandbox:', error)
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Unknown error occurred'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Check if this looks like an E2B service issue
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'E2B service timeout - their service may be experiencing slowness. Please try again in a few minutes.'
        statusCode = 503 // Service Unavailable
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network connection issue with E2B service. Please check your internet connection and try again.'
        statusCode = 503
      } else if (error.message.includes('template') || error.message.includes('not found')) {
        errorMessage = 'E2B template configuration issue. Please contact support.'
        statusCode = 502 // Bad Gateway
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : String(error) : undefined
    }, { status: statusCode })
  }
}