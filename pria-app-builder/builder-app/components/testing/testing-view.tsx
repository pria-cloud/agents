'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Shield,
  Zap,
  Target,
  BarChart3,
  FileText,
  Settings,
  Loader2,
  ChevronDown,
  ChevronRight,
  Bug,
  Beaker,
  TestTube
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TestingViewProps {
  sessionId: string
}

interface TestCase {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e' | 'api' | 'component'
  status: 'generated' | 'running' | 'passed' | 'failed' | 'skipped'
  execution_time_ms?: number
  error_message?: string
  coverage_percentage?: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  framework: string
  file_path: string
  assertions: number
  metadata: {
    auto_generated: boolean
    confidence_score: number
    requires_manual_review: boolean
  }
  created_at: string
}

interface TestSuite {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e'
  test_cases: TestCase[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  coverage_target: number
  results: {
    total_tests: number
    passed_tests: number
    failed_tests: number
    skipped_tests: number
    coverage_percentage: number
    execution_time_ms: number
    errors: string[]
  }
}

interface TestExecutionSession {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  test_suites: TestSuite[]
  start_time: string
  end_time?: string
  overall_results: {
    total_tests: number
    passed_tests: number
    failed_tests: number
    skipped_tests: number
    coverage_percentage: number
    execution_time_ms: number
  }
}

export function TestingView({ sessionId }: TestingViewProps) {
  const [session, setSession] = useState<TestExecutionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set())
  const [executionConfig, setExecutionConfig] = useState({
    framework: 'vitest' as const,
    parallel_execution: true,
    coverage_enabled: true,
    retry_failed_tests: true
  })

  useEffect(() => {
    fetchTestData()
  }, [sessionId])

  const fetchTestData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/testing/${sessionId}`)
      const data = await response.json()

      if (response.ok) {
        setSession(data.session)
      } else {
        setError(data.error || 'Failed to fetch test data')
      }
    } catch (err) {
      setError('Network error while fetching test data')
      console.error('Failed to fetch test data:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateTests = async () => {
    try {
      setExecuting(true)
      setError(null)

      const response = await fetch(`/api/testing/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_tests',
          config: {
            include_unit_tests: true,
            include_integration_tests: true,
            include_e2e_tests: true,
            pria_compliance_tests: true,
            coverage_threshold: 80
          }
        })
      })

      const data = await response.json()
      if (response.ok) {
        setSession(data.session)
      } else {
        setError(data.error || 'Failed to generate tests')
      }
    } catch (err) {
      setError('Network error during test generation')
      console.error('Failed to generate tests:', err)
    } finally {
      setExecuting(false)
    }
  }

  const executeTests = async (suiteId?: string) => {
    try {
      setExecuting(true)
      setError(null)

      const response = await fetch(`/api/testing/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_tests',
          suite_id: suiteId,
          config: executionConfig
        })
      })

      const data = await response.json()
      if (response.ok) {
        setSession(data.session)
        // Start polling for updates
        startExecutionPolling()
      } else {
        setError(data.error || 'Failed to execute tests')
      }
    } catch (err) {
      setError('Network error during test execution')
      console.error('Failed to execute tests:', err)
    } finally {
      setExecuting(false)
    }
  }

  const startExecutionPolling = () => {
    const interval = setInterval(async () => {
      if (session?.status === 'running') {
        await fetchTestData()
      } else {
        clearInterval(interval)
      }
    }, 2000)
  }

  const toggleSuiteExpansion = (suiteId: string) => {
    const newExpanded = new Set(expandedSuites)
    if (newExpanded.has(suiteId)) {
      newExpanded.delete(suiteId)
    } else {
      newExpanded.add(suiteId)
    }
    setExpandedSuites(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'skipped': return <Clock className="h-4 w-4 text-gray-400" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'skipped': case 'pending': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'unit': return <TestTube className="h-4 w-4" />
      case 'integration': return <Zap className="h-4 w-4" />
      case 'e2e': return <Target className="h-4 w-4" />
      case 'component': return <Beaker className="h-4 w-4" />
      case 'api': return <Shield className="h-4 w-4" />
      default: return <Bug className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading test data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={fetchTestData} className="mt-4" variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <TestTube className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Tests Generated Yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate comprehensive test suites to validate your application.
            </p>
            <Button onClick={generateTests} disabled={executing}>
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Beaker className="h-4 w-4 mr-2" />
              )}
              {executing ? 'Generating...' : 'Generate Tests'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Testing & Quality Assurance
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Automated test generation and execution with comprehensive coverage
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => executeTests()}
                disabled={executing || session.status === 'running'}
                variant="default"
              >
                {executing || session.status === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {session.status === 'running' ? 'Running...' : 'Run All Tests'}
              </Button>
              <Button
                onClick={generateTests}
                disabled={executing}
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </div>
        </CardHeader>

        {session.status === 'running' && (
          <CardContent>
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Tests are currently running. Results will update automatically.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tests</p>
                <p className="text-2xl font-bold">{session.overall_results.total_tests}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Passed</p>
                <p className="text-2xl font-bold text-green-600">{session.overall_results.passed_tests}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{session.overall_results.failed_tests}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Coverage</p>
                <p className="text-2xl font-bold">{Math.round(session.overall_results.coverage_percentage)}%</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
            <Progress value={session.overall_results.coverage_percentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Test Suites Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Test Suites</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {session.test_suites.map((suite) => (
                    <div key={suite.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(suite.type)}
                        <div>
                          <div className="font-medium">{suite.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {suite.test_cases.length} tests
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(suite.status)}>
                          {suite.status}
                        </Badge>
                        <Button
                          onClick={() => executeTests(suite.id)}
                          disabled={executing || session.status === 'running'}
                          size="sm"
                          variant="outline"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Execution Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Execution Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Started:</span>
                    <span>{new Date(session.start_time).toLocaleString()}</span>
                  </div>
                  {session.end_time && (
                    <div className="flex justify-between text-sm">
                      <span>Completed:</span>
                      <span>{new Date(session.end_time).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>Duration:</span>
                    <span>{Math.round(session.overall_results.execution_time_ms / 1000)}s</span>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Test Distribution</h4>
                    {session.test_suites.map((suite) => (
                      <div key={suite.id} className="flex justify-between text-sm">
                        <span>{suite.name}:</span>
                        <span>{suite.test_cases.length} tests</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suites" className="space-y-4">
          {session.test_suites.map((suite) => (
            <Card key={suite.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => toggleSuiteExpansion(suite.id)}
                      variant="ghost"
                      size="sm"
                    >
                      {expandedSuites.has(suite.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(suite.type)}
                      <CardTitle>{suite.name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(suite.status)}>
                      {suite.status}
                    </Badge>
                    <Button
                      onClick={() => executeTests(suite.id)}
                      disabled={executing || session.status === 'running'}
                      size="sm"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run Suite
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{suite.description}</p>
              </CardHeader>

              {expandedSuites.has(suite.id) && (
                <CardContent>
                  <div className="space-y-3">
                    {suite.test_cases.map((testCase) => (
                      <div key={testCase.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(testCase.status)}
                            <span className="font-medium">{testCase.name}</span>
                            <Badge className={getPriorityColor(testCase.priority)} variant="outline">
                              {testCase.priority}
                            </Badge>
                            <Badge variant="secondary">
                              {testCase.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{testCase.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{testCase.framework}</span>
                            <span>{testCase.assertions} assertions</span>
                            {testCase.execution_time_ms && (
                              <span>{testCase.execution_time_ms}ms</span>
                            )}
                            {testCase.coverage_percentage && (
                              <span>{Math.round(testCase.coverage_percentage)}% coverage</span>
                            )}
                          </div>
                          {testCase.error_message && (
                            <Alert className="mt-2">
                              <Bug className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                {testCase.error_message}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Coverage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(session.overall_results.coverage_percentage)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Overall Coverage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">85%</div>
                    <div className="text-sm text-muted-foreground">Target Coverage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">95%</div>
                    <div className="text-sm text-muted-foreground">Critical Paths</div>
                  </div>
                </div>
                <Progress value={session.overall_results.coverage_percentage} className="w-full" />
                <div className="text-sm text-muted-foreground">
                  Coverage includes unit tests, integration tests, and PRIA compliance validation
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {session.test_suites.flatMap(suite => 
                    suite.test_cases.map(testCase => (
                      <div key={testCase.id} className="flex items-center justify-between p-2 border-b">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(testCase.status)}
                          <span className="text-sm">{testCase.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {testCase.execution_time_ms && (
                            <span>{testCase.execution_time_ms}ms</span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {testCase.type}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}