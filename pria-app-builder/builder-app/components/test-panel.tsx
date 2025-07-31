'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Clock,
  Database,
  Zap,
  Code,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TestResult {
  type: 'health_check' | 'full_e2e_test'
  timestamp: string
  result: any
  summary?: {
    success: boolean
    duration: string
    completion: string
    issues: number
  }
  nextSteps?: string[]
}

interface TestPanelProps {
  className?: string
}

export function TestPanel({ className }: TestPanelProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentTest, setCurrentTest] = useState<'health' | 'full' | null>(null)
  const [results, setResults] = useState<TestResult | null>(null)
  const [progress, setProgress] = useState(0)

  const runTest = async (testType: 'health' | 'full') => {
    setIsRunning(true)
    setCurrentTest(testType)
    setResults(null)
    setProgress(0)

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const response = await fetch('/api/test/e2e', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType,
          config: {
            logLevel: 'info'
          }
        }),
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const testResults = await response.json()
      setResults(testResults)

    } catch (error) {
      console.error('Test execution failed:', error)
      setResults({
        type: testType === 'health' ? 'health_check' : 'full_e2e_test',
        timestamp: new Date().toISOString(),
        result: {
          healthy: false,
          issues: [error instanceof Error ? error.message : 'Unknown error']
        }
      })
    } finally {
      setIsRunning(false)
      setCurrentTest(null)
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <XCircle className="w-5 h-5 text-red-600" />
    )
  }

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? "Passed" : "Failed"}
      </Badge>
    )
  }

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <CardTitle>E2E Testing Panel</CardTitle>
        </div>
        <CardDescription>
          Test the complete PRIA App Builder workflow and integrations
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Test Controls */}
        <div className="flex gap-2">
          <Button
            onClick={() => runTest('health')}
            disabled={isRunning}
            variant="outline"
            className="flex-1"
          >
            {isRunning && currentTest === 'health' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Database className="w-4 h-4 mr-2" />
            )}
            Health Check
          </Button>
          
          <Button
            onClick={() => runTest('full')}
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning && currentTest === 'full' ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Full E2E Test
          </Button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Running {currentTest === 'health' ? 'health check' : 'full workflow test'}...
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Test Results */}
        {results && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <div className="flex items-center gap-2">
                {results.type === 'health_check' ? (
                  getStatusIcon(results.result.healthy)
                ) : (
                  getStatusIcon(results.summary?.success || false)
                )}
                {results.type === 'health_check' ? (
                  getStatusBadge(results.result.healthy)
                ) : (
                  getStatusBadge(results.summary?.success || false)
                )}
              </div>
            </div>

            {/* Health Check Results */}
            {results.type === 'health_check' && (
              <div className="space-y-3">
                {results.result.healthy ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>System Healthy</AlertTitle>
                    <AlertDescription>
                      All required services and configurations are working properly.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Issues Detected</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {results.result.issues.map((issue: string, index: number) => (
                          <li key={index} className="text-sm">{issue}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Full E2E Test Results */}
            {results.type === 'full_e2e_test' && results.summary && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-medium">{results.summary.duration}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completion:</span>
                    <span className="ml-2 font-medium">{results.summary.completion}</span>
                  </div>
                </div>

                {/* Step Results */}
                {results.result.steps && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Test Steps:</h4>
                    <div className="space-y-1">
                      {results.result.steps.map((step: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center gap-2">
                            {step.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm">{step.step}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {step.duration}ms
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {results.result.errors && results.result.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Errors ({results.result.errors.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {results.result.errors.map((error: string, index: number) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings */}
                {results.result.warnings && results.result.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings ({results.result.warnings.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        {results.result.warnings.map((warning: string, index: number) => (
                          <li key={index} className="text-sm">{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Next Steps */}
            {results.nextSteps && (
              <div className="space-y-2">
                <h4 className="font-medium">Next Steps:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {results.nextSteps.map((step: string, index: number) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-muted-foreground border-t pt-2">
              Test completed at: {new Date(results.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {/* Help Text */}
        {!results && !isRunning && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Health Check:</strong> Quickly validates environment variables and basic connectivity.</p>
            <p><strong>Full E2E Test:</strong> Complete workflow test including workspace creation, E2B sandbox, Claude integration, and file operations.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Hook for programmatic testing
export function useE2ETesting() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResult | null>(null)

  const runTest = async (testType: 'health' | 'full') => {
    setIsRunning(true)
    setResults(null)

    try {
      const response = await fetch('/api/test/e2e', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const testResults = await response.json()
      setResults(testResults)
      return testResults

    } catch (error) {
      const errorResult: TestResult = {
        type: testType === 'health' ? 'health_check' : 'full_e2e_test',
        timestamp: new Date().toISOString(),
        result: {
          healthy: false,
          issues: [error instanceof Error ? error.message : 'Unknown error']
        }
      }
      setResults(errorResult)
      return errorResult
    } finally {
      setIsRunning(false)
    }
  }

  return {
    isRunning,
    results,
    runHealthCheck: () => runTest('health'),
    runFullTest: () => runTest('full')
  }
}