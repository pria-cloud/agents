'use client'

import { useState, useEffect } from 'react'
import { Activity, Wifi, WifiOff, GitBranch, Clock, HardDrive } from 'lucide-react'

interface StatusInfo {
  api: {
    connected: boolean
    latency?: number
  }
  websocket: {
    connected: boolean
    clientsCount?: number
  }
  git: {
    branch?: string
    hasChanges?: boolean
  }
  project: {
    name?: string
    status?: string
  }
}

export function StatusBar() {
  const [status, setStatus] = useState<StatusInfo>({
    api: { connected: false },
    websocket: { connected: false },
    git: {},
    project: {}
  })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Check status periodically
    const statusInterval = setInterval(checkStatus, 10000) // Every 10 seconds
    
    // Initial status check
    checkStatus()

    // Setup WebSocket connection for real-time updates
    setupWebSocket()

    return () => {
      clearInterval(timeInterval)
      clearInterval(statusInterval)
    }
  }, [])

  const checkStatus = async () => {
    try {
      // Check API health
      const startTime = Date.now()
      const apiResponse = await fetch('/api/health')
      const apiLatency = Date.now() - startTime
      
      const apiConnected = apiResponse.ok
      
      // Get additional status info if API is connected
      let gitInfo = {}
      let projectInfo = {}
      
      if (apiConnected) {
        try {
          // Get git status
          const gitResponse = await fetch('/api/git/status')
          if (gitResponse.ok) {
            const gitData = await gitResponse.json()
            gitInfo = {
              branch: gitData.branch,
              hasChanges: gitData.staged.length > 0 || gitData.modified.length > 0 || gitData.untracked.length > 0
            }
          }
        } catch (error) {
          // Git info not available, that's ok
        }

        try {
          // Get project status
          const projectResponse = await fetch('/api/project/status')
          if (projectResponse.ok) {
            const projectData = await projectResponse.json()
            projectInfo = {
              name: projectData.name,
              status: projectData.previewStatus
            }
          }
        } catch (error) {
          // Project info not available, that's ok
        }
      }

      setStatus(prev => ({
        ...prev,
        api: {
          connected: apiConnected,
          latency: apiConnected ? apiLatency : undefined
        },
        git: gitInfo,
        project: projectInfo
      }))
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        api: { connected: false }
      }))
    }
  }

  const setupWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        setStatus(prev => ({
          ...prev,
          websocket: { connected: true }
        }))
        
        // Subscribe to status updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'status'
        }))
      }

      ws.onclose = () => {
        setStatus(prev => ({
          ...prev,
          websocket: { connected: false }
        }))
        
        // Attempt to reconnect after 5 seconds
        setTimeout(setupWebSocket, 5000)
      }

      ws.onerror = () => {
        setStatus(prev => ({
          ...prev,
          websocket: { connected: false }
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // Handle different message types
          switch (message.type) {
            case 'status':
              // Update status with real-time info
              break
            case 'project_built':
            case 'preview_started':
            case 'git_committed':
              // Refresh status when important events happen
              setTimeout(checkStatus, 500)
              break
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
    } catch (error) {
      console.error('Error setting up WebSocket:', error)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="h-8 bg-card border-t border-border px-4 flex items-center justify-between text-xs text-muted-foreground">
      {/* Left side - Connection status */}
      <div className="flex items-center gap-4">
        {/* API Status */}
        <div className="flex items-center gap-1">
          {status.api.connected ? (
            <Wifi size={12} className="text-green-600" />
          ) : (
            <WifiOff size={12} className="text-red-600" />
          )}
          <span>
            API {status.api.connected ? 'Connected' : 'Disconnected'}
            {status.api.latency && ` (${status.api.latency}ms)`}
          </span>
        </div>

        {/* WebSocket Status */}
        <div className="flex items-center gap-1">
          <Activity size={12} className={status.websocket.connected ? 'text-green-600' : 'text-red-600'} />
          <span>
            WS {status.websocket.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Git Status */}
        {status.git.branch && (
          <div className="flex items-center gap-1">
            <GitBranch size={12} />
            <span>{status.git.branch}</span>
            {status.git.hasChanges && (
              <span className="w-2 h-2 bg-yellow-600 rounded-full" title="Uncommitted changes" />
            )}
          </div>
        )}
      </div>

      {/* Center - Project info */}
      <div className="flex items-center gap-4">
        {status.project.name && (
          <div className="flex items-center gap-1">
            <HardDrive size={12} />
            <span>{status.project.name}</span>
            {status.project.status && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                status.project.status === 'running' ? 'bg-green-100 text-green-800' :
                status.project.status === 'error' ? 'bg-red-100 text-red-800' :
                status.project.status === 'starting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {status.project.status}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side - Time and system info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{formatTime(currentTime)}</span>
        </div>
        
        {/* Environment indicator */}
        <div className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
            E2B
          </span>
        </div>
      </div>
    </div>
  )
}