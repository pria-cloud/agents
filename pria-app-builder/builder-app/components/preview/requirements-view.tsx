'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Filter,
  Search
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Requirement } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface RequirementsViewProps {
  sessionId?: string
  requirements: Requirement[]
  onAddRequirement?: () => void
  onEditRequirement?: (requirement: Requirement) => void
  onDeleteRequirement?: (requirementId: string) => void
  onUpdateStatus?: (requirementId: string, status: Requirement['status']) => void
  className?: string
}

type FilterStatus = 'all' | 'pending' | 'in-progress' | 'completed' | 'blocked'
type FilterPriority = 'all' | 'high' | 'medium' | 'low'

const STATUS_CONFIG = {
  pending: { icon: Circle, label: 'Pending', color: 'text-muted-foreground' },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-blue-600' },
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-green-600' },
  blocked: { icon: AlertTriangle, label: 'Blocked', color: 'text-red-600' }
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
  low: { label: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' }
}

const TYPE_CONFIG = {
  functional: { label: 'Functional', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
  'non-functional': { label: 'Non-Functional', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
  'ui-ux': { label: 'UI/UX', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400' },
  technical: { label: 'Technical', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
  business: { label: 'Business', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400' }
}

interface RequirementCardProps {
  requirement: Requirement
  onEdit?: () => void
  onDelete?: () => void
  onUpdateStatus?: (status: Requirement['status']) => void
}

function RequirementCard({ requirement, onEdit, onDelete, onUpdateStatus }: RequirementCardProps) {
  const StatusIcon = STATUS_CONFIG[requirement.status].icon
  
  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[requirement.status].color)} />
              <CardTitle className="text-base">{requirement.title}</CardTitle>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                PRIORITY_CONFIG[requirement.priority].color
              )}>
                {PRIORITY_CONFIG[requirement.priority].label}
              </span>
              
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                TYPE_CONFIG[requirement.type].color
              )}>
                {TYPE_CONFIG[requirement.type].label}
              </span>
              
              {requirement.estimated_effort && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  {requirement.estimated_effort}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              title="Edit requirement"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              title="Delete requirement"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
          {requirement.description}
        </p>
        
        {requirement.acceptance_criteria.length > 0 && (
          <div className="mb-3">
            <h5 className="text-xs font-semibold text-muted-foreground mb-2">
              Acceptance Criteria:
            </h5>
            <ul className="text-xs space-y-1">
              {requirement.acceptance_criteria.map((criteria, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{criteria}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {requirement.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {requirement.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {new Date(requirement.created_at).toLocaleDateString()}
          </span>
          
          <div className="flex items-center gap-1">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <Button
                key={status}
                variant={requirement.status === status ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onUpdateStatus?.(status as Requirement['status'])}
                title={`Mark as ${config.label}`}
              >
                <config.icon className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RequirementsView({
  sessionId,
  requirements,
  onAddRequirement,
  onEditRequirement,
  onDeleteRequirement,
  onUpdateStatus,
  className
}: RequirementsViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<FilterPriority>('all')

  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const getStatusCounts = () => {
    return requirements.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  const statusCounts = getStatusCounts()

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Session Active</h3>
          <p className="text-muted-foreground">
            Start a conversation to begin gathering requirements.
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
          <div>
            <h3 className="text-lg font-semibold">Requirements</h3>
            <p className="text-sm text-muted-foreground">
              {requirements.length} total requirements
            </p>
          </div>
          
          <Button onClick={onAddRequirement} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Requirement
          </Button>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <div
              key={status}
              className="text-center p-2 rounded-lg bg-muted/30"
            >
              <div className={cn("font-semibold", config.color)}>
                {statusCounts[status] || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {config.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search requirements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>
                {config.label}
              </option>
            ))}
          </select>
          
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as FilterPriority)}
            className="h-8 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">All Priority</option>
            {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
              <option key={priority} value={priority}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requirements List */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredRequirements.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {requirements.length === 0 ? 'No Requirements Yet' : 'No Matching Requirements'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {requirements.length === 0
                  ? 'Start a conversation with Claude Code to gather requirements automatically.'
                  : 'Try adjusting your search or filter criteria.'
                }
              </p>
              {requirements.length === 0 && (
                <Button onClick={onAddRequirement}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Requirement
                </Button>
              )}
            </div>
          ) : (
            <div>
              {filteredRequirements.map((requirement) => (
                <RequirementCard
                  key={requirement.id}
                  requirement={requirement}
                  onEdit={() => onEditRequirement?.(requirement)}
                  onDelete={() => onDeleteRequirement?.(requirement.id)}
                  onUpdateStatus={(status) => onUpdateStatus?.(requirement.id, status)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}