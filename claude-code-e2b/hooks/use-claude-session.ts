'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  id: number
  session_id: string
  workspace_id: string
  event_type: string
  event_data: any
  created_at: string
}

export type SessionStatus = ClaudeSession['status']

interface UseClaudeSessionResult {
  session: ClaudeSession | null
  progress: ProgressEvent[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useClaudeSession(sessionId?: string): UseClaudeSessionResult {
  const [session, setSession] = useState<ClaudeSession | null>(null)
  const [progress, setProgress] = useState<ProgressEvent[]>([])
  const [isLoading, setIsLoading] = useState(!!sessionId)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchSession = async () => {
    if (!sessionId) {
      setIsLoading(false)
      return
    }

    try {
      setError(null)
      const response = await fetch(`/api/claude-sessions/${sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch session')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProgress = async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/claude-sessions/${sessionId}/progress`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch progress')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setProgress(data.progress || [])
    } catch (err) {
      console.error('Failed to fetch progress:', err)
      // Don't set error for progress fetch failures
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchSession()
    fetchProgress()
  }, [sessionId])

  // Real-time subscription for progress updates
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`progress:${sessionId}`)
      .on('broadcast', { event: '*' }, (payload) => {
        console.log('Progress update received:', payload)
        
        // Add new progress event
        const newEvent: ProgressEvent = {
          id: Date.now(), // Temporary ID
          session_id: sessionId,
          workspace_id: payload.workspace_id || '',
          event_type: payload.event || 'unknown',
          event_data: payload.data || payload.payload,
          created_at: new Date().toISOString()
        }
        
        setProgress(prev => [...prev, newEvent])

        // Update session status if status changed
        if (payload.event === 'status_change' && payload.data?.new_status) {
          setSession(prev => prev ? {
            ...prev,
            status: payload.data.new_status,
            updated_at: new Date().toISOString()
          } : null)
        }

        // Update sandbox URL if provided
        if (payload.event === 'sandbox_ready' && payload.data?.sandbox_url) {
          setSession(prev => prev ? {
            ...prev,
            e2b_sandbox_url: payload.data.sandbox_url,
            e2b_sandbox_id: payload.data.sandbox_id
          } : null)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase])

  // Real-time subscription for session updates
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel('claude_sessions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'claude_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          console.log('Session update received:', payload)
          setSession(payload.new as ClaudeSession)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, supabase])

  const refetch = async () => {
    setIsLoading(true)
    await fetchSession()
    await fetchProgress()
  }

  return {
    session,
    progress,
    isLoading,
    error,
    refetch
  }
}

// Custom hook for creating new sessions
export function useCreateClaudeSession() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async (params: {
    workspace_id: string
    user_id: string
    mode: 'business' | 'developer'
    requirements?: any
  }): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      return data.session_id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createSession,
    isLoading,
    error
  }
}

// Custom hook for managing session actions
export function useSessionActions(sessionId: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateSession = async (updates: Partial<ClaudeSession>) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/claude-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update session')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      return data.session
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async (message: string, context?: any) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-sessions/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_input: message,
          context
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const confirmRequirements = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-sessions/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          confirmed: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to confirm requirements')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    updateSession,
    sendMessage,
    confirmRequirements,
    isLoading,
    error
  }
}

// Utility function to format progress events for display
export function formatProgressEvent(event: ProgressEvent): string {
  switch (event.event_type) {
    case 'session_created':
      return 'Session initialized'
    case 'status_change':
      return `Status changed to ${event.event_data?.new_status || 'unknown'}`
    case 'requirements_gathered':
      return 'Requirements gathered and analyzed'
    case 'specification_generated':
      return 'Technical specification created'
    case 'code_generation_started':
      return 'Code generation started'
    case 'code_generation_progress':
      return `Code generation: ${event.event_data?.progress || 0}% complete`
    case 'sandbox_created':
      return 'Development sandbox created'
    case 'sandbox_ready':
      return 'Sandbox is ready for preview'
    case 'compliance_check':
      return `Compliance check: ${event.event_data?.score || 0}% score`
    case 'git_commit':
      return `Git commit: ${event.event_data?.message || 'Code updated'}`
    case 'deployment_ready':
      return 'Application ready for deployment'
    case 'error':
      return `Error: ${event.event_data?.message || 'Unknown error'}`
    default:
      return event.event_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

// Utility function to get progress percentage based on status
export function getProgressPercentage(status: SessionStatus): number {
  switch (status) {
    case 'discovering':
      return 20
    case 'planning':
      return 40
    case 'generating':
      return 70
    case 'reviewing':
      return 90
    case 'completed':
      return 100
    default:
      return 0
  }
}