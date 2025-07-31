'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatInterface } from '@/components/chat'
import { PreviewTabs } from '@/components/preview'
import { ClaudeInteractionPanel, ClaudeStatusIndicator, ClaudeContextSync } from '@/components/claude'
import { ChatMessage, Requirement, TechnicalSpec, Workspace, Project, Session } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRouter } from 'next/navigation'
import { targetAppRegistry } from '@/lib/e2b/target-app-client'
import { ErrorBoundary } from '@/components/error-boundary'
import { PageLoading, SandboxLoading, LoadingWrapper } from '@/components/loading-states'
import { TestPanel } from '@/components/test-panel'
import { ProjectSessionSelector } from '@/components/project-session-selector'

export default function DashboardPage() {
  // Minimal state - no auto-selection, no cascading effects
  const [user, setUser] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)
  const [initializationStep, setInitializationStep] = useState(0)
  const [sandboxStage, setSandboxStage] = useState<'initializing' | 'creating' | 'installing' | 'configuring' | 'ready'>('initializing')
  
  // Current selections - only set by explicit user actions
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // E2B and file state
  const [projectFiles, setProjectFiles] = useState<Array<{
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
  }>>([])
  const [sandboxStatus, setSandboxStatus] = useState<string>('not_created')
  const [isWatchingFiles, setIsWatchingFiles] = useState(false)
  
  // Requirements and specifications state
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [technicalSpecs, setTechnicalSpecs] = useState<TechnicalSpec[]>([])
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false)
  
  // Testing mode
  const [showTestingPanel, setShowTestingPanel] = useState(false)
  
  // Target App initialization state
  const [isTargetAppInitialized, setIsTargetAppInitialized] = useState(false)
  const [targetAppInitError, setTargetAppInitError] = useState<string>('')
  
  // Claude Code SDK state
  const [claudeStatus, setClaudeStatus] = useState<'ready' | 'error' | 'loading' | 'inactive'>('inactive')
  const [currentPhase, setCurrentPhase] = useState(1)
  const [subagentRole, setSubagentRole] = useState('requirements-analyst')
  const [showClaudeInterface, setShowClaudeInterface] = useState(false)
  
  // Cleanup refs for intervals
  const filePollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Authentication and initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setInitializationStep(0)
        setIsInitializing(true)

        // Step 1: Check authentication
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)
        setInitializationStep(1)
        
        // Step 2: Initialize app state
        await new Promise(resolve => setTimeout(resolve, 500)) // Simulate setup time
        setInitializationStep(2)
        
        setIsInitializing(false)
      } catch (error) {
        console.error('App initialization failed:', error)
        setError('Failed to initialize application')
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [router, supabase.auth])

  // Helper functions - declared before useEffect
  const loadMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/claude/chat?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const initializeTargetApp = async (sessionId: string) => {
    try {
      setTargetAppInitError('')
      setSandboxStatus('initializing')
      
      const targetAppClient = targetAppRegistry.getClient(sessionId, currentSession?.workspace_id)
      
      // Initialize the E2B sandbox and Target App structure
      await targetAppClient.initializeSandbox()
      
      setIsTargetAppInitialized(true)
      setSandboxStatus('ready')
      
      // Load initial project state
      await loadProjectState(sessionId)
    } catch (error) {
      console.error('Failed to initialize Target App:', error)
      setTargetAppInitError(error instanceof Error ? error.message : 'Failed to initialize Target App')
      setSandboxStatus('error')
      setIsTargetAppInitialized(false)
    }
  }

  const loadProjectState = async (sessionId: string) => {
    try {
      const targetAppClient = targetAppRegistry.getClient(sessionId, currentSession?.workspace_id)
      const projectState = await targetAppClient.getProjectState()
      setProjectFiles(projectState.files)
      setSandboxStatus(projectState.status)
    } catch (error) {
      console.error('Failed to load project state:', error)
      setSandboxStatus('error')
    }
  }

  const loadRequirements = async (sessionId: string) => {
    try {
      setIsLoadingRequirements(true)
      const response = await fetch(`/api/requirements/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setRequirements(data.requirements || [])
      }
    } catch (error) {
      console.error('Failed to load requirements:', error)
    } finally {
      setIsLoadingRequirements(false)
    }
  }

  const loadTechnicalSpecs = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/technical-specs/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setTechnicalSpecs(data.technicalSpecs || [])
      }
    } catch (error) {
      console.error('Failed to load technical specifications:', error)
    }
  }

  const handleAddRequirement = async () => {
    // For now, just trigger a reload of requirements
    // Later this could open a modal for manual requirement entry
    if (currentSession?.id) {
      await loadRequirements(currentSession.id)
    }
  }

  const handleEditRequirement = async (requirement: Requirement) => {
    // For now, just log - later this could open an edit modal
    console.log('Edit requirement:', requirement)
  }

  const handleDeleteRequirement = async (requirementId: string) => {
    if (!currentSession?.id) return
    
    try {
      const response = await fetch(`/api/requirements/${currentSession.id}/${requirementId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from local state
        setRequirements(prev => prev.filter(req => req.id !== requirementId))
      }
    } catch (error) {
      console.error('Failed to delete requirement:', error)
    }
  }

  const handleUpdateRequirementStatus = async (requirementId: string, status: Requirement['status']) => {
    if (!currentSession?.id) return
    
    try {
      const response = await fetch(`/api/requirements/${currentSession.id}/${requirementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        // Update local state
        setRequirements(prev => prev.map(req => 
          req.id === requirementId ? { ...req, status } : req
        ))
      }
    } catch (error) {
      console.error('Failed to update requirement status:', error)
    }
  }

  // Cleanup function for polling
  const stopFileEventPolling = useCallback(() => {
    if (filePollingIntervalRef.current) {
      clearInterval(filePollingIntervalRef.current)
      filePollingIntervalRef.current = null
    }
  }, [])

  const startFileEventPolling = useCallback((sessionId: string) => {
    // Clear existing interval if any
    stopFileEventPolling()

    // Start new polling interval
    filePollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/e2b/watch?sessionId=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.events && data.events.length > 0) {
            // Refresh project files when changes detected
            loadProjectState(sessionId)
          }
        }
      } catch (error) {
        console.error('File event polling error:', error)
      }
    }, 5000) // Poll every 5 seconds (reduced frequency)
  }, [stopFileEventPolling])

  const startFileWatching = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch('/api/e2b/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          action: 'start_watch'
        })
      })
      
      if (response.ok) {
        setIsWatchingFiles(true)
        // Start polling for file changes
        startFileEventPolling(sessionId)
      }
    } catch (error) {
      console.error('Failed to start file watching:', error)
    }
  }, [startFileEventPolling])

  // Initialize Target App and load data when session is selected
  useEffect(() => {
    if (currentSession?.id) {
      // Reset state for new session
      setIsTargetAppInitialized(false)
      setTargetAppInitError('')
      
      // Load messages
      loadMessages(currentSession.id)
      
      // Load requirements and specifications
      loadRequirements(currentSession.id)
      loadTechnicalSpecs(currentSession.id)
      
      // Initialize Target App (E2B sandbox + Claude Code SDK)
      initializeTargetApp(currentSession.id)
      
      // Start file watching (will work after Target App is initialized)
      startFileWatching(currentSession.id)
    } else {
      // Clean up when no session
      stopFileEventPolling()
      setMessages([])
      setProjectFiles([])
      setRequirements([])
      setTechnicalSpecs([])
      setSandboxStatus('not_created')
      setIsWatchingFiles(false)
      setIsTargetAppInitialized(false)
      setTargetAppInitError('')
    }

    // Cleanup function for when component unmounts or session changes
    return () => {
      stopFileEventPolling()
    }
  }, [currentSession?.id, startFileWatching, stopFileEventPolling])

  const handleCreateCompleteSetup = async () => {
    try {
      setIsCreating(true)
      setError('')
      setSandboxStage('initializing')
      
      // Step 1: Create workspace
      setSandboxStage('creating')
      const workspaceResponse = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'My First Workspace',
          description: 'Default workspace for getting started'
        }),
      })
      
      if (!workspaceResponse.ok) {
        const errorText = await workspaceResponse.text()
        console.error('Workspace creation failed:', workspaceResponse.status, errorText)
        throw new Error(`Failed to create workspace: ${workspaceResponse.status} - ${errorText}`)
      }
      
      const { workspace } = await workspaceResponse.json()
      
      // Step 2: Create project
      setSandboxStage('installing')
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: 'My First App',
          description: 'A demo application to get started'
        }),
      })
      
      if (!projectResponse.ok) {
        throw new Error('Failed to create project')
      }
      
      const { project } = await projectResponse.json()
      
      // Step 3: Create session
      setSandboxStage('configuring')
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          name: 'Getting Started',
          description: 'Initial session to explore PRIA App Builder'
        }),
      })
      
      if (!sessionResponse.ok) {
        throw new Error('Failed to create session')
      }
      
      const { session } = await sessionResponse.json()
      
      // Final step: Set ready state
      setSandboxStage('ready')
      await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause to show ready state
      
      // Set all selections
      setCurrentWorkspace(workspace)
      setCurrentProject(project)
      setCurrentSession(session)
      
    } catch (error) {
      console.error('Failed to create setup:', error)
      setError('Failed to create workspace. Please check your database connection.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!currentSession?.id) return
    
    // Check if Target App is initialized
    if (!isTargetAppInitialized) {
      console.warn('Target App not initialized yet. Initializing now...')
      await initializeTargetApp(currentSession.id)
      
      // If still not initialized, show error
      if (!isTargetAppInitialized) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          workspace_id: currentSession.workspace_id,
          session_id: currentSession.id,
          role: 'system',
          content: 'Target App initialization failed. Please try again or check your E2B configuration.',
          metadata: { error: true },
          created_at: new Date().toISOString()
        }])
        return
      }
    }
    
    setIsStreaming(true)
    setIsChatLoading(true)
    
    try {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        workspace_id: currentSession.workspace_id,
        session_id: currentSession.id,
        role: 'user',
        content,
        metadata: {},
        created_at: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, userMessage])

      // Create placeholder assistant message for streaming
      const assistantMessageId = Date.now().toString() + Math.random()
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        workspace_id: currentSession.workspace_id,
        session_id: currentSession.id,
        role: 'assistant',
        content: '',
        metadata: { streaming: true },
        created_at: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, assistantMessage])

      // Use streaming API for real-time Claude Code execution
      const response = await fetch('/api/claude/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSession.id,
          message: content
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start streaming')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Response body is null')
      }

      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              switch (data.type) {
                case 'start':
                  // Update message to show starting
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: '🔄 Starting Claude Code execution...' }
                      : msg
                  ))
                  break
                
                case 'command':
                  // Show command being executed
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: `🛠️ Executing: ${data.command}\n\n${data.message}` }
                      : msg
                  ))
                  break
                
                case 'command_output':
                  // Show command output
                  if (data.stdout) {
                    accumulatedContent += `\n\n**Command Output:**\n\`\`\`\n${data.stdout}\n\`\`\``
                  }
                  if (data.stderr) {
                    accumulatedContent += `\n\n**Errors:**\n\`\`\`\n${data.stderr}\n\`\`\``
                  }
                  break
                
                case 'message':
                  // Final Claude response
                  accumulatedContent = data.content || ''
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          content: accumulatedContent,
                          metadata: { 
                            ...data.metadata,
                            streaming: false,
                            command_executed: data.metadata?.command_executed
                          }
                        }
                      : msg
                  ))
                  
                  // If requirements were extracted, reload requirements
                  if (data.metadata?.extracted_requirements > 0) {
                    loadRequirements(currentSession.id)
                  }
                  
                  // If technical specs were extracted, reload technical specs
                  if (data.metadata?.extracted_technical_specs > 0) {
                    loadTechnicalSpecs(currentSession.id)
                  }
                  break
                
                case 'project_update':
                  // Update project files
                  setProjectFiles(data.files || [])
                  setSandboxStatus(data.status || 'ready')
                  break
                
                case 'requirements_extracted':
                  // Real-time requirements update
                  console.log(`Extracted ${data.count} requirements`)
                  await loadRequirements(currentSession.id)
                  break
                
                case 'technical_specs_extracted':
                  // Real-time technical specs update
                  console.log(`Extracted ${data.count} technical specifications`)
                  await loadTechnicalSpecs(currentSession.id)
                  break
                
                case 'pria_compliance_warning':
                  // Show PRIA compliance warning
                  console.warn('PRIA Compliance Warning:', data.message)
                  break
                
                case 'error':
                  accumulatedContent = `❌ Error: ${data.error}`
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: accumulatedContent, metadata: { error: true, streaming: false } }
                      : msg
                  ))
                  break
                
                case 'done':
                  // Final completion
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, metadata: { ...msg.metadata, streaming: false } }
                      : msg
                  ))
                  break
              }
            } catch (error) {
              console.error('Failed to parse streaming data:', error)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error)
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        workspace_id: currentSession.workspace_id,
        session_id: currentSession.id,
        role: 'system',
        content: 'Sorry, there was an error sending your message. Please try again.',
        metadata: { error: true },
        created_at: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
      setIsChatLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Project/Session selector handlers
  const handleWorkspaceChange = (workspace: Workspace) => {
    setCurrentWorkspace(workspace)
    // Reset project and session when workspace changes
    setCurrentProject(null)
    setCurrentSession(null)
  }

  const handleProjectChange = (project: Project) => {
    setCurrentProject(project)
    // Reset session when project changes
    setCurrentSession(null)
  }

  const handleSessionChange = (session: Session) => {
    setCurrentSession(session)
  }

  // Claude interaction handlers
  const handleClaudeContextSync = useCallback(() => {
    // Reload requirements and specs after context sync
    if (currentSession?.id) {
      loadRequirements(currentSession.id)
      loadTechnicalSpecs(currentSession.id)
    }
  }, [currentSession?.id])

  const handleClaudeArtifactsUpdate = useCallback((artifacts: string[]) => {
    // Handle artifacts update from Claude
    console.log('Claude artifacts updated:', artifacts)
    if (currentSession?.id) {
      loadProjectState(currentSession.id)
    }
  }, [currentSession?.id])

  const handleClaudeStatusChange = useCallback((status: 'ready' | 'error' | 'loading' | 'inactive') => {
    setClaudeStatus(status)
  }, [])

  // Show loading during initialization
  if (isInitializing) {
    return (
      <PageLoading 
        title="Loading PRIA App Builder"
        description="Initializing your development environment..."
        steps={[
          "Checking authentication...",
          "Loading user preferences...",
          "Setting up workspace..."
        ]}
        currentStep={initializationStep}
        progress={((initializationStep + 1) / 3) * 100}
      />
    )
  }

  if (!user) {
    return (
      <PageLoading 
        title="Authenticating"
        description="Redirecting to login..."
      />
    )
  }

  if (!currentSession) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              PRIA App Builder
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build applications with Claude Code AI assistance
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center">
          {isCreating ? (
            <SandboxLoading stage={sandboxStage} />
          ) : (
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-4">Welcome to PRIA App Builder</h2>
              <p className="text-muted-foreground mb-6">
                Click the button below to create your workspace, project, and session in one step.
              </p>
              {error && (
                <ErrorBoundary level="section" isolate>
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                    {error}
                  </div>
                </ErrorBoundary>
              )}
              <Button 
                onClick={handleCreateCompleteSetup} 
                disabled={isCreating}
                size="lg"
              >
                {isCreating ? "Creating..." : "Get Started"}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary level="page" onError={(error, errorInfo) => {
      console.error('Dashboard page error:', error, errorInfo)
    }}>
      <div className="flex flex-col h-screen bg-background">
        <header className="border-b px-6 py-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                PRIA App Builder
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Build applications with Claude Code AI assistance
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Project/Session Selector */}
              <ProjectSessionSelector
                currentWorkspace={currentWorkspace}
                currentProject={currentProject}
                currentSession={currentSession}
                onWorkspaceChange={handleWorkspaceChange}
                onProjectChange={handleProjectChange}
                onSessionChange={handleSessionChange}
                onCreateNew={handleCreateCompleteSetup}
              />
              
              {/* Status Information */}
              <div className="text-xs text-muted-foreground">
                Target App: <span className={
                  sandboxStatus === 'ready' && isTargetAppInitialized ? 'text-green-600' : 
                  sandboxStatus === 'initializing' ? 'text-blue-600' : 
                  sandboxStatus === 'error' ? 'text-red-600' : 'text-yellow-600'
                }>
                  {sandboxStatus === 'initializing' ? 'Initializing...' : 
                   sandboxStatus === 'ready' && isTargetAppInitialized ? 'Ready' :
                   sandboxStatus === 'error' ? 'Error' : 'Not Ready'}
                </span>
                {isWatchingFiles && ' • 👁️ Watching files'}
                {isStreaming && ' • 🔄 Streaming...'}
                {targetAppInitError && ' • ❌ ' + targetAppInitError}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant={showTestingPanel ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowTestingPanel(!showTestingPanel)}
              >
                {showTestingPanel ? 'Hide Tests' : 'E2E Tests'}
              </Button>
              <Button 
                variant={showClaudeInterface ? "default" : "outline"} 
                size="sm"
                onClick={() => setShowClaudeInterface(!showClaudeInterface)}
              >
                {showClaudeInterface ? 'Hide Claude' : 'Claude SDK'}
              </Button>
            </div>
          </div>
        </header>
        
        {showTestingPanel ? (
          /* Testing Panel Mode */
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
            <ErrorBoundary level="section" isolate>
              <TestPanel className="w-full max-w-4xl" />
            </ErrorBoundary>
          </div>
        ) : (
          /* Normal Development Mode */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane - Chat Interface */}
            <ErrorBoundary level="section" isolate>
              <div className="w-1/2 border-r border-border">
                <LoadingWrapper 
                  loading={!currentSession?.id} 
                  loadingComponent={<div className="p-8 text-center">Loading interface...</div>}
                >
                  {showClaudeInterface ? (
                    /* Claude Code SDK Interface */
                    <div className="h-full flex flex-col">
                      <div className="p-4 border-b">
                        <ClaudeStatusIndicator
                          sessionId={currentSession.id}
                          onStatusChange={handleClaudeStatusChange}
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ClaudeInteractionPanel
                          sessionId={currentSession.id}
                          workspaceId={currentSession.workspace_id}
                          currentPhase={currentPhase}
                          subagentRole={subagentRole}
                          onContextSync={handleClaudeContextSync}
                          onArtifactsUpdate={handleClaudeArtifactsUpdate}
                          className="h-full"
                        />
                      </div>
                      <div className="p-4 border-t">
                        <ClaudeContextSync
                          sessionId={currentSession.id}
                          workspaceId={currentSession.workspace_id}
                          currentPhase={currentPhase}
                          subagentRole={subagentRole}
                          onSyncComplete={handleClaudeContextSync}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Traditional Chat Interface */
                    <ChatInterface
                      sessionId={currentSession.id}
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isLoading={isChatLoading}
                      disabled={!isTargetAppInitialized || sandboxStatus !== 'ready'}
                    />
                  )}
                </LoadingWrapper>
              </div>
            </ErrorBoundary>

            {/* Right Pane - Preview Tabs */}
            <ErrorBoundary level="section" isolate>
              <div className="w-1/2">
                <LoadingWrapper 
                  loading={!currentSession?.id}
                  loadingComponent={<div className="p-8 text-center">Loading preview...</div>}
                >
                  <PreviewTabs
                    sessionId={currentSession.id}
                    files={projectFiles}
                    requirements={requirements}
                    technicalSpecs={technicalSpecs}
                    previewUrl={sandboxStatus === 'ready' && currentSession?.id ? 
                      targetAppRegistry.getClient(currentSession.id, currentSession.workspace_id).getPreviewUrlSync() : 
                      undefined}
                    onRefreshFiles={async () => {
                      if (currentSession?.id) {
                        await loadProjectState(currentSession.id)
                      }
                    }}
                    onRefreshPreview={async () => {
                      if (currentSession?.id) {
                        await loadProjectState(currentSession.id)
                      }
                    }}
                    onAddRequirement={handleAddRequirement}
                    onEditRequirement={handleEditRequirement}
                    onDeleteRequirement={handleDeleteRequirement}
                    onUpdateRequirementStatus={handleUpdateRequirementStatus}
                    onAddTechnicalSpec={() => {}}
                    onEditTechnicalSpec={() => {}}
                    onDeleteTechnicalSpec={() => {}}
                    onViewTechnicalSpec={() => {}}
                  />
                </LoadingWrapper>
              </div>
            </ErrorBoundary>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}