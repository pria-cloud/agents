'use client'

import { useState } from 'react'
import { Play, Loader2, ExternalLink, Monitor, Smartphone } from 'lucide-react'

interface SandboxSession {
  id: string
  url: string
  status: 'creating' | 'running' | 'error'
  error?: string
}

export default function Home() {
  const [sessions, setSessions] = useState<SandboxSession[]>([])
  const [isCreating, setIsCreating] = useState(false)

  const createSandbox = async () => {
    setIsCreating(true)
    
    const newSession: SandboxSession = {
      id: `session-${Date.now()}`,
      url: '',
      status: 'creating'
    }
    
    setSessions(prev => [...prev, newSession])

    try {
      const response = await fetch('/api/sandbox/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: newSession.id
        })
      })

      const data = await response.json()

      if (data.success) {
        setSessions(prev => 
          prev.map(session => 
            session.id === newSession.id 
              ? { ...session, status: 'running', url: data.url }
              : session
          )
        )
      } else {
        setSessions(prev => 
          prev.map(session => 
            session.id === newSession.id 
              ? { ...session, status: 'error', error: data.error }
              : session
          )
        )
      }
    } catch (error) {
      setSessions(prev => 
        prev.map(session => 
          session.id === newSession.id 
            ? { ...session, status: 'error', error: 'Failed to create sandbox' }
            : session
        )
      )
    } finally {
      setIsCreating(false)
    }
  }

  const closeSandbox = async (sessionId: string) => {
    await fetch('/api/sandbox/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId })
    })

    setSessions(prev => prev.filter(session => session.id !== sessionId))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Claude Code UI Launcher
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Launch Claude Code UI instances in isolated E2B sandboxes
          </p>
          
          <button
            onClick={createSandbox}
            disabled={isCreating}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            Launch New Claude Code UI
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No active sessions. Click the button above to get started!</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {sessions.map((session, index) => (
              <div key={session.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      session.status === 'running' ? 'bg-green-500' :
                      session.status === 'creating' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <h3 className="font-semibold text-gray-900">
                      Claude Code UI Session #{index + 1}
                    </h3>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {session.status === 'running' && (
                      <a
                        href={session.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Open in New Tab
                      </a>
                    )}
                    
                    <button
                      onClick={() => closeSandbox(session.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {session.status === 'creating' && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
                      <span className="text-gray-600">Creating sandbox...</span>
                    </div>
                  )}

                  {session.status === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800 font-semibold">Error creating sandbox</p>
                      <p className="text-red-600 mt-1">{session.error}</p>
                    </div>
                  )}

                  {session.status === 'running' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Sandbox URL:</span>
                        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {session.url}
                        </span>
                      </div>
                      
                      <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                        <iframe
                          src={session.url}
                          className="w-full h-full"
                          title={`Claude Code UI - Session ${index + 1}`}
                          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}