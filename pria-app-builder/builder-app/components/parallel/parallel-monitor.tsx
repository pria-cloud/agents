'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Users,
  Activity,
  BarChart3,
  Settings
} from 'lucide-react'

interface ParallelBatch {
  id: string
  sessionId: string
  phase: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime?: string
  endTime?: string
  taskCount: number
  results: string[]
  errors: string[]
}

interface ParallelProgress {
  total: number
  completed: number
  failed: number
  running: number
  completion_percentage: number
}

interface ParallelTask {
  id: string
  agentName: string
  description: string
  priority: 'high' | 'medium' | 'low'
  dependencies?: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface ParallelMonitorProps {
  sessionId: string
  className?: string
}

export function ParallelMonitor({ sessionId, className }: ParallelMonitorProps) {
  const [activeBatches, setActiveBatches] = useState<ParallelBatch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<Record<string, ParallelProgress>>({})
  const [batchTasks, setBatchTasks] = useState<Record<string, ParallelTask[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh for active batches
  useEffect(() => {
    const interval = setInterval(() => {
      refreshActiveBatches()
    }, 2000) // Update every 2 seconds

    return () => clearInterval(interval)
  }, [])

  const refreshActiveBatches = async () => {
    // This would typically fetch from a service that tracks active batches
    // For now, we'll simulate with localStorage or state management
  }

  const createParallelBatch = async (phase: number, userPrompt: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/parallel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_and_execute',
          sessionId,
          phase,
          userPrompt,
          config: {
            maxConcurrentTasks: 3,
            timeoutMs: 300000,
            retryAttempts: 2,
            enableLoadBalancing: true,
            priorityBased: true
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add to active batches and start monitoring
        await getBatchStatus(data.batch.id)
      } else {
        setError(data.error || 'Failed to create parallel batch')
      }
    } catch (err) {
      setError('Network error while creating batch')
      console.error('Error creating parallel batch:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getBatchStatus = async (batchId: string) => {
    try {
      const response = await fetch(`/api/parallel?action=status&batchId=${batchId}`)
      const data = await response.json()

      if (data.success) {
        // Update batch status
        setActiveBatches(prev => {
          const existing = prev.find(b => b.id === batchId)
          if (existing) {
            return prev.map(b => b.id === batchId ? data.batch : b)
          } else {
            return [...prev, data.batch]
          }
        })

        setBatchProgress(prev => ({
          ...prev,
          [batchId]: data.progress
        }))

        // Get task details
        await getBatchTasks(batchId)
      }
    } catch (err) {
      console.error('Error getting batch status:', err)
    }
  }

  const getBatchTasks = async (batchId: string) => {
    try {
      const response = await fetch(`/api/parallel?action=task_details&batchId=${batchId}`)
      const data = await response.json()

      if (data.success) {
        setBatchTasks(prev => ({
          ...prev,
          [batchId]: data.tasks
        }))
      }
    } catch (err) {
      console.error('Error getting batch tasks:', err)
    }
  }

  const cancelBatch = async (batchId: string) => {
    try {
      const response = await fetch(`/api/parallel?batchId=${batchId}&action=cancel`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await getBatchStatus(batchId)
      } else {
        setError(data.error || 'Failed to cancel batch')
      }
    } catch (err) {
      setError('Network error while cancelling batch')
      console.error('Error cancelling batch:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      running: 'default',
      completed: 'success',
      failed: 'destructive'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Parallel Processing Monitor</h2>
          <p className="text-muted-foreground">Monitor and manage concurrent subagent execution</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => createParallelBatch(4, 'Continue development')}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start Parallel Execution
          </Button>
          <Button
            onClick={refreshActiveBatches}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="batches" className="w-full">
        <TabsList>
          <TabsTrigger value="batches">Active Batches</TabsTrigger>
          <TabsTrigger value="tasks">Task Details</TabsTrigger>
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-4">
          {activeBatches.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Batches</h3>
                <p className="text-muted-foreground mb-4">
                  No parallel processing batches are currently running.
                </p>
                <Button onClick={() => createParallelBatch(4, 'Start parallel processing')}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Parallel Batch
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeBatches.map(batch => (
                <Card 
                  key={batch.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedBatch === batch.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedBatch(batch.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(batch.status)}
                        <CardTitle className="text-lg">
                          Phase {batch.phase} Batch
                        </CardTitle>
                        {getStatusBadge(batch.status)}
                      </div>
                      <div className="flex gap-2">
                        {batch.status === 'running' && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelBatch(batch.id)
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            getBatchStatus(batch.id)
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress:</span>
                        <span>
                          {batchProgress[batch.id]?.completed || 0} / {batch.taskCount} tasks
                        </span>
                      </div>
                      <Progress 
                        value={batchProgress[batch.id]?.completion_percentage || 0} 
                        className="w-full"
                      />
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">
                            {batchProgress[batch.id]?.running || 0}
                          </div>
                          <div className="text-muted-foreground">Running</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600">
                            {batchProgress[batch.id]?.completed || 0}
                          </div>
                          <div className="text-muted-foreground">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">
                            {batchProgress[batch.id]?.failed || 0}
                          </div>
                          <div className="text-muted-foreground">Failed</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">
                            {batch.taskCount}
                          </div>
                          <div className="text-muted-foreground">Total</div>
                        </div>
                      </div>
                      {batch.startTime && (
                        <div className="text-xs text-muted-foreground">
                          Started: {new Date(batch.startTime).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {selectedBatch && batchTasks[selectedBatch] ? (
            <Card>
              <CardHeader>
                <CardTitle>Task Details - {selectedBatch}</CardTitle>
                <CardDescription>
                  Individual task status and execution details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {batchTasks[selectedBatch].map(task => (
                      <div 
                        key={task.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(task.status)}
                          <div>
                            <div className="font-medium">{task.agentName}</div>
                            <div className="text-sm text-muted-foreground">
                              {task.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={getPriorityColor(task.priority)}
                          >
                            {task.priority}
                          </Badge>
                          {getStatusBadge(task.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Batch Selected</h3>
                <p className="text-muted-foreground">
                  Select a batch from the Active Batches tab to view task details.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Active Batches
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeBatches.length}</div>
                <p className="text-xs text-muted-foreground">
                  Currently running batches
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Completion Rate
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeBatches.length > 0 
                    ? Math.round(
                        Object.values(batchProgress).reduce(
                          (sum, progress) => sum + progress.completion_percentage, 0
                        ) / Object.values(batchProgress).length
                      )
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all active batches
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tasks
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeBatches.reduce((sum, batch) => sum + batch.taskCount, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all batches
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parallel Processing Configuration</CardTitle>
              <CardDescription>
                Configure concurrency settings and execution parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Concurrent Tasks</label>
                  <p className="text-xs text-muted-foreground">
                    Maximum number of tasks that can run simultaneously
                  </p>
                  <div className="text-lg font-semibold">3</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Task Timeout</label>
                  <p className="text-xs text-muted-foreground">
                    Maximum execution time per task
                  </p>
                  <div className="text-lg font-semibold">5 minutes</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Retry Attempts</label>
                  <p className="text-xs text-muted-foreground">
                    Number of retry attempts for failed tasks
                  </p>
                  <div className="text-lg font-semibold">2</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority-Based Execution</label>
                  <p className="text-xs text-muted-foreground">
                    Execute high-priority tasks first
                  </p>
                  <div className="text-lg font-semibold text-green-600">Enabled</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ParallelMonitor