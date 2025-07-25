"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Workflow, 
  Palette, 
  History,
  Eye,
  Terminal,
  Database,
  Zap,
  Code,
  GitBranch
} from "lucide-react"

interface NavigationTabsProps {
  mode: 'business' | 'developer'
  activeTab: string
  onTabChange: (tab: string) => void
}

export function NavigationTabs({ mode, activeTab, onTabChange }: NavigationTabsProps) {
  const businessTabs = [
    { id: 'requirements', label: 'Requirements', icon: FileText },
    { id: 'workflow', label: 'Workflow Designer', icon: Workflow },
    { id: 'ui-guidelines', label: 'UI Guidelines', icon: Palette },
    { id: 'tech-specs', label: 'Technical Specs', icon: Code },
    { id: 'history', label: 'Session History', icon: History }
  ]

  const developerTabs = [
    ...businessTabs,
    { id: 'preview', label: 'Preview & Testing', icon: Eye },
    { id: 'code-editor', label: 'Code Editor', icon: Code },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'database', label: 'Database Schema', icon: Database },
    { id: 'api-docs', label: 'API Documentation', icon: FileText },
    { id: 'deploy', label: 'Build & Deploy', icon: Zap }
  ]

  const tabs = mode === 'developer' ? developerTabs : businessTabs

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 lg:grid-cols-6">
        {tabs.slice(0, 6).map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-1">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
      
      {tabs.length > 6 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tabs.slice(6).map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </Tabs>
  )
}