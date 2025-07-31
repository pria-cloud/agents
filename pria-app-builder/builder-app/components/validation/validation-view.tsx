'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
  FileText,
  GitBranch,
  Database,
  Settings,
  Monitor,
  Lock,
  Code,
  Bug,
  TrendingUp,
  CheckSquare,
  AlertCircle,
  ExternalLink,
  Download,
  Copy,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for validation data
interface ValidationIssue {
  id: string
  type: 'vulnerability' | 'misconfiguration' | 'best_practice' | 'compliance'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  title: string
  description: string
  file_path?: string
  line_number?: number
  impact: string
  remediation: {
    recommendation: string
    code_fix?: string
    priority: 'immediate' | 'urgent' | 'normal' | 'low'
    effort_level: 'trivial' | 'easy' | 'moderate' | 'complex' | 'major'
  }
  references: string[]
  blocking: boolean
}

interface ValidationReport {
  id: string
  session_id: string
  type: 'security_audit' | 'code_review' | 'deployment_readiness'
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  start_time: string
  end_time?: string
  duration_ms: number
  overall_score: number
  ready_for_deployment: boolean
  summary: {
    total_issues: number
    critical_issues: number
    high_issues: number
    medium_issues: number
    low_issues: number
    blocking_issues: number
  }
  issues: ValidationIssue[]
  recommendations: {
    immediate_actions: string[]
    before_next_deployment: string[]
    long_term_improvements: string[]
    monitoring_setup: string[]
  }
  deployment_checklist?: {
    pre_deployment: { task: string; completed: boolean; required: boolean }[]
    post_deployment: { task: string; description: string; priority: 'high' | 'medium' | 'low' }[]
    rollback_plan: { step: string; description: string }[]
  }
  created_at: string
  updated_at: string
}

interface ValidationViewProps {
  sessionId?: string
  className?: string
}

export function ValidationView({ sessionId, className }: ValidationViewProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [reports, setReports] = useState<ValidationReport[]>([])
  const [selectedReport, setSelectedReport] = useState<ValidationReport | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      loadValidationReports()
    }
  }, [sessionId])

  const loadValidationReports = async () => {
    if (!sessionId) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/validation/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
        if (data.reports?.length > 0) {
          setSelectedReport(data.reports[0]) // Select most recent report
        }
      }
    } catch (error) {
      console.error('Failed to load validation reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const runValidation = async (type: 'security_audit' | 'code_review' | 'deployment_readiness' | 'comprehensive') => {
    if (!sessionId || isRunning) return

    try {
      setIsRunning(true)
      const response = await fetch(`/api/validation/${sessionId}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validation_type: type,
          config: {
            include_static_analysis: true,
            include_dependency_scan: true,
            include_configuration_audit: true,
            include_pria_compliance: true,
            include_owasp_top10: true,
            severity_threshold: 'info',
            scan_depth: 'comprehensive'
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.report) {
          setReports(prev => [data.report, ...prev])
          setSelectedReport(data.report)
        }
        // Reload reports to get latest status
        setTimeout(() => loadValidationReports(), 2000)
      }
    } catch (error) {
      console.error('Failed to run validation:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'low':
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getDeploymentReadinessColor = (ready: boolean, score: number) => {
    if (!ready) return 'bg-red-500'
    if (score >= 90) return 'bg-green-500'
    if (score >= 70) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading validation reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">Validation & Security Audit</h2>
            <p className="text-sm text-muted-foreground">
              Code review, security analysis, and deployment readiness
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadValidationReports()}
            disabled={isRunning}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRunning && "animate-spin")} />
            Refresh
          </Button>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runValidation('security_audit')}
              disabled={isRunning}
            >
              <Lock className="h-4 w-4 mr-2" />
              Security Audit
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => runValidation('code_review')}
              disabled={isRunning}
            >
              <Code className="h-4 w-4 mr-2" />
              Code Review
            </Button>
            
            <Button
              onClick={() => runValidation('comprehensive')}
              disabled={isRunning}
              size="sm"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Full Validation
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {reports.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Validation Reports</h3>
                <p className="text-muted-foreground mb-4">
                  Run a validation to check code quality, security, and deployment readiness.
                </p>
                <Button
                  onClick={() => runValidation('comprehensive')}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  Start Validation
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Reports Sidebar */}
            <div className="w-80 border-r bg-muted/30">
              <div className="p-4 border-b">
                <h3 className="font-medium">Validation Reports</h3>
                <p className="text-sm text-muted-foreground">
                  {reports.length} report{reports.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              <ScrollArea className="h-[calc(100%-80px)]">
                <div className="p-2 space-y-2">
                  {reports.map((report) => (
                    <Card
                      key={report.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent",
                        selectedReport?.id === report.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedReport(report)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {report.status === 'running' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : report.status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium text-sm capitalize">
                              {report.type.replace('_', ' ')}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {report.overall_score}%
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {new Date(report.created_at).toLocaleDateString()}
                            </span>
                            {report.duration_ms > 0 && (
                              <span className="text-muted-foreground">
                                {formatDuration(report.duration_ms)}
                              </span>
                            )}
                          </div>
                          
                          {report.status === 'completed' && (
                            <div className="flex items-center gap-1 text-xs">
                              {report.summary.critical_issues > 0 && (
                                <Badge variant="destructive" className="h-5 px-1">
                                  {report.summary.critical_issues} critical
                                </Badge>
                              )}
                              {report.summary.high_issues > 0 && (
                                <Badge variant="secondary" className="h-5 px-1 bg-orange-100 text-orange-800">
                                  {report.summary.high_issues} high
                                </Badge>
                              )}
                              {report.summary.total_issues === 0 && (
                                <Badge variant="secondary" className="h-5 px-1 bg-green-100 text-green-800">
                                  No issues
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Report Details */}
            <div className="flex-1 flex flex-col">
              {selectedReport ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="issues">
                        Issues ({selectedReport.summary.total_issues})
                      </TabsTrigger>
                      <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                      <TabsTrigger value="checklist">Deployment</TabsTrigger>
                      <TabsTrigger value="export">Export</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="overview" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                          {/* Status Banner */}
                          <Alert className={cn(
                            selectedReport.ready_for_deployment
                              ? "border-green-500 bg-green-50 dark:bg-green-950"
                              : "border-red-500 bg-red-50 dark:bg-red-950"
                          )}>
                            {selectedReport.ready_for_deployment ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <AlertTitle>
                              {selectedReport.ready_for_deployment 
                                ? "Ready for Deployment" 
                                : "Not Ready for Deployment"
                              }
                            </AlertTitle>
                            <AlertDescription>
                              {selectedReport.ready_for_deployment
                                ? "All critical validation checks have passed."
                                : `${selectedReport.summary.blocking_issues} blocking issue${selectedReport.summary.blocking_issues !== 1 ? 's' : ''} must be resolved before deployment.`
                              }
                            </AlertDescription>
                          </Alert>

                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">Overall Score</p>
                                    <p className="text-2xl font-bold">{selectedReport.overall_score}%</p>
                                  </div>
                                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <Progress 
                                  value={selectedReport.overall_score} 
                                  className="mt-2"
                                />
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">Total Issues</p>
                                    <p className="text-2xl font-bold">{selectedReport.summary.total_issues}</p>
                                  </div>
                                  <Bug className="h-8 w-8 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">Critical Issues</p>
                                    <p className="text-2xl font-bold text-red-600">
                                      {selectedReport.summary.critical_issues}
                                    </p>
                                  </div>
                                  <AlertTriangle className="h-8 w-8 text-red-500" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">Status</p>
                                    <p className="text-sm font-medium capitalize">{selectedReport.status}</p>
                                  </div>
                                  {selectedReport.status === 'completed' ? (
                                    <CheckCircle className="h-8 w-8 text-green-500" />
                                  ) : selectedReport.status === 'running' ? (
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                  ) : (
                                    <XCircle className="h-8 w-8 text-red-500" />
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Issues Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Bug className="h-5 w-5" />
                                Issues by Severity
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {[
                                  { level: 'critical', count: selectedReport.summary.critical_issues, color: 'bg-red-500' },
                                  { level: 'high', count: selectedReport.summary.high_issues, color: 'bg-orange-500' },
                                  { level: 'medium', count: selectedReport.summary.medium_issues, color: 'bg-yellow-500' },
                                  { level: 'low', count: selectedReport.summary.low_issues, color: 'bg-blue-500' }
                                ].map(({ level, count, color }) => (
                                  <div key={level} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-3 h-3 rounded-full", color)} />
                                      <span className="font-medium capitalize">{level}</span>
                                    </div>
                                    <Badge variant="outline">{count}</Badge>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Report Metadata */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Report Details
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Report ID:</span>
                                  <p className="text-muted-foreground font-mono">{selectedReport.id}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Type:</span>
                                  <p className="text-muted-foreground capitalize">
                                    {selectedReport.type.replace('_', ' ')}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Started:</span>
                                  <p className="text-muted-foreground">
                                    {new Date(selectedReport.start_time).toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <span className="font-medium">Duration:</span>
                                  <p className="text-muted-foreground">
                                    {formatDuration(selectedReport.duration_ms)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="issues" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6">
                          {selectedReport.issues.length === 0 ? (
                            <div className="text-center py-8">
                              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                              <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
                              <p className="text-muted-foreground">
                                All validation checks passed successfully.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {selectedReport.issues.map((issue) => (
                                <Card key={issue.id} className={cn(
                                  "border-l-4",
                                  issue.severity === 'critical' && "border-l-red-500",
                                  issue.severity === 'high' && "border-l-orange-500",
                                  issue.severity === 'medium' && "border-l-yellow-500",
                                  issue.severity === 'low' && "border-l-blue-500"
                                )}>
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {getSeverityIcon(issue.severity)}
                                        <h4 className="font-medium">{issue.title}</h4>
                                        {issue.blocking && (
                                          <Badge variant="destructive" className="text-xs">
                                            Blocking
                                          </Badge>
                                        )}
                                      </div>
                                      <Badge className={getSeverityColor(issue.severity)}>
                                        {issue.severity}
                                      </Badge>
                                    </div>
                                    
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {issue.description}
                                    </p>
                                    
                                    {issue.file_path && (
                                      <div className="text-xs text-muted-foreground mb-2">
                                        <span className="font-medium">File:</span> {issue.file_path}
                                        {issue.line_number && (
                                          <span className="ml-2">
                                            <span className="font-medium">Line:</span> {issue.line_number}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="text-sm">
                                      <span className="font-medium">Impact:</span>
                                      <p className="text-muted-foreground">{issue.impact}</p>
                                    </div>
                                    
                                    <Separator className="my-3" />
                                    
                                    <div>
                                      <h5 className="font-medium text-sm mb-2">Remediation</h5>
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {issue.remediation.recommendation}
                                      </p>
                                      
                                      {issue.remediation.code_fix && (
                                        <div className="bg-muted rounded p-2 text-xs font-mono">
                                          {issue.remediation.code_fix}
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-4 mt-2 text-xs">
                                        <span>
                                          <span className="font-medium">Priority:</span> {issue.remediation.priority}
                                        </span>
                                        <span>
                                          <span className="font-medium">Effort:</span> {issue.remediation.effort_level}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {issue.references.length > 0 && (
                                      <div className="mt-3 pt-3 border-t">
                                        <span className="font-medium text-sm">References:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {issue.references.map((ref, index) => (
                                            <Button
                                              key={index}
                                              variant="outline"
                                              size="sm"
                                              className="h-6 px-2 text-xs"
                                              onClick={() => window.open(ref, '_blank')}
                                            >
                                              <ExternalLink className="h-3 w-3 mr-1" />
                                              Reference {index + 1}
                                            </Button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="recommendations" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                          {/* Immediate Actions */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-red-600">
                                <AlertTriangle className="h-5 w-5" />
                                Immediate Actions Required
                              </CardTitle>
                              <CardDescription>
                                Critical issues that must be addressed before deployment
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {selectedReport.recommendations.immediate_actions.length === 0 ? (
                                <p className="text-muted-foreground">No immediate actions required.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {selectedReport.recommendations.immediate_actions.map((action, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <Badge variant="destructive" className="mt-0.5 text-xs">
                                        {index + 1}
                                      </Badge>
                                      <span className="text-sm">{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>

                          {/* Before Next Deployment */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-orange-600">
                                <Clock className="h-5 w-5" />
                                Before Next Deployment
                              </CardTitle>
                              <CardDescription>
                                Improvements to address before the next deployment
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {selectedReport.recommendations.before_next_deployment.length === 0 ? (
                                <p className="text-muted-foreground">No actions required before next deployment.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {selectedReport.recommendations.before_next_deployment.map((action, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                      <Badge variant="outline" className="mt-0.5 text-xs">
                                        {index + 1}
                                      </Badge>
                                      <span className="text-sm">{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>

                          {/* Long-term Improvements */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-blue-600">
                                <TrendingUp className="h-5 w-5" />
                                Long-term Improvements
                              </CardTitle>
                              <CardDescription>
                                Strategic improvements for enhanced security and maintainability
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {selectedReport.recommendations.long_term_improvements.map((improvement, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <Badge variant="outline" className="mt-0.5 text-xs">
                                      {index + 1}
                                    </Badge>
                                    <span className="text-sm">{improvement}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          {/* Monitoring Setup */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-green-600">
                                <Monitor className="h-5 w-5" />
                                Monitoring & Alerting
                              </CardTitle>
                              <CardDescription>
                                Recommended monitoring and alerting setup
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {selectedReport.recommendations.monitoring_setup.map((setup, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <Badge variant="outline" className="mt-0.5 text-xs">
                                      {index + 1}
                                    </Badge>
                                    <span className="text-sm">{setup}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="checklist" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                          {selectedReport.deployment_checklist ? (
                            <>
                              {/* Pre-deployment Checklist */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <CheckSquare className="h-5 w-5" />
                                    Pre-deployment Checklist
                                  </CardTitle>
                                  <CardDescription>
                                    Tasks to complete before deploying to production
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {selectedReport.deployment_checklist.pre_deployment.map((item, index) => (
                                      <div key={index} className="flex items-center gap-3">
                                        {item.completed ? (
                                          <CheckCircle className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-500" />
                                        )}
                                        <span className={cn(
                                          "text-sm",
                                          item.completed && "line-through text-muted-foreground"
                                        )}>
                                          {item.task}
                                        </span>
                                        {item.required && (
                                          <Badge variant="destructive" className="text-xs">
                                            Required
                                          </Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Post-deployment Tasks */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <Monitor className="h-5 w-5" />
                                    Post-deployment Tasks
                                  </CardTitle>
                                  <CardDescription>
                                    Tasks to complete after deployment
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {selectedReport.deployment_checklist.post_deployment.map((item, index) => (
                                      <div key={index} className="space-y-1">
                                        <div className="flex items-center gap-3">
                                          <Clock className="h-4 w-4 text-muted-foreground" />
                                          <span className="text-sm font-medium">{item.task}</span>
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-xs",
                                              item.priority === 'high' && "border-red-500 text-red-600",
                                              item.priority === 'medium' && "border-yellow-500 text-yellow-600",
                                              item.priority === 'low' && "border-blue-500 text-blue-600"
                                            )}
                                          >
                                            {item.priority}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground ml-7">
                                          {item.description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Rollback Plan */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <GitBranch className="h-5 w-5" />
                                    Rollback Plan
                                  </CardTitle>
                                  <CardDescription>
                                    Steps to rollback deployment if issues occur
                                  </CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {selectedReport.deployment_checklist.rollback_plan.map((step, index) => (
                                      <div key={index} className="flex items-start gap-3">
                                        <Badge variant="outline" className="mt-0.5 text-xs">
                                          {index + 1}
                                        </Badge>
                                        <div>
                                          <p className="text-sm font-medium">{step.step}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {step.description}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            </>
                          ) : (
                            <div className="text-center py-8">
                              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                              <h3 className="text-lg font-semibold mb-2">No Deployment Checklist</h3>
                              <p className="text-muted-foreground">
                                Run a deployment readiness validation to generate a checklist.
                              </p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="export" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                Export Report
                              </CardTitle>
                              <CardDescription>
                                Download validation report in various formats
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" className="h-auto p-4 flex flex-col">
                                  <FileText className="h-8 w-8 mb-2" />
                                  <span className="font-medium">PDF Report</span>
                                  <span className="text-xs text-muted-foreground">
                                    Comprehensive report with charts
                                  </span>
                                </Button>
                                
                                <Button variant="outline" className="h-auto p-4 flex flex-col">
                                  <FileText className="h-8 w-8 mb-2" />
                                  <span className="font-medium">CSV Export</span>
                                  <span className="text-xs text-muted-foreground">
                                    Issues list for analysis
                                  </span>
                                </Button>
                                
                                <Button variant="outline" className="h-auto p-4 flex flex-col">
                                  <Code className="h-8 w-8 mb-2" />
                                  <span className="font-medium">JSON Data</span>
                                  <span className="text-xs text-muted-foreground">
                                    Raw report data
                                  </span>
                                </Button>
                                
                                <Button variant="outline" className="h-auto p-4 flex flex-col">
                                  <Copy className="h-8 w-8 mb-2" />
                                  <span className="font-medium">Copy Summary</span>
                                  <span className="text-xs text-muted-foreground">
                                    Quick summary to clipboard
                                  </span>
                                </Button>
                              </div>
                              
                              <Separator />
                              
                              <div>
                                <h4 className="font-medium mb-2">Share Options</h4>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Generate Public Link
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Report URL
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </div>
                </Tabs>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Select a report to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}