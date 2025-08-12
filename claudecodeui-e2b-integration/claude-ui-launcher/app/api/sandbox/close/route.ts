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

    console.log(`Closing sandbox for session: ${sessionId}`)

    // Get the sandbox reference
    const sandbox = activeSandboxes.get(sessionId)
    
    if (!sandbox) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sandbox not found' 
      }, { status: 404 })
    }

    // Close the sandbox
    await sandbox.kill()
    
    // Remove from our tracking
    activeSandboxes.delete(sessionId)

    console.log(`Sandbox closed for session: ${sessionId}`)

    return NextResponse.json({
      success: true,
      message: 'Sandbox closed successfully'
    })

  } catch (error) {
    console.error('Error closing sandbox:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}