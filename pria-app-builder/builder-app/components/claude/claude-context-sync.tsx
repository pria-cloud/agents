'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  RefreshCw, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle,
  Database,
  FileText,
  Settings,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeContextSyncProps {
  sessionId: string
  workspaceId: string
  currentPhase: number
  subagentRole: string
  onSyncComplete?: (direction: 'to_target' | 'from_target', data: any) => void
  className?: string
}

interface SyncStatus {
  direction: 'to_target' | 'from_target'
  progress: number
  message: string
  success?: boolean
  error?: string
  timestamp: Date
}

interface ContextSummary {
  currentPhase: number
  subagentRole: string
  requirementsCount: number
  tasksCount: number
  artifactsCount: number
  lastSync: string
}

export function ClaudeContextSync({
  sessionId,
  workspaceId,
  currentPhase,
  subagentRole,
  onSyncComplete,
  className
}: ClaudeContextSyncProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null)

  const syncToTarget = async () => {
    setIsLoading(true)
    setSyncStatus({
      direction: 'to_target',
      progress: 0,
      message: 'Preparing context data...',
      timestamp: new Date()
    })

    try {
      // Simulate progress updates
      setSyncStatus(prev => prev ? { ...prev, progress: 25, message: 'Gathering requirements...' } : null)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setSyncStatus(prev => prev ? { ...prev, progress: 50, message: 'Syncing to Target App...' } : null)

      const response = await fetch('/api/claude-sdk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          direction: 'to_target',
          contextData: {
            currentPhase,
            subagentRole,
            workspaceId
          }
        })
      })

      const data = await response.json()

      setSyncStatus(prev => prev ? { ...prev, progress: 100, message: data.message, success: data.success, error: data.error } : null)

      if (data.success && onSyncComplete) {
        onSyncComplete('to_target', data)
      }

    } catch (error) {
      setSyncStatus(prev => prev ? { 
        ...prev, 
        progress: 100, 
        message: 'Sync failed', 
        success: false, 
        error: String(error) 
      } : null)
    } finally {
      setIsLoading(false)
      setTimeout(() => setSyncStatus(null), 3000)
    }
  }

  const syncFromTarget = async () => {
    setIsLoading(true)
    setSyncStatus({
      direction: 'from_target',
      progress: 0,
      message: 'Reading Target App context...',
      timestamp: new Date()
    })

    try {
      setSyncStatus(prev => prev ? { ...prev, progress: 25, message: 'Reading context files...' } : null)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setSyncStatus(prev => prev ? { ...prev, progress: 50, message: 'Updating Builder App...' } : null)

      const response = await fetch('/api/claude-sdk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          direction: 'from_target'
        })
      })

      const data = await response.json()

      setSyncStatus(prev => prev ? { 
        ...prev, 
        progress: 100, 
        message: data.message, 
        success: data.success, 
        error: data.error 
      } : null)

      if (data.success) {
        setContextSummary(data.context)
        if (onSyncComplete) {
          onSyncComplete('from_target', data)
        }
      }

    } catch (error) {
      setSyncStatus(prev => prev ? { 
        ...prev, 
        progress: 100, 
        message: 'Sync failed', 
        success: false, 
        error: String(error) 
      } : null)
    } finally {
      setIsLoading(false)
      setTimeout(() => setSyncStatus(null), 3000)
    }
  }

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          Context Synchronization
          <Badge variant="outline" className="ml-auto text-xs">
            Phase {currentPhase}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Context Summary */}
        {contextSummary && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Settings className="h-3 w-3" />
              Current Context
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Phase: {contextSummary.currentPhase}</div>
              <div>Role: {contextSummary.subagentRole}</div>
              <div>Requirements: {contextSummary.requirementsCount}</div>
              <div>Tasks: {contextSummary.tasksCount}</div>
              <div>Artifacts: {contextSummary.artifactsCount}</div>
              <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last sync: {formatTimestamp(contextSummary.lastSync)}
              </div>
            </div>
          </div>
        )}

        {/* Sync Status */}
        {syncStatus && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {syncStatus.direction === 'to_target' ? (
                <Upload className="h-4 w-4 text-blue-500" />
              ) : (
                <Download className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium">
                {syncStatus.direction === 'to_target' ? 'Syncing to Target' : 'Syncing from Target'}
              </span>
            </div>
            
            <Progress value={syncStatus.progress} className="h-2" />
            
            <div className="text-xs text-muted-foreground">
              {syncStatus.message}
            </div>
            
            {syncStatus.success !== undefined && (
              <Alert className={cn(
                syncStatus.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              )}>
                {syncStatus.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className={cn(
                  syncStatus.success ? "text-green-800" : "text-red-800"
                )}>
                  {syncStatus.success ? 'Sync completed successfully!' : syncStatus.error || 'Sync failed'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Sync Actions */}
        {!syncStatus && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={syncToTarget}
              disabled={isLoading}
              className="h-9"
            >
              <Upload className="h-3 w-3 mr-2" />
              Sync to Target
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromTarget}
              disabled={isLoading}
              className="h-9"
            >
              <Download className="h-3 w-3 mr-2" />
              Sync from Target
            </Button>
          </div>
        )}

        {/* Context Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Synchronizes requirements, specs, tasks, and artifacts
          </div>
          <div>• To Target: Updates Target App with Builder App context</div>
          <div>• From Target: Updates Builder App with Target App progress</div>
        </div>
      </CardContent>
    </Card>
  )
}