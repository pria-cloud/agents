'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Play, 
  Pause, 
  Target,
  Calendar,
  Users,
  Filter,
  BarChart3,
  GitBranch,
  Zap,
  Network
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DependencyAnalyzerView } from '@/components/planning/dependency-analyzer-view'
import { SprintPlannerView } from '@/components/planning/sprint-planner-view'

interface DevelopmentTask {
  id: string
  title: string
  description: string
  type: 'database' | 'api' | 'component' | 'integration' | 'testing' | 'deployment' | 'documentation'
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'skipped'
  estimated_hours: number
  actual_hours?: number
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'
  dependencies: string[]
  sprint?: number
  milestone?: string
  assignee?: string
  tags: string[]
  acceptance_criteria: string[]
  technical_notes?: string
  metadata: {
    extraction_confidence?: number
    workflow_phase?: number
    pria_compliance_required?: boolean
    critical_path?: boolean
    risk_level?: 'low' | 'medium' | 'high'
  }
  created_at: string
  updated_at: string
  completed_at?: string
}

interface Sprint {
  id: string
  sprint_number: number
  name: string
  description: string
  start_date?: string
  end_date?: string
  capacity_hours: number
  allocated_hours: number
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  goals: string[]
  tasks: string[]
  metadata: {
    velocity?: number
    burn_down_data?: Record<string, number>
  }
  created_at: string
  updated_at: string
}

interface Milestone {
  id: string
  name: string
  description: string
  target_date?: string
  actual_date?: string
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
  deliverables: string[]
  dependencies: string[]
  tasks: string[]
  quality_gates: string[]
  metadata: {
    business_value?: string
    risk_assessment?: string
  }
  created_at: string
  updated_at: string
}

interface TasksViewProps {
  sessionId: string
}

export function TasksView({ sessionId }: TasksViewProps) {
  const [tasks, setTasks] = useState<DevelopmentTask[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [sessionId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/${sessionId}?type=all`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }
      
      const data = await response.json()
      setTasks(data.tasks || [])
      setSprints(data.sprints || [])
      setMilestones(data.milestones || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch tasks data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${sessionId}/${taskId}?type=task`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        throw new Error('Failed to update task')
      }

      // Refresh data
      await fetchData()
    } catch (err) {
      console.error('Failed to update task:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'in_progress': return <Play className="h-4 w-4 text-blue-500" />
      case 'blocked': return <Pause className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'epic': return 'bg-purple-100 text-purple-800'
      case 'complex': return 'bg-red-100 text-red-800'
      case 'moderate': return 'bg-yellow-100 text-yellow-800'
      case 'simple': return 'bg-blue-100 text-blue-800'
      case 'trivial': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false
    if (filterType !== 'all' && task.type !== filterType) return false
    return true
  })

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    criticalPath: tasks.filter(t => t.metadata.critical_path).length,
    highRisk: tasks.filter(t => t.metadata.risk_level === 'high').length,
    totalHours: tasks.reduce((sum, t) => sum + t.estimated_hours, 0),
    completedHours: tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.estimated_hours, 0)
  }

  const completionPercentage = taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Tasks</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchData}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{taskStats.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion</p>
                <p className="text-2xl font-bold">{completionPercentage.toFixed(0)}%</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
            <Progress value={completionPercentage} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Path</p>
                <p className="text-2xl font-bold">{taskStats.criticalPath}</p>
              </div>
              <GitBranch className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk</p>
                <p className="text-2xl font-bold">{taskStats.highRisk}</p>
              </div>
              <Zap className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="planning" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Sprint Planning
          </TabsTrigger>
          <TabsTrigger value="sprints">Sprints ({sprints.length})</TabsTrigger>
          <TabsTrigger value="milestones">Milestones ({milestones.length})</TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Dependencies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center">
                <Filter className="h-4 w-4 text-gray-500" />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="component">Component</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                    <SelectItem value="deployment">Deployment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
                <p className="text-gray-600">
                  {tasks.length === 0 
                    ? "Start a conversation with Claude to generate implementation tasks."
                    : "No tasks match your current filters."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <Card key={task.id} className={cn(
                  "transition-all hover:shadow-md",
                  task.metadata.critical_path && "border-l-4 border-l-purple-500",
                  task.status === 'completed' && "opacity-75"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(task.status)}
                          <h3 className="font-semibold">{task.title}</h3>
                          {task.metadata.critical_path && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                              Critical Path
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3">{task.description}</p>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getComplexityColor(task.complexity)}>
                            {task.complexity}
                          </Badge>
                          <Badge variant="outline">
                            {task.type}
                          </Badge>
                          {task.metadata.risk_level === 'high' && (
                            <Badge variant="destructive">High Risk</Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.estimated_hours}h estimated
                          </span>
                          {task.sprint && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Sprint {task.sprint}
                            </span>
                          )}
                          {task.dependencies.length > 0 && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {task.dependencies.length} dependencies
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="ml-4">
                        <Select 
                          value={task.status} 
                          onValueChange={(value) => updateTaskStatus(task.id, value)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <SprintPlannerView sessionId={sessionId} />
        </TabsContent>

        <TabsContent value="sprints" className="space-y-4">
          {sprints.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Sprints Planned</h3>
                <p className="text-gray-600">
                  Sprint planning will be generated automatically during implementation planning.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sprints.map((sprint) => (
                <Card key={sprint.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {sprint.name}
                      </CardTitle>
                      <Badge 
                        variant={sprint.status === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          sprint.status === 'completed' && 'bg-green-100 text-green-800',
                          sprint.status === 'active' && 'bg-blue-100 text-blue-800'
                        )}
                      >
                        {sprint.status}
                      </Badge>
                    </div>
                    <CardDescription>{sprint.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm font-medium">Capacity</p>
                        <p className="text-lg">{sprint.capacity_hours}h</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Allocated</p>
                        <p className="text-lg">{sprint.allocated_hours}h</p>
                      </div>
                    </div>
                    
                    {sprint.goals.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Goals</h4>
                        <ul className="space-y-1">
                          {sprint.goals.map((goal, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              {goal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          {milestones.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Milestones Defined</h3>
                <p className="text-gray-600">
                  Milestones will be created during implementation planning phase.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {milestones.map((milestone) => (
                <Card key={milestone.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        {milestone.name}
                      </CardTitle>
                      <Badge 
                        variant={milestone.status === 'completed' ? 'default' : 'secondary'}
                        className={cn(
                          milestone.status === 'completed' && 'bg-green-100 text-green-800',
                          milestone.status === 'in_progress' && 'bg-blue-100 text-blue-800',
                          milestone.status === 'delayed' && 'bg-red-100 text-red-800'
                        )}
                      >
                        {milestone.status}
                      </Badge>
                    </div>
                    <CardDescription>{milestone.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {milestone.deliverables.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Deliverables</h4>
                        <ul className="space-y-1">
                          {milestone.deliverables.map((deliverable, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 mt-1 text-green-500" />
                              {deliverable}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {milestone.quality_gates.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Quality Gates</h4>
                        <ul className="space-y-1">
                          {milestone.quality_gates.map((gate, index) => (
                            <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-yellow-500 mt-1">⚡</span>
                              {gate}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <DependencyAnalyzerView sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}