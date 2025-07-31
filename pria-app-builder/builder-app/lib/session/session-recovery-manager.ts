/**
 * Session Recovery Manager - Handles session restoration and context recovery
 * Manages sandbox reconnection, workflow state restoration, and data recovery
 */

import { Sandbox } from 'e2b'
import createServerClient from '@/lib/supabase/server'
import { WorkflowManager } from '@/lib/workflow/workflow-manager'
import { E2BSandboxManager } from '@/lib/e2b/sandbox-manager-simple'

export interface SessionRecoveryContext {
  sessionId: string
  workspaceId: string
  userId: string
  lastActivity: Date
  recoveryAttempt: number
}

export interface RecoveryResult {
  success: boolean
  sessionRestored: boolean
  sandboxReconnected: boolean
  workflowRestored: boolean
  contextRestored: boolean
  errors: string[]
  warnings: string[]
  restoredData: {
    messages: number
    requirements: number
    artifacts: number
    workflowPhase: number
  }
}

export interface SessionSnapshot {
  sessionId: string
  workspaceId: string
  createdAt: Date
  lastActivity: Date
  metadata: {
    phase: number
    progress: number
    projectName: string
    sandboxId?: string
    targetDirectory?: string
  }
  messages: any[]
  requirements: any[]
  workflows: any[]
  artifacts: any[]
}

export class SessionRecoveryManager {
  private context: SessionRecoveryContext
  private supabase: ReturnType<typeof createServerClient>

  constructor(context: SessionRecoveryContext) {
    this.context = context
  }

  /**
   * Initialize Supabase client
   */
  private async initializeSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerClient()
    }
    return this.supabase
  }

  /**
   * Attempt complete session recovery
   */
  async recoverSession(): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      sessionRestored: false,
      sandboxReconnected: false,
      workflowRestored: false,
      contextRestored: false,
      errors: [],
      warnings: [],
      restoredData: {
        messages: 0,
        requirements: 0,
        artifacts: 0,
        workflowPhase: 0
      }
    }

    try {
      console.log(`[SESSION RECOVERY] Starting recovery for session: ${this.context.sessionId}`)
      console.log(`[SESSION RECOVERY] Recovery attempt: ${this.context.recoveryAttempt}`)

      const supabase = await this.initializeSupabase()

      // 1. Verify session exists and is recoverable
      const sessionData = await this.verifySessionRecoverable()
      if (!sessionData) {
        result.errors.push('Session not found or not recoverable')
        return result
      }

      result.sessionRestored = true

      // 2. Restore sandbox connection
      const sandboxResult = await this.restoreSandboxConnection(sessionData)
      if (sandboxResult.success) {
        result.sandboxReconnected = true
      } else {
        result.warnings.push('Sandbox reconnection failed - will create new sandbox if needed')
        result.warnings.push(...sandboxResult.errors)
      }

      // 3. Restore workflow state
      const workflowResult = await this.restoreWorkflowState(sessionData)
      if (workflowResult.success) {
        result.workflowRestored = true
        result.restoredData.workflowPhase = workflowResult.phase
      } else {
        result.warnings.push('Workflow state restoration failed - will initialize default workflow')
        result.warnings.push(...workflowResult.errors)
      }

      // 4. Restore session context (messages, requirements, artifacts)
      const contextResult = await this.restoreSessionContext(sessionData)
      if (contextResult.success) {
        result.contextRestored = true
        result.restoredData = {
          ...result.restoredData,
          ...contextResult.counts
        }
      } else {
        result.warnings.push('Partial context restoration - some data may be missing')
        result.warnings.push(...contextResult.errors)
      }

      // 5. Update session activity timestamp
      await this.updateSessionActivity()

      // 6. Record recovery attempt
      await this.recordRecoveryAttempt(result)

      result.success = result.sessionRestored && (result.sandboxReconnected || result.workflowRestored)

      console.log(`[SESSION RECOVERY] Recovery completed. Success: ${result.success}`)
      console.log(`[SESSION RECOVERY] Restored: ${result.restoredData.messages} messages, ${result.restoredData.requirements} requirements`)

      return result

    } catch (error) {
      console.error('[SESSION RECOVERY] Recovery failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown recovery error')
      await this.recordRecoveryAttempt(result)
      return result
    }
  }

  /**
   * Create session snapshot for backup purposes
   */
  async createSessionSnapshot(): Promise<SessionSnapshot | null> {
    try {
      console.log(`[SESSION RECOVERY] Creating snapshot for session: ${this.context.sessionId}`)

      const supabase = await this.initializeSupabase()

      // Get session data
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', this.context.sessionId)
        .eq('workspace_id', this.context.workspaceId)
        .single()

      if (!session) {
        console.error('[SESSION RECOVERY] Session not found for snapshot')
        return null
      }

      // Get related data
      const [messagesResult, requirementsResult, workflowsResult, artifactsResult] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', this.context.sessionId)
          .eq('workspace_id', this.context.workspaceId)
          .order('created_at', { ascending: true }),
        
        supabase
          .from('requirements')
          .select('*')
          .eq('session_id', this.context.sessionId)
          .eq('workspace_id', this.context.workspaceId)
          .order('created_at', { ascending: true }),
        
        supabase
          .from('workflow_states')
          .select('*')
          .eq('session_id', this.context.sessionId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('workflow_artifacts')
          .select('*')
          .eq('session_id', this.context.sessionId)
          .order('created_at', { ascending: false })
      ])

      const snapshot: SessionSnapshot = {
        sessionId: this.context.sessionId,
        workspaceId: this.context.workspaceId,
        createdAt: new Date(session.created_at),
        lastActivity: new Date(),
        metadata: {
          phase: session.metadata?.current_phase || 1,
          progress: session.metadata?.progress || 0,
          projectName: session.metadata?.project_name || `PRIA App ${this.context.sessionId.slice(0, 8)}`,
          sandboxId: session.e2b_sandbox_id,
          targetDirectory: session.target_directory
        },
        messages: messagesResult.data || [],
        requirements: requirementsResult.data || [],
        workflows: workflowsResult.data || [],
        artifacts: artifactsResult.data || []
      }

      // Store snapshot in database
      await supabase
        .from('session_snapshots')
        .upsert({
          session_id: this.context.sessionId,
          workspace_id: this.context.workspaceId,
          snapshot_data: snapshot,
          created_at: new Date().toISOString()
        })

      console.log(`[SESSION RECOVERY] Snapshot created: ${snapshot.messages.length} messages, ${snapshot.requirements.length} requirements`)

      return snapshot

    } catch (error) {
      console.error('[SESSION RECOVERY] Failed to create snapshot:', error)
      return null
    }
  }

  /**
   * Restore session from snapshot
   */
  async restoreFromSnapshot(snapshotId?: string): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      sessionRestored: false,
      sandboxReconnected: false,
      workflowRestored: false,
      contextRestored: false,
      errors: [],
      warnings: [],
      restoredData: {
        messages: 0,
        requirements: 0,
        artifacts: 0,
        workflowPhase: 0
      }
    }

    try {
      console.log(`[SESSION RECOVERY] Restoring from snapshot for session: ${this.context.sessionId}`)

      const supabase = await this.initializeSupabase()

      // Get snapshot data
      let snapshotQuery = supabase
        .from('session_snapshots')
        .select('*')
        .eq('session_id', this.context.sessionId)
        .eq('workspace_id', this.context.workspaceId)

      if (snapshotId) {
        snapshotQuery = snapshotQuery.eq('id', snapshotId)
      } else {
        snapshotQuery = snapshotQuery.order('created_at', { ascending: false }).limit(1)
      }

      const { data: snapshotData } = await snapshotQuery.single()

      if (!snapshotData?.snapshot_data) {
        result.errors.push('No snapshot found for restoration')
        return result
      }

      const snapshot: SessionSnapshot = snapshotData.snapshot_data

      // Restore session metadata
      await supabase
        .from('sessions')
        .update({
          metadata: snapshot.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.context.sessionId)

      result.sessionRestored = true

      // Restore workflow state
      if (snapshot.workflows.length > 0) {
        const latestWorkflow = snapshot.workflows[0]
        await supabase
          .from('workflow_states')
          .upsert({
            session_id: this.context.sessionId,
            workflow_data: latestWorkflow.workflow_data,
            current_phase: latestWorkflow.current_phase,
            progress: latestWorkflow.progress,
            updated_at: new Date().toISOString()
          })

        result.workflowRestored = true
        result.restoredData.workflowPhase = latestWorkflow.current_phase
      }

      // Note: Messages and requirements are typically preserved in database
      // This method focuses on restoring metadata and workflow state
      result.contextRestored = true
      result.restoredData.messages = snapshot.messages.length
      result.restoredData.requirements = snapshot.requirements.length
      result.restoredData.artifacts = snapshot.artifacts.length

      result.success = true

      console.log(`[SESSION RECOVERY] Snapshot restoration completed successfully`)
      await this.recordRecoveryAttempt(result)

      return result

    } catch (error) {
      console.error('[SESSION RECOVERY] Snapshot restoration failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Snapshot restoration failed')
      await this.recordRecoveryAttempt(result)
      return result
    }
  }

  /**
   * Get session recovery history
   */
  async getRecoveryHistory(): Promise<Array<{
    id: string
    recoveryAttempt: number
    success: boolean
    timestamp: Date
    errors: string[]
    restoredData: any
  }>> {
    try {
      const supabase = await this.initializeSupabase()

      const { data: history } = await supabase
        .from('session_recovery_logs')
        .select('*')
        .eq('session_id', this.context.sessionId)
        .eq('workspace_id', this.context.workspaceId)
        .order('created_at', { ascending: false })
        .limit(10)

      return (history || []).map(record => ({
        id: record.id,
        recoveryAttempt: record.recovery_attempt,
        success: record.success,
        timestamp: new Date(record.created_at),
        errors: record.errors || [],
        restoredData: record.restored_data || {}
      }))

    } catch (error) {
      console.error('[SESSION RECOVERY] Failed to get recovery history:', error)
      return []
    }
  }

  // Private helper methods

  private async verifySessionRecoverable(): Promise<any> {
    try {
      const supabase = await this.initializeSupabase()

      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', this.context.sessionId)
        .eq('workspace_id', this.context.workspaceId)
        .single()

      if (!session) {
        return null
      }

      // Check if session is not too old (e.g., 30 days)
      const sessionAge = Date.now() - new Date(session.created_at).getTime()
      const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

      if (sessionAge > maxAge) {
        console.warn('[SESSION RECOVERY] Session is too old for recovery')
        return null
      }

      return session

    } catch (error) {
      console.error('[SESSION RECOVERY] Session verification failed:', error)
      return null
    }
  }

  private async restoreSandboxConnection(sessionData: any): Promise<{
    success: boolean
    sandboxId?: string
    errors: string[]
  }> {
    try {
      if (!sessionData.e2b_sandbox_id) {
        return {
          success: false,
          errors: ['No sandbox ID found in session data']
        }
      }

      console.log(`[SESSION RECOVERY] Attempting to reconnect to sandbox: ${sessionData.e2b_sandbox_id}`)

      // Try to reconnect to existing sandbox
      const sandbox = await Sandbox.reconnect(sessionData.e2b_sandbox_id)
      
      // Test if sandbox is responsive
      await sandbox.process.startAndWait('echo "recovery test"', { timeout: 10000 })

      console.log(`[SESSION RECOVERY] Successfully reconnected to sandbox: ${sessionData.e2b_sandbox_id}`)

      return {
        success: true,
        sandboxId: sessionData.e2b_sandbox_id,
        errors: []
      }

    } catch (error) {
      console.error('[SESSION RECOVERY] Sandbox reconnection failed:', error)
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Sandbox reconnection failed']
      }
    }
  }

  private async restoreWorkflowState(sessionData: any): Promise<{
    success: boolean
    phase: number
    errors: string[]
  }> {
    try {
      const workflowManager = new WorkflowManager(this.context.sessionId)
      
      // Try to get existing workflow state
      const workflowState = await workflowManager.getWorkflowState()
      
      if (workflowState) {
        console.log(`[SESSION RECOVERY] Workflow state found: Phase ${workflowState.current_phase}`)
        return {
          success: true,
          phase: workflowState.current_phase,
          errors: []
        }
      }

      // Initialize default workflow if none exists
      const metadata = sessionData.metadata || {}
      await workflowManager.initializeWorkflow({
        projectName: metadata.project_name || `PRIA App ${this.context.sessionId.slice(0, 8)}`,
        projectType: metadata.project_type || 'medium',
        targetTechnology: metadata.target_technology || 'Next.js + Supabase'
      })

      return {
        success: true,
        phase: 1,
        errors: []
      }

    } catch (error) {
      console.error('[SESSION RECOVERY] Workflow restoration failed:', error)
      return {
        success: false,
        phase: 0,
        errors: [error instanceof Error ? error.message : 'Workflow restoration failed']
      }
    }
  }

  private async restoreSessionContext(sessionData: any): Promise<{
    success: boolean
    counts: {
      messages: number
      requirements: number
      artifacts: number
    }
    errors: string[]
  }> {
    try {
      const supabase = await this.initializeSupabase()

      // Count existing data
      const [messagesResult, requirementsResult, artifactsResult] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id', { count: 'exact' })
          .eq('session_id', this.context.sessionId)
          .eq('workspace_id', this.context.workspaceId),
        
        supabase
          .from('requirements')
          .select('id', { count: 'exact' })
          .eq('session_id', this.context.sessionId)
          .eq('workspace_id', this.context.workspaceId),
        
        supabase
          .from('workflow_artifacts')
          .select('id', { count: 'exact' })
          .eq('session_id', this.context.sessionId)
      ])

      const counts = {
        messages: messagesResult.count || 0,
        requirements: requirementsResult.count || 0,
        artifacts: artifactsResult.count || 0
      }

      console.log(`[SESSION RECOVERY] Context counts: ${counts.messages} messages, ${counts.requirements} requirements, ${counts.artifacts} artifacts`)

      return {
        success: true,
        counts,
        errors: []
      }

    } catch (error) {
      console.error('[SESSION RECOVERY] Context restoration failed:', error)
      return {
        success: false,
        counts: { messages: 0, requirements: 0, artifacts: 0 },
        errors: [error instanceof Error ? error.message : 'Context restoration failed']
      }
    }
  }

  private async updateSessionActivity(): Promise<void> {
    try {
      const supabase = await this.initializeSupabase()

      await supabase
        .from('sessions')
        .update({
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', this.context.sessionId)

    } catch (error) {
      console.error('[SESSION RECOVERY] Failed to update session activity:', error)
    }
  }

  private async recordRecoveryAttempt(result: RecoveryResult): Promise<void> {
    try {
      const supabase = await this.initializeSupabase()

      await supabase
        .from('session_recovery_logs')
        .insert({
          session_id: this.context.sessionId,
          workspace_id: this.context.workspaceId,
          user_id: this.context.userId,
          recovery_attempt: this.context.recoveryAttempt,
          success: result.success,
          errors: result.errors,
          warnings: result.warnings,
          restored_data: result.restoredData,
          created_at: new Date().toISOString()
        })

    } catch (error) {
      console.error('[SESSION RECOVERY] Failed to record recovery attempt:', error)
    }
  }
}