'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  Calendar,
  Users, 
  Clock, 
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Loader2,
  PlayCircle,
  PauseCircle,
  Settings,
  BarChart3,
  Flag,
  Zap,
  ArrowRight,
  Plus
} from 'lucide-react'

interface SprintPlannerViewProps {
  sessionId: string
}

interface SprintPlan {
  sprints: any[]
  milestones: any[]
  total_duration_weeks: number
  release_timeline: any[]
  capacity_analysis: {
    total_team_hours: number
    planned_work_hours: number
    buffer_hours: number
    utilization_percentage: number
    overallocation_risk: 'low' | 'medium' | 'high'
  }
  recommendations: any[]
}

interface ProjectSettings {
  team_size: number
  sprint_length_weeks: number
  hours_per_week_per_person: number
  start_date: string
  velocity_factor: number
}

export function SprintPlannerView({ sessionId }: SprintPlannerViewProps) {
  const [plan, setPlan] = useState<SprintPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ProjectSettings>({
    team_size: 3,
    sprint_length_weeks: 2,
    hours_per_week_per_person: 40,
    start_date: new Date().toISOString().split('T')[0],
    velocity_factor: 0.8
  })

  useEffect(() => {
    fetchSprintPlan()
  }, [sessionId])

  const fetchSprintPlan = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/sprints/${sessionId}?action=plan`)
      const data = await response.json()
      
      if (response.ok) {
        setPlan(data.plan)
      } else {
        setError(data.error || 'Failed to fetch sprint plan')
      }
    } catch (err) {
      setError('Network error while fetching sprint plan')
      console.error('Failed to fetch sprint plan:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateSprintPlan = async () => {
    setGenerating(true)
    try {
      const response = await fetch(`/api/sprints/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_plan',
          constraints: settings
        })
      })
      
      const data = await response.json()
      if (response.ok) {
        setPlan(data.plan)
        setShowSettings(false)
      } else {
        setError(data.error || 'Failed to generate sprint plan')
      }
    } catch (err) {
      setError('Network error during plan generation')
      console.error('Failed to generate sprint plan:', err)
    } finally {
      setGenerating(false)
    }
  }

  const updateProjectSettings = async () => {
    try {
      const response = await fetch(`/api/sprints/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_project_settings',
          settings
        })
      })
      
      if (response.ok) {
        await generateSprintPlan()
      }
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  }

  const formatDuration = (weeks: number) => {
    if (weeks < 4) return `${weeks} weeks`
    const months = Math.floor(weeks / 4)
    const remainingWeeks = weeks % 4
    return remainingWeeks > 0 ? `${months}mo ${remainingWeeks}w` : `${months}mo`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'planning': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading sprint plan...</span>
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
            onClick={fetchSprintPlan} 
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Sprint Planning
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Intelligent sprint planning with capacity management
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="outline"
                size="sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button
                onClick={generateSprintPlan}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {generating ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate Plan'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {showSettings && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label htmlFor="team_size">Team Size</Label>
                <Input
                  id="team_size"
                  type="number"
                  min="1"
                  max="20"
                  value={settings.team_size}
                  onChange={(e) => setSettings(prev => ({ ...prev, team_size: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="sprint_length">Sprint Length (weeks)</Label>
                <Input
                  id="sprint_length"
                  type="number"
                  min="1"
                  max="4"
                  value={settings.sprint_length_weeks}
                  onChange={(e) => setSettings(prev => ({ ...prev, sprint_length_weeks: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="hours_per_week">Hours/Week/Person</Label>
                <Input
                  id="hours_per_week"
                  type="number"
                  min="20"
                  max="60"
                  value={settings.hours_per_week_per_person}
                  onChange={(e) => setSettings(prev => ({ ...prev, hours_per_week_per_person: parseInt(e.target.value) }))}
                />
              </div>
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={settings.start_date}
                  onChange={(e) => setSettings(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="velocity_factor">Velocity Factor</Label>
                <Input
                  id="velocity_factor"
                  type="number"
                  min="0.5"
                  max="1.0"
                  step="0.1"
                  value={settings.velocity_factor}
                  onChange={(e) => setSettings(prev => ({ ...prev, velocity_factor: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={updateProjectSettings} size="sm">
                  Apply Settings
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {!plan ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Sprint Plan Yet</h3>
              <p className="text-muted-foreground mb-4">
                Generate a sprint plan based on your development tasks and dependencies.
              </p>
              <Button onClick={generateSprintPlan}>
                <Zap className="h-4 w-4 mr-2" />
                Generate Sprint Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(plan.total_duration_weeks)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sprints</p>
                    <p className="text-2xl font-bold">{plan.sprints.length}</p>
                  </div>
                  <PlayCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Milestones</p>
                    <p className="text-2xl font-bold">{plan.milestones.length}</p>
                  </div>
                  <Flag className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Utilization</p>
                    <p className="text-2xl font-bold">{plan.capacity_analysis.utilization_percentage}%</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Capacity Analysis */}
          {plan.capacity_analysis.overallocation_risk !== 'low' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Capacity Warning:</strong> Team utilization at {plan.capacity_analysis.utilization_percentage}% 
                indicates {plan.capacity_analysis.overallocation_risk} risk of overallocation. 
                Consider adjusting scope or timeline.
              </AlertDescription>
            </Alert>
          )}

          {/* Recommendations */}
          {plan.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Planning Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plan.recommendations.map((rec, index) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}:</strong> {rec.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Capacity Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle>Capacity Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Team Utilization</span>
                          <span>{plan.capacity_analysis.utilization_percentage}%</span>
                        </div>
                        <Progress value={plan.capacity_analysis.utilization_percentage} className="w-full" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Hours:</span>
                          <span className="ml-2">{plan.capacity_analysis.total_team_hours}h</span>
                        </div>
                        <div>
                          <span className="font-medium">Planned Work:</span>
                          <span className="ml-2">{plan.capacity_analysis.planned_work_hours}h</span>
                        </div>
                        <div>
                          <span className="font-medium">Buffer Hours:</span>
                          <span className="ml-2">{plan.capacity_analysis.buffer_hours}h</span>
                        </div>
                        <div>
                          <span className="font-medium">Risk Level:</span>
                          <Badge 
                            variant={plan.capacity_analysis.overallocation_risk === 'high' ? 'destructive' : 'secondary'}
                            className="ml-2"
                          >
                            {plan.capacity_analysis.overallocation_risk}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Release Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle>Release Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {plan.release_timeline.map((phase, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{phase.phase}</div>
                            <div className="text-sm text-muted-foreground">
                              Sprints {phase.sprint_range[0]}-{phase.sprint_range[1]} • {phase.deliverables.length} deliverables
                            </div>
                          </div>
                          {index < plan.release_timeline.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sprints" className="space-y-4">
              {plan.sprints.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Sprints Planned</h3>
                      <p className="text-muted-foreground">
                        Generate a sprint plan to see sprint breakdown.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.sprints.map((sprint, index) => (
                    <Card key={sprint.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <PlayCircle className="h-5 w-5" />
                            {sprint.name}
                          </CardTitle>
                          <Badge className={getStatusColor(sprint.status)}>
                            {sprint.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Duration:</span>
                              <span className="ml-2">{sprint.start_date} to {sprint.end_date}</span>
                            </div>
                            <div>
                              <span className="font-medium">Tasks:</span>
                              <span className="ml-2">{sprint.tasks.length}</span>
                            </div>
                            <div>
                              <span className="font-medium">Planned Hours:</span>
                              <span className="ml-2">{sprint.velocity.planned_hours}h</span>
                            </div>
                            <div>
                              <span className="font-medium">Capacity:</span>
                              <span className="ml-2">{sprint.capacity.available_hours}h</span>
                            </div>
                          </div>

                          {sprint.goals.length > 0 && (
                            <div>
                              <span className="font-medium text-sm">Goals:</span>
                              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                                {sprint.goals.map((goal: string, goalIndex: number) => (
                                  <li key={goalIndex}>• {goal}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Capacity Utilization</span>
                              <span>{Math.round((sprint.velocity.planned_hours / sprint.capacity.available_hours) * 100)}%</span>
                            </div>
                            <Progress 
                              value={(sprint.velocity.planned_hours / sprint.capacity.available_hours) * 100} 
                              className="w-full"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="milestones" className="space-y-4">
              {plan.milestones.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Milestones Defined</h3>
                      <p className="text-muted-foreground">
                        Milestones will be automatically created based on sprint completion.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {plan.milestones.map((milestone, index) => (
                    <Card key={milestone.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Flag className="h-5 w-5" />
                            {milestone.name}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityColor(milestone.priority)}>
                              {milestone.priority}
                            </Badge>
                            <Badge className={getStatusColor(milestone.status)}>
                              {milestone.status}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">{milestone.description}</p>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium text-sm">Target Date:</span>
                              <p className="text-sm">{milestone.target_date}</p>
                            </div>
                            <div>
                              <span className="font-medium text-sm">Dependent Sprints:</span>
                              <p className="text-sm">{milestone.dependent_sprints.length} sprints</p>
                            </div>
                          </div>

                          {milestone.deliverables.length > 0 && (
                            <div>
                              <span className="font-medium text-sm">Deliverables:</span>
                              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                                {milestone.deliverables.map((deliverable: string, delIndex: number) => (
                                  <li key={delIndex}>• {deliverable}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Progress</span>
                              <span>{milestone.progress_percentage}%</span>
                            </div>
                            <Progress value={milestone.progress_percentage} className="w-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Project Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {plan.release_timeline.map((phase, phaseIndex) => (
                      <div key={phaseIndex} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                            {phaseIndex + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold">{phase.phase}</h3>
                            <p className="text-sm text-muted-foreground">
                              Sprints {phase.sprint_range[0]} - {phase.sprint_range[1]}
                            </p>
                          </div>
                        </div>

                        <div className="ml-13 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <span className="font-medium text-sm">Deliverables:</span>
                              <ul className="text-sm text-muted-foreground mt-1">
                                {phase.deliverables.map((deliverable: string, delIndex: number) => (
                                  <li key={delIndex}>• {deliverable}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="font-medium text-sm">Milestones:</span>
                              <div className="text-sm text-muted-foreground mt-1">
                                {phase.milestone_ids.length} milestone(s)
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-sm">Duration:</span>
                              <div className="text-sm text-muted-foreground mt-1">
                                {(phase.sprint_range[1] - phase.sprint_range[0] + 1) * 2} weeks
                              </div>
                            </div>
                          </div>
                        </div>

                        {phaseIndex < plan.release_timeline.length - 1 && (
                          <Separator className="ml-5" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}