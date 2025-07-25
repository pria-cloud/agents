'use client'

import { useState } from 'react'
import { ClaudeCodeInterface } from '@/components/claude-code/claude-code-interface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Code2, TestTube, Database, Zap } from 'lucide-react'

export default function TestPage() {
  const [currentSession, setCurrentSession] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])

  const runTests = async () => {
    const tests = [
      {
        name: 'Database Connection',
        test: async () => {
          const response = await fetch('/api/claude-sessions')
          return response.ok
        }
      },
      {
        name: 'Session Creation',
        test: async () => {
          const response = await fetch('/api/claude-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'business', requirements: { test: true } })
          })
          const data = await response.json()
          if (data.session_id) {
            setCurrentSession(data.session_id)
            return true
          }
          return false
        }
      },
      {
        name: 'Chat API',
        test: async () => {
          if (!currentSession) return false
          const response = await fetch(`/api/claude-sessions/${currentSession}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: currentSession,
              user_input: 'Test chat message'
            })
          })
          return response.ok
        }
      }
    ]

    const results = []
    for (const test of tests) {
      try {
        const passed = await test.test()
        results.push({ name: test.name, passed, error: null })
      } catch (error) {
        results.push({ name: test.name, passed: false, error: error.message })
      }
    }

    setTestResults(results)
  }

  if (currentSession === 'start') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TestTube className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold">Claude Code E2B Test</h1>
                <p className="text-muted-foreground">New Session - Mode Selection</p>
              </div>
            </div>
            <Button onClick={() => setCurrentSession(null)} variant="outline">
              Back to Tests
            </Button>
          </div>

          <ClaudeCodeInterface
            workspaceId={process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID || ''}
            userId={process.env.NEXT_PUBLIC_TEST_USER_ID || ''}
            onSessionCreated={setCurrentSession}
          />
        </div>
      </div>
    )
  }

  if (currentSession && currentSession !== 'start') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TestTube className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold">Claude Code E2B Test</h1>
                <p className="text-muted-foreground">Session: {currentSession}</p>
              </div>
            </div>
            <Button onClick={() => setCurrentSession(null)} variant="outline">
              Back to Tests
            </Button>
          </div>

          <ClaudeCodeInterface
            workspaceId={process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID || ''}
            userId={process.env.NEXT_PUBLIC_TEST_USER_ID || ''}
            sessionId={currentSession}
            onSessionCreated={setCurrentSession}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <TestTube className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold">Claude Code E2B Test Environment</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Test the Claude Code E2B integration before PRIA deployment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-semibold">Database</h3>
              <p className="text-sm text-muted-foreground">Supabase integration</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Code2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Components</h3>
              <p className="text-sm text-muted-foreground">React UI components</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-semibold">Real-time</h3>
              <p className="text-sm text-muted-foreground">Live progress updates</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <TestTube className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <h3 className="font-semibold">API Routes</h3>
              <p className="text-sm text-muted-foreground">Backend endpoints</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                System Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runTests} className="w-full" size="lg">
                Run Integration Tests
              </Button>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <span className="font-medium">{result.name}</span>
                      <Badge variant={result.passed ? 'default' : 'destructive'}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Manual Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Test the full Claude Code E2B experience
              </p>

              <Button 
                onClick={() => setCurrentSession('start')} 
                className="w-full" 
                size="lg"
                variant="outline"
              >
                Start New Session
              </Button>

              <div className="text-sm space-y-2">
                <h4 className="font-medium">Test Scenarios:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Business mode conversation flow</li>
                  <li>Developer mode interface</li>
                  <li>Real-time progress updates</li>
                  <li>Mode switching</li>
                  <li>Error handling</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Environment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Template ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {process.env.NEXT_PUBLIC_E2B_TEMPLATE_ID || 'Not set'}
                </div>
              </div>
              <div>
                <div className="font-medium">Workspace ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID || 'Not set'}
                </div>
              </div>
              <div>
                <div className="font-medium">User ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {process.env.NEXT_PUBLIC_TEST_USER_ID || 'Not set'}
                </div>
              </div>
              <div>
                <div className="font-medium">Testing Mode</div>
                <div className="text-muted-foreground">
                  Mock (UI components only)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
