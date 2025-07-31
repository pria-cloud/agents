'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertTriangle,
  Code2,
  RefreshCw,
  ListTodo,
  FileCode,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeTodo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  id: string
}

interface TargetAppTasksProps {
  sessionId?: string
  className?: string
}

const STATUS_CONFIG = {
  pending: { 
    icon: Circle, 
    label: 'Pending', 
    color: 'text-muted-foreground',
    bgColor: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  },
  in_progress: { 
    icon: Clock, 
    label: 'In Progress', 
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
  },
  completed: { 
    icon: CheckCircle2, 
    label: 'Completed', 
    color: 'text-green-600',
    bgColor: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
  }
}

const PRIORITY_CONFIG = {
  high: { 
    label: 'High', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    icon: AlertTriangle
  },
  medium: { 
    label: 'Medium', 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    icon: Clock
  },
  low: { 
    label: 'Low', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    icon: Circle
  }
}

function TodoCard({ todo }: { todo: ClaudeTodo }) {
  const StatusIcon = STATUS_CONFIG[todo.status].icon
  const PriorityIcon = PRIORITY_CONFIG[todo.priority].icon
  
  return (
    <Card className="mb-3 hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 mt-0.5",
            todo.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' :
            todo.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/20' :
            'bg-gray-100 dark:bg-gray-900/20'
          )}>
            <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[todo.status].color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm leading-relaxed",
              todo.status === 'completed' && "line-through text-muted-foreground"
            )}>
              {todo.content}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-xs", STATUS_CONFIG[todo.status].bgColor)}>
                {STATUS_CONFIG[todo.status].label}
              </Badge>
              
              <Badge variant="outline" className={cn("text-xs", PRIORITY_CONFIG[todo.priority].color)}>
                <PriorityIcon className="h-3 w-3 mr-1" />
                {PRIORITY_CONFIG[todo.priority].label}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TasksSummary({ todos }: { todos: ClaudeTodo[] }) {
  const summary = todos.reduce((acc, todo) => {
    acc[todo.status] = (acc[todo.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const completionPercentage = todos.length > 0 
    ? Math.round(((summary.completed || 0) / todos.length) * 100)
    : 0

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="text-center p-3 rounded-lg bg-muted/30">
        <div className="text-lg font-semibold text-muted-foreground">
          {summary.pending || 0}
        </div>
        <div className="text-xs text-muted-foreground">Pending</div>
      </div>
      
      <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <div className="text-lg font-semibold text-blue-600">
          {summary.in_progress || 0}
        </div>
        <div className="text-xs text-muted-foreground">In Progress</div>
      </div>
      
      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
        <div className="text-lg font-semibold text-green-600">
          {summary.completed || 0}
        </div>
        <div className="text-xs text-muted-foreground">Completed</div>
      </div>
    </div>
  )
}

export function TargetAppTasks({ sessionId, className }: TargetAppTasksProps) {
  const [todos, setTodos] = useState<ClaudeTodo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string>('')

  const loadTodos = async () => {
    if (!sessionId) return
    
    try {
      setIsLoading(true)
      setError('')
      
      // Call the Target App via E2B to get Claude's current todo list
      const response = await fetch(`/api/claude/project?sessionId=${sessionId}&action=get_todos`)
      
      if (response.ok) {
        const data = await response.json()
        setTodos(data.todos || [])
        setLastUpdated(new Date())
      } else {
        throw new Error('Failed to fetch todos from Target App')
      }
    } catch (error) {
      console.error('Failed to load Target App todos:', error)
      setError(error instanceof Error ? error.message : 'Failed to load tasks')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    loadTodos()
  }

  // Auto-load on mount and when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadTodos()
    } else {
      setTodos([])
      setLastUpdated(null)
      setError('')
    }
  }, [sessionId])

  // Auto-refresh every 30 seconds when session is active
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(() => {
      loadTodos()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Target App Active</h3>
          <p className="text-muted-foreground">
            Start a conversation to initialize the Target App and see Claude's development tasks.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            <div>
              <h3 className="text-lg font-semibold">Target App Tasks</h3>
              <p className="text-sm text-muted-foreground">
                Claude Code's development todo list
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary */}
        {todos.length > 0 && <TasksSummary todos={todos} />}
      </div>

      {/* Tasks List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading && todos.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading Claude's tasks...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-semibold mb-2">Unable to Load Tasks</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Tasks Yet</h3>
              <p className="text-muted-foreground mb-4">
                Claude hasn't created any development tasks yet. Start a conversation to begin planning.
              </p>
              <Button variant="outline" onClick={handleRefresh}>
                <Zap className="h-4 w-4 mr-2" />
                Check for Tasks
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Development Tasks ({todos.length})
                </h4>
                <Badge variant="outline" className="text-xs">
                  <FileCode className="h-3 w-3 mr-1" />
                  Live from Target App
                </Badge>
              </div>
              
              {todos.map((todo, index) => (
                <TodoCard key={todo.id || index} todo={todo} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}