"use client"

import { useState, createContext, useContext } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"

// Import refactored components
import { ModeSelector } from "./workspace/mode-selector"
import { SessionSelector } from "./workspace/session-selector"
import { NavigationTabs } from "./workspace/navigation-tabs"
import { RequirementsView } from "./workspace/requirements/requirements-view"
import { WorkflowDesigner } from "./workspace/workflow/workflow-designer"
import { CodeEditor } from "./workspace/developer/code-editor"
import { UIGuidelines } from "./workspace/ui/ui-guidelines"
import { TechSpecs } from "./workspace/technical/tech-specs"
import { SessionHistory } from "./workspace/history/session-history"
import { PreviewTesting } from "./workspace/developer/preview-testing"
import { Terminal } from "./workspace/developer/terminal"
import { DatabaseSchema } from "./workspace/developer/database-schema"
import { APIDocumentation } from "./workspace/developer/api-documentation"
import { BuildDeploy } from "./workspace/developer/build-deploy"

// Workspace Context
interface WorkspaceContextType {
  mode: 'business' | 'developer'
  activeTab: string
  currentSession: any
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  mode: 'business',
  activeTab: 'requirements',
  currentSession: { id: '1', name: 'E-commerce Platform', status: 'connected', lastActive: '2 minutes ago' }
})

export function ClaudeWorkspace() {
  const [mode, setMode] = useState<'business' | 'developer'>('business')
  const [activeTab, setActiveTab] = useState('requirements')
  const [currentSession, setCurrentSession] = useState({
    id: '1',
    name: 'E-commerce Platform',
    status: 'connected' as const,
    lastActive: '2 minutes ago'
  })

  const contextValue = {
    mode,
    activeTab,
    currentSession
  }

  // All components are now properly refactored and modularized

  const renderTabContent = () => {
    switch (activeTab) {
      case 'requirements':
        return <RequirementsView />
      case 'workflow':
        return <WorkflowDesigner />
      case 'ui-guidelines':
        return <UIGuidelines />
      case 'tech-specs':
        return <TechSpecs />
      case 'history':
        return <SessionHistory />
      case 'preview':
        return <PreviewTesting />
      case 'code-editor':
        return <CodeEditor />
      case 'terminal':
        return <Terminal />
      case 'database':
        return <DatabaseSchema />
      case 'api-docs':
        return <APIDocumentation />
      case 'deploy':
        return <BuildDeploy />
      default:
        return <RequirementsView />
    }
  }

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">Claude Workspace</h1>
            <div className="flex items-center space-x-4">
              <SessionSelector 
                currentSession={currentSession}
                onSessionChange={setCurrentSession}
              />
              <ModeSelector 
                mode={mode}
                onModeChange={setMode}
              />
            </div>
          </div>

          {/* Navigation */}
          <NavigationTabs 
            mode={mode}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Main Content */}
          <Tabs value={activeTab} className="w-full">
            <TabsContent value={activeTab} className="mt-6">
              {renderTabContent()}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </WorkspaceContext.Provider>
  )
}

// Export the context hook for child components
export const useWorkspace = () => useContext(WorkspaceContext)