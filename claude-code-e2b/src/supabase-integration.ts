/**
 * Supabase Integration for Claude Code E2B Progress Tracking
 * Handles database operations, real-time updates, and workspace isolation
 */

import { createClient } from '@supabase/supabase-js'

export interface ClaudeSession {
  id: string
  workspace_id: string
  user_id: string
  mode: 'business' | 'developer'
  status: 'discovering' | 'planning' | 'generating' | 'reviewing' | 'completed'
  requirements?: any
  specification?: any
  e2b_sandbox_id?: string
  e2b_sandbox_url?: string
  git_repository_url?: string
  created_at: string
  updated_at: string
}

export interface ProgressEvent {
  id?: number
  session_id: string
  workspace_id: string
  event_type: string
  event_data: any
  created_at?: string
}

export type SessionStatus = ClaudeSession['status']
export type UserMode = ClaudeSession['mode']

export class SupabaseIntegration {
  private supabase: any
  private realtimeChannel?: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Create a new Claude Code session
   */
  async createSession(params: {
    workspace_id: string
    user_id: string
    mode: UserMode
    requirements?: any
  }): Promise<{ data: ClaudeSession | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('claude_sessions')
        .insert({
          workspace_id: params.workspace_id,
          user_id: params.user_id,
          mode: params.mode,
          status: 'discovering',
          requirements: params.requirements || {}
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      // Log session creation
      await this.logProgressEvent({
        session_id: data.id,
        workspace_id: params.workspace_id,
        event_type: 'session_created',
        event_data: {
          mode: params.mode,
          initial_requirements: params.requirements
        }
      })

      return { data, error: null }
    } catch (error) {
      console.error('Failed to create session:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Update session status and data
   */
  async updateSession(
    sessionId: string, 
    updates: Partial<Omit<ClaudeSession, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<{ data: ClaudeSession | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('claude_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Log status change if status was updated
      if (updates.status) {
        await this.logProgressEvent({
          session_id: sessionId,
          workspace_id: data.workspace_id,
          event_type: 'status_change',
          event_data: {
            old_status: data.status,
            new_status: updates.status,
            timestamp: new Date().toISOString()
          }
        })
      }

      return { data, error: null }
    } catch (error) {
      console.error('Failed to update session:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get session by ID with workspace isolation
   */
  async getSession(
    sessionId: string, 
    workspaceId: string
  ): Promise<{ data: ClaudeSession | null; error: string | null }> {
    try {
      const { data, error } = await this.supabase
        .from('claude_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId) // Enforce workspace isolation
        .single()

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Failed to get session:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Get all sessions for a workspace
   */
  async getWorkspaceSessions(
    workspaceId: string,
    filters?: {
      user_id?: string
      mode?: UserMode
      status?: SessionStatus
      limit?: number
    }
  ): Promise<{ data: ClaudeSession[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('claude_sessions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id)
      }

      if (filters?.mode) {
        query = query.eq('mode', filters.mode)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Failed to get workspace sessions:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Log a progress event
   */
  async logProgressEvent(event: Omit<ProgressEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('claude_progress_events')
        .insert({
          session_id: event.session_id,
          workspace_id: event.workspace_id,
          event_type: event.event_type,
          event_data: event.event_data
        })

      if (error) {
        throw error
      }

      // Broadcast real-time update
      await this.broadcastProgressUpdate(event.session_id, {
        event: event.event_type,
        data: event.event_data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      console.error('Failed to log progress event:', error)
      // Don't throw - progress logging should not break main flow
    }
  }

  /**
   * Get progress events for a session
   */
  async getProgressEvents(
    sessionId: string,
    workspaceId: string,
    eventTypes?: string[]
  ): Promise<{ data: ProgressEvent[] | null; error: string | null }> {
    try {
      let query = this.supabase
        .from('claude_progress_events')
        .select('*')
        .eq('session_id', sessionId)
        .eq('workspace_id', workspaceId) // Enforce workspace isolation
        .order('created_at', { ascending: true })

      if (eventTypes && eventTypes.length > 0) {
        query = query.in('event_type', eventTypes)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Failed to get progress events:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Subscribe to real-time progress updates for a session
   */
  subscribeToProgress(
    sessionId: string,
    callback: (payload: any) => void
  ): () => void {
    const channel = this.supabase
      .channel(`progress:${sessionId}`)
      .on('broadcast', { event: '*' }, callback)
      .subscribe()

    // Return unsubscribe function
    return () => {
      this.supabase.removeChannel(channel)
    }
  }

  /**
   * Broadcast progress update to subscribers
   */
  private async broadcastProgressUpdate(sessionId: string, payload: any): Promise<void> {
    try {
      await this.supabase
        .channel(`progress:${sessionId}`)
        .send({
          type: 'broadcast',
          event: payload.event,
          payload: payload
        })
    } catch (error) {
      console.error('Failed to broadcast progress update:', error)
      // Don't throw - broadcasting should not break main flow
    }
  }

  /**
   * Initialize database schema (for deployment)
   */
  async initializeSchema(): Promise<{ success: boolean; error?: string }> {
    try {
      // Create claude_sessions table
      const sessionsSchema = `
        CREATE TABLE IF NOT EXISTS claude_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL REFERENCES workspace(id),
          user_id UUID NOT NULL,
          mode TEXT NOT NULL CHECK (mode IN ('business', 'developer')),
          status TEXT NOT NULL CHECK (status IN ('discovering', 'planning', 'generating', 'reviewing', 'completed')),
          requirements JSONB,
          specification JSONB,
          e2b_sandbox_id TEXT,
          e2b_sandbox_url TEXT,
          git_repository_url TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `

      const progressEventsSchema = `
        CREATE TABLE IF NOT EXISTS claude_progress_events (
          id BIGSERIAL PRIMARY KEY,
          session_id UUID NOT NULL REFERENCES claude_sessions(id),
          workspace_id UUID NOT NULL REFERENCES workspace(id),
          event_type TEXT NOT NULL,
          event_data JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `

      const rlsPolicies = `
        -- Enable Row-Level Security
        ALTER TABLE claude_sessions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE claude_progress_events ENABLE ROW LEVEL SECURITY;

        -- Create workspace isolation policies
        CREATE POLICY IF NOT EXISTS "workspace_isolation" ON claude_sessions
        FOR ALL USING (workspace_id = (jwt.claims->>'workspace_id')::uuid);

        CREATE POLICY IF NOT EXISTS "workspace_isolation" ON claude_progress_events  
        FOR ALL USING (workspace_id = (jwt.claims->>'workspace_id')::uuid);
      `

      // Execute schema creation (would need proper migration system in production)
      await this.supabase.rpc('exec_sql', { sql: sessionsSchema })
      await this.supabase.rpc('exec_sql', { sql: progressEventsSchema })
      await this.supabase.rpc('exec_sql', { sql: rlsPolicies })

      return { success: true }
    } catch (error) {
      console.error('Failed to initialize schema:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Clean up old sessions (for maintenance)
   */
  async cleanupOldSessions(olderThanDays: number = 30): Promise<{ cleaned: number; error?: string }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      // Delete old progress events first (foreign key constraint)
      const { error: eventsError } = await this.supabase
        .from('claude_progress_events')
        .delete()
        .lt('created_at', cutoffDate.toISOString())

      if (eventsError) {
        throw eventsError
      }

      // Delete old sessions
      const { data, error: sessionsError } = await this.supabase
        .from('claude_sessions')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select('id')

      if (sessionsError) {
        throw sessionsError
      }

      return { cleaned: data?.length || 0 }
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error)
      return { 
        cleaned: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
}

// Export singleton instance
export const supabaseIntegration = new SupabaseIntegration()