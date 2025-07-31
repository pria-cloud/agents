/**
 * Session Recovery API
 * Handles session recovery, snapshots, and context restoration
 */

import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { SessionRecoveryManager, SessionRecoveryContext } from '@/lib/session/session-recovery-manager'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { action, sessionId, recoveryAttempt = 1 } = body

    if (!sessionId) {
      return NextResponse.json({ 
        error: 'Session ID is required' 
      }, { status: 400 })
    }

    // Verify session exists and user has access
    const { data: session } = await supabase
      .from('sessions')
      .select('id, created_at, last_activity_at')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const recoveryContext: SessionRecoveryContext = {
      sessionId,
      workspaceId,
      userId: user.id,
      lastActivity: new Date(session.last_activity_at || session.created_at),
      recoveryAttempt
    }

    const recoveryManager = new SessionRecoveryManager(recoveryContext)

    switch (action) {
      case 'recover':
        // Attempt session recovery
        try {
          const recoveryResult = await recoveryManager.recoverSession()

          return NextResponse.json({
            success: recoveryResult.success,
            sessionRestored: recoveryResult.sessionRestored,
            sandboxReconnected: recoveryResult.sandboxReconnected,
            workflowRestored: recoveryResult.workflowRestored,
            contextRestored: recoveryResult.contextRestored,
            restoredData: recoveryResult.restoredData,
            errors: recoveryResult.errors,
            warnings: recoveryResult.warnings,
            message: recoveryResult.success 
              ? 'Session recovered successfully'
              : 'Session recovery failed'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'create_snapshot':
        // Create session snapshot
        try {
          const snapshot = await recoveryManager.createSessionSnapshot()

          if (!snapshot) {
            return NextResponse.json({ 
              error: 'Failed to create session snapshot' 
            }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            snapshot: {
              sessionId: snapshot.sessionId,
              createdAt: snapshot.createdAt,
              dataCount: {
                messages: snapshot.messages.length,
                requirements: snapshot.requirements.length,
                workflows: snapshot.workflows.length,
                artifacts: snapshot.artifacts.length
              },
              metadata: snapshot.metadata
            },
            message: 'Session snapshot created successfully'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Snapshot creation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'restore_from_snapshot':
        // Restore session from snapshot
        const { snapshotId } = body

        try {
          const restoreResult = await recoveryManager.restoreFromSnapshot(snapshotId)

          return NextResponse.json({
            success: restoreResult.success,
            sessionRestored: restoreResult.sessionRestored,
            workflowRestored: restoreResult.workflowRestored,
            contextRestored: restoreResult.contextRestored,
            restoredData: restoreResult.restoredData,
            errors: restoreResult.errors,
            warnings: restoreResult.warnings,
            message: restoreResult.success 
              ? 'Session restored from snapshot successfully'
              : 'Snapshot restoration failed'
          })
        } catch (error) {
          return NextResponse.json({ 
            error: `Snapshot restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in session recovery API:', error)
    return NextResponse.json(
      { error: 'Failed to process session recovery request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const action = searchParams.get('action') || 'status'

    switch (action) {
      case 'status':
        // Get recovery status for session
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const { data: session } = await supabase
          .from('sessions')
          .select('id, created_at, last_activity_at, recovery_count, last_recovery_at, e2b_sandbox_id, metadata')
          .eq('id', sessionId)
          .eq('workspace_id', workspaceId)
          .single()

        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        // Get latest recovery attempt
        const { data: latestRecovery } = await supabase
          .from('session_recovery_logs')
          .select('*')
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // Check if session is recoverable
        const sessionAge = Date.now() - new Date(session.created_at).getTime()
        const isRecoverable = sessionAge < (30 * 24 * 60 * 60 * 1000) // 30 days
        
        const lastActivity = new Date(session.last_activity_at || session.created_at)
        const inactiveTime = Date.now() - lastActivity.getTime()
        const needsRecovery = inactiveTime > (2 * 60 * 60 * 1000) && session.e2b_sandbox_id // 2 hours

        return NextResponse.json({
          success: true,
          status: {
            sessionId: session.id,
            isRecoverable,
            needsRecovery,
            lastActivity: lastActivity.toISOString(),
            inactiveTimeMs: inactiveTime,
            recoveryCount: session.recovery_count || 0,
            lastRecovery: session.last_recovery_at,
            sandboxId: session.e2b_sandbox_id,
            metadata: session.metadata,
            latestRecoveryAttempt: latestRecovery ? {
              attempt: latestRecovery.recovery_attempt,
              success: latestRecovery.success,
              timestamp: latestRecovery.created_at,
              errors: latestRecovery.errors,
              restoredData: latestRecovery.restored_data
            } : null
          }
        })

      case 'history':
        // Get recovery history for session
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const recoveryContext: SessionRecoveryContext = {
          sessionId,
          workspaceId,
          userId: user.id,
          lastActivity: new Date(),
          recoveryAttempt: 1
        }

        const recoveryManager = new SessionRecoveryManager(recoveryContext)
        const history = await recoveryManager.getRecoveryHistory()

        return NextResponse.json({
          success: true,
          history,
          totalAttempts: history.length,
          successfulAttempts: history.filter(h => h.success).length
        })

      case 'snapshots':
        // Get available snapshots for session
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
        }

        const { data: snapshots } = await supabase
          .from('session_snapshots')
          .select('id, created_at, snapshot_size_bytes')
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(10)

        return NextResponse.json({
          success: true,
          snapshots: (snapshots || []).map(s => ({
            id: s.id,
            createdAt: s.created_at,
            sizeBytes: s.snapshot_size_bytes
          })),
          totalSnapshots: snapshots?.length || 0
        })

      case 'stats':
        // Get recovery statistics for workspace
        const { data: stats } = await supabase
          .rpc('get_session_recovery_stats', {
            p_workspace_id: workspaceId,
            p_days: parseInt(searchParams.get('days') || '30')
          })

        if (stats && stats.length > 0) {
          const stat = stats[0]
          return NextResponse.json({
            success: true,
            stats: {
              totalSessions: parseInt(stat.total_sessions),
              sessionsWithRecovery: parseInt(stat.sessions_with_recovery),
              totalRecoveryAttempts: parseInt(stat.total_recovery_attempts),
              successfulRecoveries: parseInt(stat.successful_recoveries),
              avgRecoveryDurationMs: parseFloat(stat.avg_recovery_duration_ms) || 0,
              recoverySuccessRate: parseFloat(stat.recovery_success_rate) || 0
            }
          })
        } else {
          return NextResponse.json({
            success: true,
            stats: {
              totalSessions: 0,
              sessionsWithRecovery: 0,
              totalRecoveryAttempts: 0,
              successfulRecoveries: 0,
              avgRecoveryDurationMs: 0,
              recoverySuccessRate: 0
            }
          })
        }

      case 'inactive_sessions':
        // Get sessions that might need recovery
        const inactiveHours = parseInt(searchParams.get('inactiveHours') || '2')
        
        const { data: inactiveSessions } = await supabase
          .rpc('trigger_session_recovery_for_inactive', {
            p_workspace_id: workspaceId,
            p_inactive_hours: inactiveHours
          })

        return NextResponse.json({
          success: true,
          inactiveSessions: (inactiveSessions || []).map(s => ({
            sessionId: s.session_id,
            lastActivity: s.last_activity,
            shouldRecover: s.should_recover
          })),
          count: inactiveSessions?.length || 0
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in session recovery GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get session recovery information' },
      { status: 500 }
    )
  }
}