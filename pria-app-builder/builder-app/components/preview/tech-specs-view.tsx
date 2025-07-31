'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileCode2, 
  Database, 
  Server, 
  Layers, 
  TestTube,
  Rocket,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Download
} from 'lucide-react'
import { TechnicalSpec } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface TechnicalSpecsViewProps {
  sessionId?: string
  technicalSpecs: TechnicalSpec[]
  onAddSpec?: () => void
  onEditSpec?: (spec: TechnicalSpec) => void
  onDeleteSpec?: (specId: string) => void
  onViewSpec?: (spec: TechnicalSpec) => void
  className?: string
}

const SPEC_TYPE_CONFIG = {
  architecture: { 
    icon: Layers, 
    label: 'Architecture', 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    description: 'Overall system design and component relationships'
  },
  component: { 
    icon: FileCode2, 
    label: 'Component', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    description: 'Individual component specifications and interfaces'
  },
  api: { 
    icon: Server, 
    label: 'API', 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    description: 'API endpoints, data contracts, and integration details'
  },
  database: { 
    icon: Database, 
    label: 'Database', 
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    description: 'Data models, relationships, and storage design'
  },
  testing: { 
    icon: TestTube, 
    label: 'Testing', 
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
    description: 'Test strategies, test cases, and quality assurance'
  },
  deployment: { 
    icon: Rocket, 
    label: 'Deployment', 
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
    description: 'Deployment configuration and infrastructure setup'
  }
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
  implemented: { label: 'Implemented', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
  outdated: { label: 'Outdated', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' }
}

interface SpecCardProps {
  spec: TechnicalSpec
  onEdit?: () => void
  onDelete?: () => void
  onView?: () => void
}

function SpecCard({ spec, onEdit, onDelete, onView }: SpecCardProps) {
  const typeConfig = SPEC_TYPE_CONFIG[spec.type]
  const TypeIcon = typeConfig.icon
  
  return (
    <Card className="mb-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onView}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("p-2 rounded-lg", typeConfig.color.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-'))}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">{spec.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {typeConfig.description}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                typeConfig.color
              )}>
                {typeConfig.label}
              </span>
              
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                STATUS_CONFIG[spec.status].color
              )}>
                {STATUS_CONFIG[spec.status].label}
              </span>
              
              {spec.version > 1 && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  v{spec.version}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onView}
              title="View specification"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              title="Edit specification"
            >
              <Edit3 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              title="Delete specification"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Content Preview */}
        {spec.content && typeof spec.content === 'object' && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Specification Preview:
            </div>
            <div className="bg-muted/30 rounded p-3 text-xs">
              {Object.keys(spec.content).slice(0, 3).map((key) => (
                <div key={key} className="flex items-center gap-2 mb-1 last:mb-0">
                  <span className="font-medium text-muted-foreground">{key}:</span>
                  <span className="truncate">
                    {typeof spec.content[key] === 'string' 
                      ? spec.content[key] 
                      : JSON.stringify(spec.content[key]).substring(0, 50) + '...'
                    }
                  </span>
                </div>
              ))}
              {Object.keys(spec.content).length > 3 && (
                <div className="text-muted-foreground mt-1">
                  +{Object.keys(spec.content).length - 3} more fields...
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Created {new Date(spec.created_at).toLocaleDateString()}
          </span>
          <span>
            Updated {new Date(spec.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function TechnicalSpecsView({
  sessionId,
  technicalSpecs,
  onAddSpec,
  onEditSpec,
  onDeleteSpec,
  onViewSpec,
  className
}: TechnicalSpecsViewProps) {
  const [selectedType, setSelectedType] = useState<string>('all')

  const filteredSpecs = selectedType === 'all' 
    ? technicalSpecs 
    : technicalSpecs.filter(spec => spec.type === selectedType)

  const getTypeCounts = () => {
    return technicalSpecs.reduce((acc, spec) => {
      acc[spec.type] = (acc[spec.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  const typeCounts = getTypeCounts()

  const handleExportSpecs = () => {
    const exportData = {
      sessionId,
      technicalSpecs: filteredSpecs,
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `technical-specs-${sessionId || 'session'}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <FileCode2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Session Active</h3>
          <p className="text-muted-foreground">
            Start a conversation to begin generating technical specifications.
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
            <h3 className="text-lg font-semibold">Technical Specifications</h3>
            <p className="text-sm text-muted-foreground">
              {technicalSpecs.length} total specifications
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportSpecs}
              disabled={technicalSpecs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={onAddSpec} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Specification
            </Button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            variant={selectedType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('all')}
            className="whitespace-nowrap"
          >
            All ({technicalSpecs.length})
          </Button>
          
          {Object.entries(SPEC_TYPE_CONFIG).map(([type, config]) => {
            const count = typeCounts[type] || 0
            if (count === 0) return null
            
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className="whitespace-nowrap"
              >
                <config.icon className="h-3 w-3 mr-1" />
                {config.label} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* Specifications Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredSpecs.length === 0 ? (
            <div className="text-center py-12">
              <FileCode2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {technicalSpecs.length === 0 ? 'No Technical Specifications Yet' : 'No Matching Specifications'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {technicalSpecs.length === 0
                  ? 'Technical specifications will be automatically generated as Claude Code analyzes your requirements.'
                  : 'Try selecting a different specification type.'
                }
              </p>
              {technicalSpecs.length === 0 && (
                <Button onClick={onAddSpec}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Specification
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSpecs.map((spec) => (
                <SpecCard
                  key={spec.id}
                  spec={spec}
                  onEdit={() => onEditSpec?.(spec)}
                  onDelete={() => onDeleteSpec?.(spec.id)}
                  onView={() => onViewSpec?.(spec)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}