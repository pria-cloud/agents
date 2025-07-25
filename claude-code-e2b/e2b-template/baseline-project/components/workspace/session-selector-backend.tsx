"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Settings, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Session {
  id: string
  workspace_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  last_active?: string
}

interface SessionSelectorProps {
  currentSessionId?: string
  onSessionChange: (session: Session) => void
  workspaceId: string
}

export function SessionSelector({ currentSessionId, onSessionChange, workspaceId }: SessionSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  // Fetch sessions from backend
  useEffect(() => {
    fetchSessions()
  }, [workspaceId])

  // Update current session when sessions or currentSessionId changes
  useEffect(() => {
    if (currentSessionId && sessions.length > 0) {
      const session = sessions.find(s => s.id === currentSessionId)
      if (session) {
        setCurrentSession(session)
      }
    }
  }, [currentSessionId, sessions])

  const fetchSessions = async () => {
    try {
      const response = await fetch(`/api/sessions?workspace_id=${workspaceId}`)
      if (!response.ok) throw new Error('Failed to fetch sessions')
      const data = await response.json()
      
      // Format the sessions with calculated last active time
      const formattedSessions = data.map((session: Session) => ({
        ...session,
        last_active: calculateLastActive(session.updated_at)
      }))
      
      setSessions(formattedSessions)
      
      // Set current session if not already set
      if (!currentSession && formattedSessions.length > 0) {
        const activeSession = formattedSessions.find((s: Session) => s.status === 'active') || formattedSessions[0]
        setCurrentSession(activeSession)
        onSessionChange(activeSession)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateLastActive = (timestamp: string): string => {
    const now = new Date()
    const updatedAt = new Date(timestamp)
    const diffMs = now.getTime() - updatedAt.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSessionName.trim(),
          description: `Created at ${new Date().toLocaleString()}`,
          workspace_id: workspaceId,
          status: 'active'
        })
      })
      
      if (!response.ok) throw new Error('Failed to create session')
      
      const newSession = await response.json()
      const formattedSession = {
        ...newSession,
        last_active: 'Just now'
      }
      
      setSessions([formattedSession, ...sessions])
      setCurrentSession(formattedSession)
      onSessionChange(formattedSession)
      setNewSessionName('')
      setIsDialogOpen(false)
      
      toast({
        title: 'Success',
        description: 'New session created'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create session',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleSessionSelect = async (session: Session) => {
    try {
      // Update session status to active
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          workspace_id: workspaceId
        })
      })
      
      if (!response.ok) throw new Error('Failed to update session')
      
      const updatedSession = await response.json()
      
      // Update local state
      setSessions(sessions.map(s => 
        s.id === session.id ? { ...updatedSession, last_active: 'Just now' } : s
      ))
      setCurrentSession({ ...updatedSession, last_active: 'Just now' })
      onSessionChange({ ...updatedSession, last_active: 'Just now' })
      setIsDialogOpen(false)
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to switch session',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <Button variant="outline" disabled className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading sessions...</span>
      </Button>
    )
  }

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'archived':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <span>{currentSession?.name || 'Select Session'}</span>
          {currentSession && (
            <Badge variant={getBadgeVariant(currentSession.status)}>
              {currentSession.status}
            </Badge>
          )}
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session Management</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Active Sessions</h4>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No sessions yet. Create your first session below.
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => handleSessionSelect(session)}
                >
                  <div>
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-gray-500">{session.last_active}</p>
                  </div>
                  <Badge variant={getBadgeVariant(session.status)}>
                    {session.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Create New Session</h4>
            <div className="flex space-x-2">
              <Input
                placeholder="Session name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
                disabled={creating}
              />
              <Button 
                onClick={handleCreateSession} 
                size="sm"
                disabled={creating || !newSessionName.trim()}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}