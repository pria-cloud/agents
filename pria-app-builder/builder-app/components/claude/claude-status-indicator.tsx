'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Bot, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Activity,
  Clock,
  Server
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeStatusIndicatorProps {
  sessionId: string
  className?: string
  onStatusChange?: (status: 'ready' | 'error' | 'loading' | 'inactive') => void
}

interface StatusData {
  sandboxActive: boolean
  lastInteraction?: string
  activeSessions: number
}

export function ClaudeStatusIndicator({ 
  sessionId, 
  className,
  onStatusChange 
}: ClaudeStatusIndicatorProps) {
  const [status, setStatus] = useState<'ready' | 'error' | 'loading' | 'inactive'>('loading')
  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const checkStatus = async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true)
    
    try {
      const response = await fetch(`/api/claude-sdk/sync?sessionId=${sessionId}`)
      const data = await response.json()

      if (data.success) {
        const newStatus = data.status.sandboxActive ? 'ready' : 'inactive'
        setStatus(newStatus)
        setStatusData(data.status)
        onStatusChange?.(newStatus)
      } else {
        setStatus('error')
        onStatusChange?.('error')
      }
    } catch (error) {
      console.error('Failed to check Claude status:', error)
      setStatus('error')
      onStatusChange?.('error')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    checkStatus()
    
    // Poll status every 30 seconds
    const interval = setInterval(() => checkStatus(false), 30000)
    
    return () => clearInterval(interval)
  }, [sessionId])

  const getStatusColor = () => {
    switch (status) {
      case 'ready': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      case 'loading': return 'bg-yellow-500 animate-pulse'
      case 'inactive': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'ready': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error': return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'loading': return <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
      case 'inactive': return <Bot className="h-4 w-4 text-gray-600" />
      default: return <Bot className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'ready': return 'Claude Ready'
      case 'error': return 'Connection Error'
      case 'loading': return 'Checking Status'
      case 'inactive': return 'Target App Inactive'
      default: return 'Unknown Status'
    }
  }

  const formatLastInteraction = (dateString?: string) => {
    if (!dateString) return 'Never'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn(
                "w-3 h-3 rounded-full",
                getStatusColor()
              )} />
              <div className="absolute -top-1 -left-1">
                {getStatusIcon()}
              </div>
            </div>
            
            <div>
              <div className="font-medium text-sm">{getStatusText()}</div>
              {statusData && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatLastInteraction(statusData.lastInteraction)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Server className="h-3 w-3" />
                      {statusData.activeSessions} active
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {status === 'ready' && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <Activity className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => checkStatus()}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                isRefreshing && "animate-spin"
              )} />
            </Button>
          </div>
        </div>
        
        {status === 'error' && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            Unable to connect to Claude Code SDK. Check your connection and try again.
          </div>
        )}
        
        {status === 'inactive' && (
          <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
            Target App is not active. Initialize it to start interacting with Claude.
          </div>
        )}
      </CardContent>
    </Card>
  )
}