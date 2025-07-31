'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Search,
  Filter,
  Tag,
  Clock,
  Users,
  FileText,
  Layers,
  TrendingUp,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Hash,
  ArrowRight,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ArtifactReference {
  agentName: string
  artifactType?: string
  query?: string
  phase?: number
  timeframe?: 'latest' | 'all' | 'recent'
  priority?: 'high' | 'medium' | 'low'
}

interface ResolvedArtifact {
  id: string
  reference_key: string
  type: string
  content: any
  metadata: {
    phase: number
    agent: string
    confidence?: number
    created_at: string
    updated_at: string
  }
  relevance_score: number
  context_summary: string
}

interface ArtifactContext {
  artifacts: ResolvedArtifact[]
  summary: string
  phase_coverage: number[]
  agent_coverage: string[]
  total_relevance: number
  context_quality: 'excellent' | 'good' | 'fair' | 'poor'
}

interface ArtifactStatistics {
  total_artifacts: number
  by_agent: Record<string, number>
  by_type: Record<string, number>
  by_phase: Record<number, number>
  recent_activity: number
}

interface ArtifactBrowserProps {
  sessionId?: string
  className?: string
}

export function ArtifactBrowser({ sessionId, className }: ArtifactBrowserProps) {
  const [referenceQuery, setReferenceQuery] = useState('')
  const [parsedReferences, setParsedReferences] = useState<ArtifactReference[]>([])
  const [resolvedContext, setResolvedContext] = useState<ArtifactContext | null>(null)
  const [statistics, setStatistics] = useState<ArtifactStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('browser')

  useEffect(() => {
    if (sessionId) {
      loadStatistics()
    }
  }, [sessionId])

  const loadStatistics = async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/artifacts/${sessionId}?action=statistics`)
      if (response.ok) {
        const data = await response.json()
        setStatistics(data.statistics)
      }
    } catch (error) {
      console.error('Failed to load artifact statistics:', error)
    }
  }

  const parseReferences = async () => {
    if (!sessionId || !referenceQuery.trim()) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/artifacts/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'parse',
          query: referenceQuery
        })
      })

      if (response.ok) {
        const data = await response.json()
        setParsedReferences(data.references)
        
        // Auto-resolve if references found
        if (data.references.length > 0) {
          await resolveReferences(data.references)
        } else {
          setResolvedContext(null)
        }
      } else {
        setError('Failed to parse references')
      }
    } catch (error) {
      setError('Error parsing references')
      console.error('Parse error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resolveReferences = async (references: ArtifactReference[]) => {
    if (!sessionId || references.length === 0) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/artifacts/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'resolve',
          references: references
        })
      })

      if (response.ok) {
        const data = await response.json()
        setResolvedContext(data.context)
      } else {
        setError('Failed to resolve references')
      }
    } catch (error) {
      setError('Error resolving references')
      console.error('Resolve error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'text-green-600'
      case 'good':
        return 'text-blue-600'
      case 'fair':
        return 'text-yellow-600'
      default:
        return 'text-red-600'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">Artifact Browser</h2>
            <p className="text-sm text-muted-foreground">
              Search and reference artifacts across phases using @agent-name syntax
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={loadStatistics}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 py-3 border-b">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="browser">Browser</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              <TabsTrigger value="help">Help</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="browser" className="h-full m-0 p-0">
              <div className="h-full flex flex-col">
                {/* Search Interface */}
                <div className="p-4 border-b space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Enter artifact references (e.g., @requirements-analyst, @code-generator:component, @system-architect#2)"
                        value={referenceQuery}
                        onChange={(e) => setReferenceQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && parseReferences()}
                      />
                    </div>
                    <Button onClick={parseReferences} disabled={isLoading || !referenceQuery.trim()}>
                      <Search className="h-4 w-4 mr-2" />
                      Parse
                    </Button>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Parsed References */}
                  {parsedReferences.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Parsed References ({parsedReferences.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {parsedReferences.map((ref, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className={getPriorityColor(ref.priority || 'low')}
                          >
                            @{ref.agentName}
                            {ref.artifactType && `:${ref.artifactType}`}
                            {ref.phase && `#${ref.phase}`}
                            {ref.timeframe && ref.timeframe !== 'latest' && `@${ref.timeframe}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Results */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {resolvedContext ? (
                      <div className="space-y-6">
                        {/* Context Summary */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Activity className="h-5 w-5" />
                              Context Summary
                              <Badge className={getQualityColor(resolvedContext.context_quality)}>
                                {resolvedContext.context_quality}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              {resolvedContext.summary}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Artifacts:</span>
                                <p className="text-muted-foreground">{resolvedContext.artifacts.length}</p>
                              </div>
                              <div>
                                <span className="font-medium">Agents:</span>
                                <p className="text-muted-foreground">{resolvedContext.agent_coverage.length}</p>
                              </div>
                              <div>
                                <span className="font-medium">Phases:</span>
                                <p className="text-muted-foreground">{resolvedContext.phase_coverage.length}</p>
                              </div>
                              <div>
                                <span className="font-medium">Relevance:</span>
                                <p className="text-muted-foreground">
                                  {(resolvedContext.total_relevance / resolvedContext.artifacts.length * 100).toFixed(0)}%
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Resolved Artifacts */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold">Resolved Artifacts</h4>
                          {resolvedContext.artifacts.map((artifact) => (
                            <Card key={artifact.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      @{artifact.metadata.agent}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {artifact.type}
                                    </Badge>
                                    <Badge variant="outline">
                                      Phase {artifact.metadata.phase}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      {(artifact.relevance_score * 100).toFixed(0)}% relevance
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(JSON.stringify(artifact.content, null, 2))}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-3">
                                  {artifact.context_summary}
                                </p>
                                
                                <div className="bg-muted rounded p-3 text-sm font-mono">
                                  <pre className="whitespace-pre-wrap">
                                    {typeof artifact.content === 'string' 
                                      ? artifact.content.substring(0, 300)
                                      : JSON.stringify(artifact.content, null, 2).substring(0, 300)
                                    }
                                    {JSON.stringify(artifact.content).length > 300 && '...'}
                                  </pre>
                                </div>
                                
                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                  <span>Created: {new Date(artifact.metadata.created_at).toLocaleString()}</span>
                                  {artifact.metadata.confidence && (
                                    <span>Confidence: {(artifact.metadata.confidence * 100).toFixed(0)}%</span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : parsedReferences.length === 0 && !isLoading ? (
                      <div className="text-center py-8">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Search Artifacts</h3>
                        <p className="text-muted-foreground mb-4">
                          Use @agent-name syntax to reference artifacts from other phases.
                        </p>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <p><code>@requirements-analyst</code> - All artifacts from requirements phase</p>
                          <p><code>@code-generator:component</code> - Components from development phase</p>
                          <p><code>@system-architect#2</code> - Architecture artifacts from phase 2</p>
                        </div>
                      </div>
                    ) : isLoading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Processing artifact references...</p>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="statistics" className="h-full m-0 p-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {statistics ? (
                    <>
                      {/* Overview Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Total Artifacts</p>
                                <p className="text-2xl font-bold">{statistics.total_artifacts}</p>
                              </div>
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Active Agents</p>
                                <p className="text-2xl font-bold">{Object.keys(statistics.by_agent).length}</p>
                              </div>
                              <Users className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Artifact Types</p>
                                <p className="text-2xl font-bold">{Object.keys(statistics.by_type).length}</p>
                              </div>
                              <Tag className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">Recent Activity</p>
                                <p className="text-2xl font-bold">{statistics.recent_activity}</p>
                              </div>
                              <TrendingUp className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Detailed Breakdowns */}
                      <div className="grid lg:grid-cols-3 gap-6">
                        {/* By Agent */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              By Agent
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {Object.entries(statistics.by_agent)
                                .sort(([,a], [,b]) => b - a)
                                .map(([agent, count]) => (
                                <div key={agent} className="flex items-center justify-between">
                                  <span className="text-sm">@{agent}</span>
                                  <Badge variant="outline">{count}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* By Type */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Tag className="h-5 w-5" />
                              By Type
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {Object.entries(statistics.by_type)
                                .sort(([,a], [,b]) => b - a)
                                .map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between">
                                  <span className="text-sm capitalize">{type}</span>
                                  <Badge variant="outline">{count}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* By Phase */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Layers className="h-5 w-5" />
                              By Phase
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {Object.entries(statistics.by_phase)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([phase, count]) => (
                                <div key={phase} className="flex items-center justify-between">
                                  <span className="text-sm">Phase {phase}</span>
                                  <Badge variant="outline">{count}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Statistics Available</h3>
                      <p className="text-muted-foreground">
                        Statistics will appear once artifacts are created in this session.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="help" className="h-full m-0 p-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Artifact Reference Syntax</CardTitle>
                      <CardDescription>
                        Learn how to reference artifacts from other phases and agents
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <code className="bg-muted px-2 py-1 rounded text-sm">@agent-name</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            References all artifacts from a specific agent
                          </p>
                        </div>
                        
                        <div>
                          <code className="bg-muted px-2 py-1 rounded text-sm">@agent-name:type</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            References specific artifact types from an agent
                          </p>
                        </div>
                        
                        <div>
                          <code className="bg-muted px-2 py-1 rounded text-sm">@agent-name#phase</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            References artifacts from a specific phase
                          </p>
                        </div>
                        
                        <div>
                          <code className="bg-muted px-2 py-1 rounded text-sm">@agent-name@timeframe</code>
                          <p className="text-sm text-muted-foreground mt-1">
                            References artifacts by timeframe (latest, recent, all)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Available Agents</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@requirements-analyst</Badge>
                          <span className="text-sm">Phase 1 - Requirements and user stories</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@system-architect</Badge>
                          <span className="text-sm">Phase 2 - Technical specifications and architecture</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@project-planner</Badge>
                          <span className="text-sm">Phase 3 - Implementation planning and tasks</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@code-generator</Badge>
                          <span className="text-sm">Phase 4 - Code generation and development</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@qa-engineer</Badge>
                          <span className="text-sm">Phase 5 - Testing and quality assurance</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">@security-auditor</Badge>
                          <span className="text-sm">Phase 6 - Security audit and validation</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Example Usage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <div>
                          <code className="bg-muted px-2 py-1 rounded">@requirements-analyst @system-architect:specification</code>
                          <p className="text-muted-foreground mt-1">
                            Get requirements and technical specifications for context
                          </p>
                        </div>
                        
                        <div>
                          <code className="bg-muted px-2 py-1 rounded">@code-generator:component @qa-engineer:test</code>
                          <p className="text-muted-foreground mt-1">
                            Reference generated components and related tests
                          </p>
                        </div>
                        
                        <div>
                          <code className="bg-muted px-2 py-1 rounded">@security-auditor#6 @project-planner#3</code>
                          <p className="text-muted-foreground mt-1">
                            Get security findings and implementation tasks from specific phases
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}