'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  GitBranch, 
  Target, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Loader2,
  ArrowRight,
  BarChart3,
  Network,
  Lightbulb,
  Timer,
  Flag
} from 'lucide-react'

interface DependencyAnalysisViewProps {
  sessionId: string
}

interface DependencyAnalysis {
  dependency_graph: any[]
  critical_path: {
    tasks: any[]
    total_duration: number
    total_days: number
    bottlenecks: any[]
    risk_factors: any[]
  }
  parallel_tracks: any[]
  cycle_detection: {
    has_cycles: boolean
    cycles?: string[][]
  }
  optimization_suggestions: any[]
}

export function DependencyAnalyzerView({ sessionId }: DependencyAnalysisViewProps) {
  const [analysis, setAnalysis] = useState<DependencyAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalysis()
  }, [sessionId])

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dependencies/${sessionId}?action=analysis`)
      const data = await response.json()
      
      if (response.ok) {
        setAnalysis(data.analysis)
      } else {
        setError(data.error || 'Failed to fetch dependency analysis')
      }
    } catch (err) {
      setError('Network error while fetching analysis')
      console.error('Failed to fetch dependency analysis:', err)
    } finally {
      setLoading(false)
    }
  }

  const triggerReanalysis = async () => {
    setReanalyzing(true)
    try {
      const response = await fetch(`/api/dependencies/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reanalyze' })
      })
      
      const data = await response.json()
      if (response.ok) {
        await fetchAnalysis() // Refresh the analysis
      } else {
        setError(data.error || 'Failed to reanalyze dependencies')
      }
    } catch (err) {
      setError('Network error during reanalysis')
      console.error('Failed to reanalyze dependencies:', err)
    } finally {
      setReanalyzing(false)
    }
  }

  const formatHours = (hours: number) => {
    if (hours < 8) return `${hours}h`
    const days = Math.floor(hours / 8)
    const remainingHours = hours % 8
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'secondary'
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600'
      case 'medium': return 'text-orange-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Analyzing task dependencies...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={fetchAnalysis} 
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Dependency Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Tasks to Analyze</h3>
            <p className="text-muted-foreground mb-4">
              Create some development tasks to see dependency analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Duration</p>
                <p className="text-2xl font-bold">{formatHours(analysis.critical_path.total_duration)}</p>
              </div>
              <Timer className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Tasks</p>
                <p className="text-2xl font-bold">{analysis.critical_path.tasks.length}</p>
              </div>
              <Flag className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Parallel Tracks</p>
                <p className="text-2xl font-bold">{analysis.parallel_tracks.length}</p>
              </div>
              <GitBranch className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bottlenecks</p>
                <p className="text-2xl font-bold">{analysis.critical_path.bottlenecks.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Dependency Analysis Results
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Critical path analysis and optimization suggestions
              </p>
            </div>
            <Button
              onClick={triggerReanalysis}
              disabled={reanalyzing}
              variant="outline"
            >
              {reanalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {reanalyzing ? 'Reanalyzing...' : 'Reanalyze'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="critical_path">Critical Path</TabsTrigger>
          <TabsTrigger value="parallel_tracks">Parallel Tracks</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Timeline Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Critical Path Progress</span>
                    <span>{analysis.critical_path.total_days} days</span>
                  </div>
                  <Progress value={0} className="w-full" />
                </div>

                {analysis.critical_path.risk_factors.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{analysis.critical_path.risk_factors.length} risk factors identified</strong>
                      <ul className="mt-2 space-y-1">
                        {analysis.critical_path.risk_factors.slice(0, 3).map((risk, index) => (
                          <li key={index} className="text-sm">
                            • {risk.description} (Impact: {formatHours(risk.impact_hours)})
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Efficiency Metrics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Tasks:</span>
                        <span>{analysis.dependency_graph.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tasks on Critical Path:</span>
                        <span>{analysis.critical_path.tasks.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Parallelization Opportunity:</span>
                        <span>{Math.round((1 - analysis.critical_path.tasks.length / analysis.dependency_graph.length) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Risk Assessment</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>High Risk Tasks:</span>
                        <span className="text-red-600">
                          {analysis.dependency_graph.filter(t => t.metadata.risk_level === 'high').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bottlenecks:</span>
                        <span className="text-orange-600">{analysis.critical_path.bottlenecks.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Optimization Opportunities:</span>
                        <span className="text-green-600">{analysis.optimization_suggestions.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical_path" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-red-500" />
                Critical Path Tasks
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                These tasks determine the minimum project duration
              </p>
            </CardHeader>
            <CardContent>
              {analysis.critical_path.tasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Critical Path</h3>
                  <p className="text-muted-foreground">
                    All tasks can be completed independently.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.critical_path.tasks.map((task, index) => (
                    <div key={task.task_id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        {index < analysis.critical_path.tasks.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{task.title}</span>
                          <Badge variant={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Duration: {formatHours(task.estimated_hours)}</span>
                          <span>Slack: {formatHours(task.metadata.slack || 0)}</span>
                          {task.dependents.length > 0 && (
                            <span>Blocks {task.dependents.length} tasks</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parallel_tracks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-green-500" />
                Parallel Execution Tracks
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Tasks that can be worked on simultaneously
              </p>
            </CardHeader>
            <CardContent>
              {analysis.parallel_tracks.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Tasks Sequential</h3>
                  <p className="text-muted-foreground">
                    No parallel execution opportunities found.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analysis.parallel_tracks.map((track, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{track.track_name}</h4>
                          <Badge variant="outline">
                            {formatHours(track.duration_hours)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {track.tasks.length} tasks can run in parallel
                        </div>
                        <Progress 
                          value={(track.duration_hours / analysis.critical_path.total_duration) * 100} 
                          className="mt-2"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Project Bottlenecks
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Tasks that may cause delays or block other work
              </p>
            </CardHeader>
            <CardContent>
              {analysis.critical_path.bottlenecks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Bottlenecks Detected</h3>
                  <p className="text-muted-foreground">
                    Project has good parallelization and balanced workload.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.critical_path.bottlenecks.map((bottleneck, index) => {
                    const task = analysis.dependency_graph.find(t => t.task_id === bottleneck.task_id)
                    return (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <div>
                              <strong>{task?.title || 'Unknown Task'}</strong>
                              <p className="text-sm mt-1">{bottleneck.reason}</p>
                            </div>
                            <Badge variant="destructive">
                              +{formatHours(bottleneck.impact_hours)} risk
                            </Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-blue-500" />
                Optimization Suggestions
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Recommendations to improve project timeline and efficiency
              </p>
            </CardHeader>
            <CardContent>
              {analysis.optimization_suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Well Optimized</h3>
                  <p className="text-muted-foreground">
                    No obvious optimization opportunities found.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {analysis.optimization_suggestions.map((suggestion, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="capitalize">
                            {suggestion.type.replace('_', ' ')}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              -{formatHours(suggestion.expected_time_savings)}
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(suggestion.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm">
                          <strong>Tasks affected:</strong> {suggestion.tasks.length}
                        </div>
                        <Progress 
                          value={suggestion.confidence * 100} 
                          className="mt-2 h-2"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}