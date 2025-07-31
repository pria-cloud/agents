'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRight,
  Target,
  FileText,
  Code,
  TestTube,
  Shield,
  Rocket,
  Lightbulb,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkflowPhase {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7
  name: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'skipped'
  startedAt?: Date
  completedAt?: Date
  progress: number
  artifacts: any[]
  quality_gate_passed: boolean
}

interface WorkflowState {
  sessionId: string
  currentPhase: number
  overallProgress: number
  phases: WorkflowPhase[]
  metadata: {
    projectName?: string
    projectType?: string
    targetTechnology?: string
    estimatedDuration?: number
  }
}

interface WorkflowProgressProps {
  sessionId?: string
  workflowState?: WorkflowState | null
  onAdvancePhase?: () => void
  onRefresh?: () => void
  className?: string
}

const PHASE_ICONS = {
  1: Target,
  2: Settings, 
  3: Lightbulb,
  4: Code,
  5: TestTube,
  6: Shield,
  7: Rocket
} as const

const PHASE_COLORS = {
  pending: 'text-muted-foreground bg-muted/20',
  active: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400',
  completed: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400',
  skipped: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400'
}

function PhaseCard({ 
  phase, 
  isActive, 
  onAdvance 
}: { 
  phase: WorkflowPhase
  isActive: boolean
  onAdvance?: () => void 
}) {
  const Icon = PHASE_ICONS[phase.number]
  const isCompleted = phase.status === 'completed'
  const canAdvance = isActive && phase.progress >= 80 && phase.quality_gate_passed

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      isActive && "ring-2 ring-blue-500 ring-opacity-50",
      isCompleted && "bg-green-50/50 dark:bg-green-900/10"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              PHASE_COLORS[phase.status]
            )}>
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : isActive ? (
                <Clock className="h-5 w-5" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
            </div>
            
            <div>
              <CardTitle className="text-sm font-medium">
                Phase {phase.number}: {phase.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {phase.description}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge variant={
              phase.status === 'completed' ? 'default' :
              phase.status === 'active' ? 'secondary' : 'outline'
            }>
              {phase.status === 'active' ? 'In Progress' :
               phase.status === 'completed' ? 'Completed' :
               phase.status === 'pending' ? 'Pending' : 'Skipped'}
            </Badge>
            
            {isActive && canAdvance && (
              <Button
                size="sm"
                onClick={onAdvance}
                className="h-6 px-2 text-xs"
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                Advance
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{phase.progress}%</span>
            </div>
            <Progress value={phase.progress} className="h-2" />
          </div>
          
          {/* Phase Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Artifacts:</span>
              <span className="font-medium">{phase.artifacts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quality Gate:</span>
              <span className={cn(
                "font-medium",
                phase.quality_gate_passed ? "text-green-600" : "text-orange-600"
              )}>
                {phase.quality_gate_passed ? "Passed" : "Pending"}
              </span>
            </div>
          </div>
          
          {/* Timestamps */}
          {(phase.startedAt || phase.completedAt) && (
            <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
              {phase.startedAt && (
                <div>Started: {new Date(phase.startedAt).toLocaleDateString()}</div>
              )}
              {phase.completedAt && (
                <div>Completed: {new Date(phase.completedAt).toLocaleDateString()}</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function WorkflowOverview({ workflowState }: { workflowState: WorkflowState }) {
  const completedPhases = workflowState.phases.filter(p => p.status === 'completed').length
  const currentPhase = workflowState.phases.find(p => p.number === workflowState.currentPhase)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Project Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{workflowState.overallProgress}%</span>
          </div>
          <Progress value={workflowState.overallProgress} className="h-3" />
        </div>
        
        {/* Project Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Project Name:</span>
            <div className="font-medium">{workflowState.metadata.projectName || 'Unnamed Project'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Technology:</span>
            <div className="font-medium">{workflowState.metadata.targetTechnology || 'Next.js + Supabase'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Phases Completed:</span>
            <div className="font-medium">{completedPhases} / 7</div>
          </div>
          <div>
            <span className="text-muted-foreground">Current Phase:</span>
            <div className="font-medium">{currentPhase?.name || 'Unknown'}</div>
          </div>
        </div>
        
        {/* Estimated Duration */}
        {workflowState.metadata.estimatedDuration && (
          <div className="pt-2 border-t border-border">
            <div className="text-sm">
              <span className="text-muted-foreground">Estimated Duration:</span>
              <span className="font-medium ml-2">{workflowState.metadata.estimatedDuration} hours</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function WorkflowProgress({ 
  sessionId, 
  workflowState, 
  onAdvancePhase, 
  onRefresh,
  className 
}: WorkflowProgressProps) {
  const [localWorkflowState, setLocalWorkflowState] = useState<WorkflowState | null>(workflowState || null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (workflowState) {
      setLocalWorkflowState(workflowState)
    }
  }, [workflowState])

  const loadWorkflowState = async () => {
    if (!sessionId) return
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/workflow/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setLocalWorkflowState(data.workflowState)
      }
    } catch (error) {
      console.error('Failed to load workflow state:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdvancePhase = async () => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/workflow/${sessionId}/advance`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadWorkflowState()
        onAdvancePhase?.()
      }
    } catch (error) {
      console.error('Failed to advance phase:', error)
    }
  }

  const handleRefresh = async () => {
    await loadWorkflowState()
    onRefresh?.()
  }

  // Auto-load workflow state if not provided
  useEffect(() => {
    if (!workflowState && sessionId) {
      loadWorkflowState()
    }
  }, [sessionId, workflowState])

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Session Active</h3>
          <p className="text-muted-foreground">
            Start a conversation to begin the development workflow.
          </p>
        </Card>
      </div>
    )
  }

  if (isLoading || !localWorkflowState) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Development Workflow</h3>
            <p className="text-sm text-muted-foreground">
              7-phase structured development process
            </p>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <FileText className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Workflow Overview */}
        <WorkflowOverview workflowState={localWorkflowState} />
      </div>

      {/* Phases List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {localWorkflowState.phases.map((phase) => (
            <PhaseCard
              key={phase.number}
              phase={phase}
              isActive={phase.number === localWorkflowState.currentPhase}
              onAdvance={phase.number === localWorkflowState.currentPhase ? handleAdvancePhase : undefined}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}