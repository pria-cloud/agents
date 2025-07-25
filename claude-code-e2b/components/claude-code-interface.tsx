'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Code2, 
  MessageSquare, 
  Users, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  GitBranch,
  PlayCircle
} from 'lucide-react'
import { RequirementChat } from './requirement-chat'
import { ProgressSidebar } from './progress-sidebar'
import { LivePreview } from './live-preview'
import { DeveloperInterface } from './developer-interface'
import { useClaudeSession } from '../hooks/use-claude-session'

interface ClaudeCodeInterfaceProps {
  workspaceId: string
  userId: string
  sessionId?: string
  onSessionCreated?: (sessionId: string) => void
}

export function ClaudeCodeInterface({ 
  workspaceId, 
  userId, 
  sessionId,
  onSessionCreated 
}: ClaudeCodeInterfaceProps) {
  const [mode, setMode] = useState<'business' | 'developer'>('business')
  const [isInitializing, setIsInitializing] = useState(!sessionId)
  const [error, setError] = useState<string | null>(null)

  const { session, progress, isLoading, error: sessionError } = useClaudeSession(sessionId)

  useEffect(() => {
    if (sessionError) {
      setError(sessionError)
    }
  }, [sessionError])

  const handleModeSelection = (selectedMode: 'business' | 'developer') => {
    setMode(selectedMode)
    if (!sessionId) {
      createNewSession(selectedMode)
    }
  }

  const createNewSession = async (userMode: 'business' | 'developer') => {
    setIsInitializing(true)
    setError(null)

    try {
      const response = await fetch('/api/claude-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          user_id: userId,
          mode: userMode
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      onSessionCreated?.(data.session_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize session')
    } finally {
      setIsInitializing(false)
    }
  }

  // Mode selection screen
  if (!sessionId && !isInitializing) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4\">
        <Card className=\"w-full max-w-4xl\">
          <CardHeader className=\"text-center\">
            <CardTitle className=\"text-3xl font-bold flex items-center justify-center gap-3\">
              <Code2 className=\"h-8 w-8 text-blue-600\" />
              Claude Code E2B
            </CardTitle>
            <p className=\"text-muted-foreground text-lg mt-2\">
              Choose your experience level to get started with AI-powered application development
            </p>
          </CardHeader>
          <CardContent>
            <div className=\"grid md:grid-cols-2 gap-6\">
              {/* Business User Mode */}
              <Card 
                className=\"cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500\"
                onClick={() => handleModeSelection('business')}
              >
                <CardContent className=\"p-6\">
                  <div className=\"text-center space-y-4\">
                    <div className=\"mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center\">
                      <Users className=\"h-8 w-8 text-green-600\" />
                    </div>
                    <h3 className=\"text-xl font-semibold\">Business User</h3>
                    <p className=\"text-muted-foreground\">
                      Perfect for non-technical users who want to create applications through conversation
                    </p>
                    <div className=\"space-y-2 text-sm\">
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-green-500\" />
                        <span>Conversational interface</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-green-500\" />
                        <span>Live preview updates</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-green-500\" />
                        <span>Approval-based workflow</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-green-500\" />
                        <span>No coding required</span>
                      </div>
                    </div>
                    <Button className=\"w-full\">
                      Get Started
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Developer Mode */}
              <Card 
                className=\"cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-500\"
                onClick={() => handleModeSelection('developer')}
              >
                <CardContent className=\"p-6\">
                  <div className=\"text-center space-y-4\">
                    <div className=\"mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center\">
                      <Code2 className=\"h-8 w-8 text-purple-600\" />
                    </div>
                    <h3 className=\"text-xl font-semibold\">Developer</h3>
                    <p className=\"text-muted-foreground\">
                      Full development environment with direct code access and advanced controls
                    </p>
                    <div className=\"space-y-2 text-sm\">
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-purple-500\" />
                        <span>Code editor access</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-purple-500\" />
                        <span>Git integration</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-purple-500\" />
                        <span>Terminal access</span>
                      </div>
                      <div className=\"flex items-center gap-2\">
                        <CheckCircle className=\"h-4 w-4 text-purple-500\" />
                        <span>Full customization</span>
                      </div>
                    </div>
                    <Button className=\"w-full\" variant=\"outline\">
                      Get Started
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {error && (
              <Alert variant=\"destructive\" className=\"mt-6\">
                <AlertCircle className=\"h-4 w-4\" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading screen
  if (isInitializing || isLoading) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4\">
        <Card className=\"w-full max-w-md\">
          <CardContent className=\"p-8 text-center\">
            <Loader2 className=\"h-12 w-12 animate-spin mx-auto mb-4 text-blue-600\" />
            <h3 className=\"text-xl font-semibold mb-2\">Initializing Claude Code</h3>
            <p className=\"text-muted-foreground mb-4\">
              Setting up your {mode} environment...
            </p>
            <Progress value={33} className=\"w-full\" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !session) {
    return (
      <div className=\"min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4\">
        <Card className=\"w-full max-w-md\">
          <CardContent className=\"p-8 text-center\">
            <AlertCircle className=\"h-12 w-12 mx-auto mb-4 text-red-600\" />
            <h3 className=\"text-xl font-semibold mb-2\">Something went wrong</h3>
            <p className=\"text-muted-foreground mb-4\">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main interface
  return (
    <div className=\"min-h-screen bg-background\">
      {/* Header */}
      <div className=\"border-b bg-white\">
        <div className=\"container mx-auto px-4 py-4\">
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-3\">
              <Code2 className=\"h-8 w-8 text-blue-600\" />
              <div>
                <h1 className=\"text-2xl font-bold\">Claude Code E2B</h1>
                <p className=\"text-sm text-muted-foreground\">
                  {mode === 'business' ? 'Business User Mode' : 'Developer Mode'}
                </p>
              </div>
            </div>
            
            <div className=\"flex items-center gap-4\">
              {session && (
                <>
                  <Badge variant={getStatusVariant(session.status)} className=\"text-sm\">
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </Badge>
                  
                  {session.e2b_sandbox_url && (
                    <Button variant=\"outline\" size=\"sm\" onClick={() => window.open(session.e2b_sandbox_url, '_blank')}>
                      <Eye className=\"h-4 w-4 mr-2\" />
                      Preview
                    </Button>
                  )}
                  
                  <Button variant=\"outline\" size=\"sm\" onClick={() => setMode(mode === 'business' ? 'developer' : 'business')}>
                    Switch to {mode === 'business' ? 'Developer' : 'Business'} Mode
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className=\"container mx-auto px-4 py-6\">
        {mode === 'business' ? (
          <BusinessUserInterface 
            session={session}
            progress={progress}
            workspaceId={workspaceId}
            userId={userId}
          />
        ) : (
          <DeveloperInterface 
            session={session}
            progress={progress}
            workspaceId={workspaceId}
            userId={userId}
          />
        )}
      </div>
    </div>
  )
}

interface ModeInterfaceProps {
  session: any
  progress: any[]
  workspaceId: string
  userId: string
}

function BusinessUserInterface({ session, progress, workspaceId, userId }: ModeInterfaceProps) {
  return (
    <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
      <div className=\"lg:col-span-2 space-y-6\">
        <RequirementChat 
          sessionId={session?.id}
          mode=\"business\"
          workspaceId={workspaceId}
          userId={userId}
        />
      </div>
      <div className=\"space-y-6\">
        <ProgressSidebar 
          session={session}
          progress={progress}
          mode=\"business\"
        />
        {session?.e2b_sandbox_url && (
          <LivePreview 
            sandboxUrl={session.e2b_sandbox_url}
            status={session.status}
          />
        )}
      </div>
    </div>
  )
}

function getStatusVariant(status: string): \"default\" | \"secondary\" | \"destructive\" | \"outline\" {
  switch (status) {
    case 'completed':
      return 'default'
    case 'generating':
      return 'secondary'
    case 'reviewing':
      return 'outline'
    default:
      return 'secondary'
  }
}