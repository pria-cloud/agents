'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Code, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Loader2,
  Play,
  RefreshCw,
  Eye,
  GitBranch,
  Clock,
  Target,
  Zap
} from 'lucide-react'

interface DevelopmentProgress {
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  blocked_tasks: number
  overall_compliance: number
  critical_issues: number
  files_generated: number
  quality_gates_passed: number
  quality_gates_total: number
}

interface DevelopmentSession {
  session_id: string
  workspace_id: string
  current_task?: any
  active_iterations: any[]
  overall_compliance_score: number
  total_files_generated: number
  development_phase: string
  quality_gates_passed: string[]
  quality_gates_pending: string[]
}

interface DevelopmentIteration {
  id: string
  task_id: string
  iteration_number: number
  description: string
  files_changed: string[]
  compliance_report: any
  feedback: string[]
  improvements: string[]
  status: 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

interface GeneratedFile {
  id: string
  file_path: string
  file_content: string
  file_type: string
  compliance_issues: number
  created_at: string
  updated_at: string
}

interface DevelopmentViewProps {
  sessionId: string
}

export function DevelopmentView({ sessionId }: DevelopmentViewProps) {
  const [progress, setProgress] = useState<DevelopmentProgress | null>(null)
  const [session, setSession] = useState<DevelopmentSession | null>(null)
  const [iterations, setIterations] = useState<DevelopmentIteration[]>([])
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [complianceReport, setComplianceReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchDevelopmentData()
  }, [sessionId])

  const fetchDevelopmentData = async () => {
    setLoading(true)
    try {
      // Fetch progress
      const progressRes = await fetch(`/api/development/${sessionId}?action=progress`)
      if (progressRes.ok) {
        const progressData = await progressRes.json()
        setProgress(progressData)
      }

      // Fetch session
      const sessionRes = await fetch(`/api/development/${sessionId}?action=session`)
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setSession(sessionData)
      }

      // Fetch iterations
      const iterationsRes = await fetch(`/api/development/${sessionId}?action=iterations`)
      if (iterationsRes.ok) {
        const iterationsData = await iterationsRes.json()
        setIterations(iterationsData.iterations || [])
      }

      // Fetch files
      const filesRes = await fetch(`/api/development/${sessionId}?action=files`)
      if (filesRes.ok) {
        const filesData = await filesRes.json()
        setFiles(filesData.files || [])
      }

      // Fetch compliance
      const complianceRes = await fetch(`/api/development/${sessionId}?action=compliance`)
      if (complianceRes.ok) {
        const complianceData = await complianceRes.json()
        setComplianceReport(complianceData)
      }

    } catch (error) {
      console.error('Failed to fetch development data:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeDevelopmentSession = async () => {
    try {
      const response = await fetch(`/api/development/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' })
      })
      
      if (response.ok) {
        await fetchDevelopmentData()
      }
    } catch (error) {
      console.error('Failed to initialize development session:', error)
    }
  }

  const startIteration = async (taskId: string) => {
    try {
      const response = await fetch(`/api/development/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_iteration',
          taskId,
          description: 'New development iteration',
          userRequirements: 'Continue development with PRIA compliance'
        })
      })
      
      if (response.ok) {
        await fetchDevelopmentData()
      }
    } catch (error) {
      console.error('Failed to start iteration:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading development data...</span>
      </div>
    )
  }

  if (!session && !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Development Phase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Development Not Started</h3>
            <p className="text-muted-foreground mb-4">
              Initialize the development session to begin iterative code generation.
            </p>
            <Button onClick={initializeDevelopmentSession}>
              <Play className="h-4 w-4 mr-2" />
              Initialize Development
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Development Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Development Progress
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchDevelopmentData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {progress && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{progress.completed_tasks}</div>
                <div className="text-sm text-muted-foreground">Completed Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{progress.in_progress_tasks}</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{progress.overall_compliance}%</div>
                <div className="text-sm text-muted-foreground">Compliance Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{progress.files_generated}</div>
                <div className="text-sm text-muted-foreground">Files Generated</div>
              </div>
            </div>
          )}

          {session && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={session.development_phase === 'completed' ? 'default' : 'secondary'}>
                  {session.development_phase}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Quality Gates: {session.quality_gates_passed.length} / {session.quality_gates_passed.length + session.quality_gates_pending.length}
                </span>
              </div>

              <Progress 
                value={progress ? (progress.completed_tasks / progress.total_tasks) * 100 : 0} 
                className="w-full"
              />

              {progress && progress.critical_issues > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {progress.critical_issues} critical issues need attention before continuing.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="iterations">Iterations</TabsTrigger>
          <TabsTrigger value="files">Generated Files</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Development Session Details</CardTitle>
            </CardHeader>
            <CardContent>
              {session && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Quality Gates Passed</h4>
                      <div className="space-y-1">
                        {session.quality_gates_passed.map((gate, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{gate.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Pending Quality Gates</h4>
                      <div className="space-y-1">
                        {session.quality_gates_pending.map((gate, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-orange-500" />
                            <span className="text-sm">{gate.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {session.current_task && (
                    <div>
                      <h4 className="font-medium mb-2">Current Task</h4>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{session.current_task.title}</span>
                            <Badge>{session.current_task.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{session.current_task.description}</p>
                          <div className="mt-2">
                            <Button 
                              size="sm" 
                              onClick={() => startIteration(session.current_task.id)}
                              className="mr-2"
                            >
                              <GitBranch className="h-4 w-4 mr-2" />
                              Start Iteration
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iterations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Development Iterations</CardTitle>
            </CardHeader>
            <CardContent>
              {iterations.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Iterations Yet</h3>
                  <p className="text-muted-foreground">
                    Start a development iteration to begin code generation.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {iterations.map((iteration) => (
                    <Card key={iteration.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Iteration #{iteration.iteration_number}</span>
                          <Badge variant={
                            iteration.status === 'completed' ? 'default' :
                            iteration.status === 'failed' ? 'destructive' : 'secondary'
                          }>
                            {iteration.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{iteration.description}</p>
                        
                        {iteration.files_changed.length > 0 && (
                          <div className="mb-2">
                            <span className="text-sm font-medium">Files Modified: </span>
                            <span className="text-sm">{iteration.files_changed.length}</span>
                          </div>
                        )}

                        {iteration.compliance_report && (
                          <div className="mb-2">
                            <span className="text-sm font-medium">Compliance Score: </span>
                            <Badge variant={iteration.compliance_report.score >= 90 ? 'default' : 'secondary'}>
                              {iteration.compliance_report.score}/100
                            </Badge>
                          </div>
                        )}

                        {iteration.feedback.length > 0 && (
                          <div className="mt-2">
                            <details className="text-sm">
                              <summary className="cursor-pointer font-medium">Feedback ({iteration.feedback.length})</summary>
                              <div className="mt-2 space-y-1">
                                {iteration.feedback.map((feedback, index) => (
                                  <div key={index} className="text-muted-foreground">• {feedback}</div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Files</CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Files Generated</h3>
                  <p className="text-muted-foreground">
                    Files will appear here after code generation iterations.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <Card key={file.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-mono text-sm">{file.file_path}</span>
                            <Badge variant="outline">{file.file_type}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {file.compliance_issues > 0 && (
                              <Badge variant="destructive">
                                {file.compliance_issues} issues
                              </Badge>
                            )}
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Updated: {new Date(file.updated_at).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PRIA Compliance Report</CardTitle>
            </CardHeader>
            <CardContent>
              {complianceReport ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{complianceReport.score}</div>
                      <div className="text-sm text-muted-foreground">Overall Score</div>
                    </div>
                    <div className="flex-1">
                      <Progress value={complianceReport.score} className="w-full" />
                    </div>
                  </div>

                  {complianceReport.issues && complianceReport.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Issues Found</h4>
                      <div className="space-y-2">
                        {complianceReport.issues.slice(0, 5).map((issue: any, index: number) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-2">
                                {issue.severity === 'critical' ? (
                                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                ) : issue.severity === 'high' ? (
                                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                                )}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{issue.title}</span>
                                    <Badge variant={
                                      issue.severity === 'critical' ? 'destructive' :
                                      issue.severity === 'high' ? 'destructive' : 'secondary'
                                    }>
                                      {issue.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{issue.description}</p>
                                  {issue.fix && (
                                    <p className="text-sm text-blue-600 mt-1">
                                      <strong>Fix:</strong> {issue.fix}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {complianceReport.recommendations && (
                    <div>
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <div className="space-y-1">
                        {complianceReport.recommendations.map((rec: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Compliance Report</h3>
                  <p className="text-muted-foreground">
                    Compliance reports will appear after code generation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}