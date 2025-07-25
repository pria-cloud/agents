"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Settings } from "lucide-react"

interface Session {
  id: string
  name: string
  status: 'connected' | 'disconnected'
  lastActive: string
}

interface SessionSelectorProps {
  currentSession: Session
  onSessionChange: (session: Session) => void
}

export function SessionSelector({ currentSession, onSessionChange }: SessionSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')

  const sessions: Session[] = [
    { id: '1', name: 'E-commerce Platform', status: 'connected', lastActive: '2 minutes ago' },
    { id: '2', name: 'Task Management App', status: 'disconnected', lastActive: '1 hour ago' },
    { id: '3', name: 'Analytics Dashboard', status: 'disconnected', lastActive: '3 hours ago' }
  ]

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      const newSession: Session = {
        id: Date.now().toString(),
        name: newSessionName.trim(),
        status: 'connected',
        lastActive: 'Just now'
      }
      onSessionChange(newSession)
      setNewSessionName('')
      setIsDialogOpen(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <span>{currentSession.name}</span>
          <Badge variant={currentSession.status === 'connected' ? 'default' : 'secondary'}>
            {currentSession.status}
          </Badge>
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
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  onSessionChange(session)
                  setIsDialogOpen(false)
                }}
              >
                <div>
                  <p className="font-medium">{session.name}</p>
                  <p className="text-sm text-gray-500">{session.lastActive}</p>
                </div>
                <Badge variant={session.status === 'connected' ? 'default' : 'secondary'}>
                  {session.status}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Create New Session</h4>
            <div className="flex space-x-2">
              <Input
                placeholder="Session name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
              />
              <Button onClick={handleCreateSession} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}