'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CodeView } from './code-view'
import { UIPreview } from './ui-preview'
import { RequirementsView } from './requirements-view'
import { TechnicalSpecsView } from './tech-specs-view'
import { TasksView } from './tasks-view'
import { TargetAppTasks } from '../workflow/target-app-tasks'
import { WorkflowProgress } from '../workflow/workflow-progress'
import { DevelopmentView } from '../development/development-view'
import { TestingView } from '../testing/testing-view'
import { ValidationView } from '../validation/validation-view'
import { ArtifactBrowser } from '../workflow/artifact-browser'
import { TargetAppGitHubSync } from '../github/target-app-github-sync'
import { 
  FileText, 
  Monitor, 
  ListTodo, 
  FileCode2,
  Code2,
  Badge,
  GitBranch,
  CheckSquare,
  Hammer,
  TestTube,
  Shield,
  Tag,
  Github
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Requirement, TechnicalSpec } from '@/lib/types/database'

// Mock file structure type
interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  lastModified?: string
  children?: FileNode[]
  content?: string
}

interface PreviewTabsProps {
  sessionId?: string
  // Data props
  files?: FileNode[]
  requirements?: Requirement[]
  technicalSpecs?: TechnicalSpec[]
  previewUrl?: string
  // GitHub integration props
  workspaceName?: string
  projectName?: string
  sandboxId?: string
  // Event handlers
  onRefreshFiles?: () => void
  onRefreshPreview?: () => void
  // Requirements handlers
  onAddRequirement?: () => void
  onEditRequirement?: (requirement: Requirement) => void
  onDeleteRequirement?: (requirementId: string) => void
  onUpdateRequirementStatus?: (requirementId: string, status: Requirement['status']) => void
  // Technical specs handlers
  onAddTechnicalSpec?: () => void
  onEditTechnicalSpec?: (spec: TechnicalSpec) => void
  onDeleteTechnicalSpec?: (specId: string) => void
  onViewTechnicalSpec?: (spec: TechnicalSpec) => void
  className?: string
}

export function PreviewTabs({
  sessionId,
  files = [],
  requirements = [],
  technicalSpecs = [],
  previewUrl,
  workspaceName = 'workspace',
  projectName = 'project',
  sandboxId,
  onRefreshFiles,
  onRefreshPreview,
  onAddRequirement,
  onEditRequirement,
  onDeleteRequirement,
  onUpdateRequirementStatus,
  onAddTechnicalSpec,
  onEditTechnicalSpec,
  onDeleteTechnicalSpec,
  onViewTechnicalSpec,
  className
}: PreviewTabsProps) {
  const [activeTab, setActiveTab] = useState('code')

  const getTabCounts = () => {
    return {
      files: files.length,
      requirements: requirements.length,
      technicalSpecs: technicalSpecs.length,
      completedRequirements: requirements.filter(r => r.status === 'completed').length,
      pendingRequirements: requirements.filter(r => r.status === 'pending').length
    }
  }

  const counts = getTabCounts()

  const TabBadge = ({ count, variant = 'default' }: { count: number; variant?: 'default' | 'success' | 'warning' }) => {
    if (count === 0) return null
    
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "ml-2 h-5 px-1.5 text-xs",
          variant === 'success' && "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
          variant === 'warning' && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
        )}
      >
        {count}
      </Badge>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <TabsList className="grid w-full grid-cols-12">
            <TabsTrigger value="code" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Code View
              <TabBadge count={counts.files} />
            </TabsTrigger>
            
            <TabsTrigger value="preview" className="flex items-center">
              <Monitor className="h-4 w-4 mr-2" />
              UI Preview
              {previewUrl && (
                <div className="ml-2 h-2 w-2 bg-green-400 rounded-full animate-pulse" title="Live preview available" />
              )}
            </TabsTrigger>
            
            <TabsTrigger value="requirements" className="flex items-center">
              <ListTodo className="h-4 w-4 mr-2" />
              Requirements
              <TabBadge count={counts.requirements} />
              {counts.completedRequirements > 0 && (
                <TabBadge count={counts.completedRequirements} variant="success" />
              )}
            </TabsTrigger>
            
            <TabsTrigger value="workflow" className="flex items-center">
              <GitBranch className="h-4 w-4 mr-2" />
              Workflow
              <div className="ml-2 h-2 w-2 bg-purple-400 rounded-full animate-pulse" title="7-Phase Development Process" />
            </TabsTrigger>
            
            <TabsTrigger value="planning" className="flex items-center">
              <CheckSquare className="h-4 w-4 mr-2" />
              Planning
              <div className="ml-2 h-2 w-2 bg-orange-400 rounded-full animate-pulse" title="Implementation Tasks & Sprints" />
            </TabsTrigger>
            
            <TabsTrigger value="development" className="flex items-center">
              <Hammer className="h-4 w-4 mr-2" />
              Development
              <div className="ml-2 h-2 w-2 bg-green-400 rounded-full animate-pulse" title="Iterative Code Generation" />
            </TabsTrigger>
            
            <TabsTrigger value="testing" className="flex items-center">
              <TestTube className="h-4 w-4 mr-2" />
              Testing
              <div className="ml-2 h-2 w-2 bg-purple-400 rounded-full animate-pulse" title="Automated Test Generation & Execution" />
            </TabsTrigger>
            
            <TabsTrigger value="validation" className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Validation
              <div className="ml-2 h-2 w-2 bg-red-400 rounded-full animate-pulse" title="Security Audit & Deployment Readiness" />
            </TabsTrigger>
            
            <TabsTrigger value="tasks" className="flex items-center">
              <Code2 className="h-4 w-4 mr-2" />
              Claude Tasks
              <div className="ml-2 h-2 w-2 bg-blue-400 rounded-full animate-pulse" title="Live from Target App" />
            </TabsTrigger>
            
            <TabsTrigger value="artifacts" className="flex items-center">
              <Tag className="h-4 w-4 mr-2" />
              Artifacts
              <div className="ml-2 h-2 w-2 bg-teal-400 rounded-full animate-pulse" title="Cross-Phase Artifact References" />
            </TabsTrigger>
            
            <TabsTrigger value="specs" className="flex items-center">
              <FileCode2 className="h-4 w-4 mr-2" />
              Tech Specs
              <TabBadge count={counts.technicalSpecs} />
            </TabsTrigger>
            
            <TabsTrigger value="github" className="flex items-center">
              <Github className="h-4 w-4 mr-2" />
              GitHub
              <div className="ml-2 h-2 w-2 bg-purple-400 rounded-full animate-pulse" title="Target App Code Sync" />
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="code" className="h-full m-0 p-0">
            <CodeView
              sessionId={sessionId}
              files={files}
              onRefresh={onRefreshFiles}
            />
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0 p-0">
            <UIPreview
              sessionId={sessionId}
              previewUrl={previewUrl}
              onRefresh={onRefreshPreview}
            />
          </TabsContent>

          <TabsContent value="requirements" className="h-full m-0 p-0">
            <RequirementsView
              sessionId={sessionId}
              requirements={requirements}
              onAddRequirement={onAddRequirement}
              onEditRequirement={onEditRequirement}
              onDeleteRequirement={onDeleteRequirement}
              onUpdateStatus={onUpdateRequirementStatus}
            />
          </TabsContent>

          <TabsContent value="workflow" className="h-full m-0 p-0">
            <WorkflowProgress
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="planning" className="h-full m-0 p-0">
            <TasksView
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="development" className="h-full m-0 p-0">
            <DevelopmentView
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="testing" className="h-full m-0 p-0">
            <TestingView
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="validation" className="h-full m-0 p-0">
            <ValidationView
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="tasks" className="h-full m-0 p-0">
            <TargetAppTasks
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="artifacts" className="h-full m-0 p-0">
            <ArtifactBrowser
              sessionId={sessionId}
            />
          </TabsContent>

          <TabsContent value="specs" className="h-full m-0 p-0">
            <TechnicalSpecsView
              sessionId={sessionId}
              technicalSpecs={technicalSpecs}
              onAddSpec={onAddTechnicalSpec}
              onEditSpec={onEditTechnicalSpec}
              onDeleteSpec={onDeleteTechnicalSpec}
              onViewSpec={onViewTechnicalSpec}
            />
          </TabsContent>

          <TabsContent value="github" className="h-full m-0 p-0">
            <TargetAppGitHubSync
              sessionId={sessionId || ''}
              workspaceName={workspaceName}
              projectName={projectName}
              sandboxId={sandboxId}
              className="h-full"
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}