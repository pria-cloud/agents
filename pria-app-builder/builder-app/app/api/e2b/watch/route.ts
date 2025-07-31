import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import E2BSandboxManager from '@/lib/e2b/sandbox-manager'

// Global sandbox manager instance
let sandboxManager: E2BSandboxManager | null = null

function getSandboxManager(): E2BSandboxManager {
  if (!sandboxManager) {
    sandboxManager = new E2BSandboxManager({
      template: 'nodejs',
      apiKey: process.env.E2B_API_KEY!,
      timeoutMs: 1800000, // 30 minutes
    })
  }
  return sandboxManager
}

// Store active watchers
const activeWatchers = new Map<string, () => void>()

export async function POST(request: NextRequest) {
  try {
    const { sessionId, action, directory } = await request.json()
    
    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Missing sessionId or action' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Verify session access using service role
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: session, error: sessionError } = await serviceSupabase
      .from('sessions')
      .select('id, workspace_id, target_directory')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    const manager = getSandboxManager()

    switch (action) {
      case 'start_watch':
        try {
          // Stop existing watcher if any
          const existingWatcher = activeWatchers.get(sessionId)
          if (existingWatcher) {
            existingWatcher()
            activeWatchers.delete(sessionId)
          }

          // Start new file watcher
          const stopWatcher = await manager.watchFiles(
            sessionId,
            async (event) => {
              // Store file change event in database for real-time updates
              try {
                await serviceSupabase
                  .from('file_events')
                  .insert({
                    workspace_id: session.workspace_id,
                    session_id: sessionId,
                    event_type: event.type,
                    file_path: event.path,
                    file_content: event.content,
                    created_at: new Date().toISOString()
                  })
              } catch (error) {
                console.error('Failed to store file event:', error)
              }
            },
            directory || session.target_directory
          )

          activeWatchers.set(sessionId, stopWatcher)

          return NextResponse.json({
            success: true,
            message: 'File watcher started',
            watching: directory || session.target_directory
          })

        } catch (error) {
          console.error('Failed to start file watcher:', error)
          return NextResponse.json(
            { error: 'Failed to start file watcher' },
            { status: 500 }
          )
        }

      case 'stop_watch':
        try {
          const watcher = activeWatchers.get(sessionId)
          if (watcher) {
            watcher()
            activeWatchers.delete(sessionId)
          }

          return NextResponse.json({
            success: true,
            message: 'File watcher stopped'
          })

        } catch (error) {
          console.error('Failed to stop file watcher:', error)
          return NextResponse.json(
            { error: 'Failed to stop file watcher' },
            { status: 500 }
          )
        }

      case 'get_events':
        try {
          const since = request.url.includes('since=') ? 
            new URL(request.url).searchParams.get('since') : 
            new Date(Date.now() - 5 * 60 * 1000).toISOString() // Last 5 minutes

          const { data: events, error } = await serviceSupabase
            .from('file_events')
            .select('*')
            .eq('session_id', sessionId)
            .eq('workspace_id', workspaceId)
            .gte('created_at', since)
            .order('created_at', { ascending: true })

          if (error) {
            throw error
          }

          return NextResponse.json({
            success: true,
            events: events || []
          })

        } catch (error) {
          console.error('Failed to get file events:', error)
          return NextResponse.json(
            { error: 'Failed to get file events' },
            { status: 500 }
          )
        }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Watch API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const since = searchParams.get('since') || new Date(Date.now() - 5 * 60 * 1000).toISOString()
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    )
  }

  try {
    // Authenticate user
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace access denied' },
        { status: 403 }
      )
    }

    // Get file events using service role
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: events, error } = await serviceSupabase
      .from('file_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch file events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch file events' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      events: events || [],
      isWatching: activeWatchers.has(sessionId)
    })

  } catch (error) {
    console.error('Get events error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    )
  }

  try {
    // Stop file watcher
    const watcher = activeWatchers.get(sessionId)
    if (watcher) {
      watcher()
      activeWatchers.delete(sessionId)
    }

    return NextResponse.json({
      success: true,
      message: 'File watcher stopped'
    })

  } catch (error) {
    console.error('Stop watcher error:', error)
    return NextResponse.json(
      { error: 'Failed to stop watcher' },
      { status: 500 }
    )
  }
}