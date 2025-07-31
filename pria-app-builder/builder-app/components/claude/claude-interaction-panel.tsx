'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Code, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeInteractionPanelProps {
  sessionId: string
  workspaceId: string
  currentPhase: number
  subagentRole: string
  onContextSync?: () => void
  onArtifactsUpdate?: (artifacts: string[]) => void
  className?: string
}

interface Message {
  id: string
  type: 'user' | 'claude' | 'system'
  content: string
  timestamp: Date
  artifacts?: string[]
  phase?: number
  subagentRole?: string
  success?: boolean
  error?: string
}

interface InteractionOptions {
  maxTurns: number
  syncContext: boolean
  includeArtifacts: boolean
  contextFiles: string[]
}

export function ClaudeInteractionPanel({
  sessionId,
  workspaceId,
  currentPhase,
  subagentRole,
  onContextSync,
  onArtifactsUpdate,
  className
}: ClaudeInteractionPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [targetAppStatus, setTargetAppStatus] = useState<'not_initialized' | 'initializing' | 'ready' | 'error'>('not_initialized')
  const [options, setOptions] = useState<InteractionOptions>({
    maxTurns: 1,
    syncContext: true,
    includeArtifacts: true,
    contextFiles: []
  })
  const [showOptions, setShowOptions] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Check if Target App is initialized
    checkTargetAppStatus()
  }, [sessionId])

  const checkTargetAppStatus = async () => {
    try {
      const response = await fetch(`/api/claude-sdk/sync?sessionId=${sessionId}`)
      const data = await response.json()
      
      if (data.success && data.status.sandboxActive) {
        setTargetAppStatus('ready')
      } else {
        setTargetAppStatus('not_initialized')
      }
    } catch (error) {
      console.error('Failed to check Target App status:', error)
      setTargetAppStatus('error')
    }
  }

  const initializeTargetApp = async () => {
    setIsInitializing(true)
    setTargetAppStatus('initializing')
    
    try {
      const response = await fetch('/api/claude-sdk/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          projectName: `Session ${sessionId}`,
          initialRequirements: []
        })
      })

      const data = await response.json()

      if (data.success) {
        setTargetAppStatus('ready')
        
        // Add welcome message from Claude
        const welcomeMessage: Message = {
          id: `claude-${Date.now()}`,
          type: 'claude',
          content: data.claudeResponse || 'Target App initialized successfully! I\'m ready to assist with your project.',
          timestamp: new Date(),
          phase: currentPhase,
          subagentRole,
          success: true
        }
        
        setMessages([welcomeMessage])
        
        // Add system message about initialization
        const systemMessage: Message = {
          id: `system-${Date.now()}`,
          type: 'system',
          content: `Target App initialized with sandbox ID: ${data.sandboxId}`,
          timestamp: new Date()
        }
        
        setMessages(prev => [...prev, systemMessage])
        
      } else {
        setTargetAppStatus('error')
        const errorMessage: Message = {
          id: `system-error-${Date.now()}`,
          type: 'system',
          content: `Failed to initialize Target App: ${data.error}`,
          timestamp: new Date(),
          error: data.error
        }
        setMessages([errorMessage])
      }
    } catch (error) {
      setTargetAppStatus('error')
      console.error('Target App initialization failed:', error)
    } finally {
      setIsInitializing(false)
    }
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || targetAppStatus !== 'ready') return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/claude-sdk/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          prompt: inputValue.trim(),
          maxTurns: options.maxTurns,
          syncContext: options.syncContext,
          contextFiles: options.contextFiles,
          includeArtifacts: options.includeArtifacts
        })
      })

      const data = await response.json()

      const claudeMessage: Message = {
        id: `claude-${Date.now()}`,
        type: 'claude',
        content: data.message || (data.error ? `Error: ${data.error}` : 'No response received'),
        timestamp: new Date(),
        artifacts: data.artifacts || [],
        phase: data.phase || currentPhase,
        subagentRole: data.subagentRole || subagentRole,
        success: data.success,
        error: data.error
      }

      setMessages(prev => [...prev, claudeMessage])

      // Notify parent components of updates
      if (data.artifacts && data.artifacts.length > 0 && onArtifactsUpdate) {
        onArtifactsUpdate(data.artifacts)
      }

      if (options.syncContext && onContextSync) {
        onContextSync()
      }

    } catch (error) {
      console.error('Failed to send message:', error)
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: `Failed to communicate with Claude: ${error}`,
        timestamp: new Date(),
        error: String(error)
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const syncContext = async () => {
    try {
      const response = await fetch('/api/claude-sdk/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          direction: 'to_target',
          contextData: { currentPhase, subagentRole }
        })
      })

      if (response.ok && onContextSync) {
        onContextSync()
      }
    } catch (error) {
      console.error('Context sync failed:', error)
    }
  }

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user'
    const isClaude = message.type === 'claude'
    const isSystem = message.type === 'system'

    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3 p-4",
          isUser && "flex-row-reverse",
          isSystem && "justify-center"
        )}
      >
        {!isSystem && (
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-blue-500 text-white" : "bg-green-500 text-white"
          )}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </div>
        )}
        
        <div className={cn(
          "flex-1 space-y-2",
          isUser && "text-right",
          isSystem && "text-center"
        )}>
          <div className={cn(
            "inline-block p-3 rounded-lg max-w-[80%]",
            isUser && "bg-blue-500 text-white ml-auto",
            isClaude && "bg-gray-100 dark:bg-gray-800",
            isSystem && "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800"
          )}>
            <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            
            {message.artifacts && message.artifacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {message.artifacts.map((artifact, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {artifact}
                  </Badge>
                ))}
              </div>
            )}
            
            {message.error && (
              <Alert className="mt-2 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  {message.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          <div className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser && "justify-end"
          )}>
            <span>{message.timestamp.toLocaleTimeString()}</span>
            {message.phase && (
              <Badge variant="outline" className="text-xs">
                Phase {message.phase}
              </Badge>
            )}
            {message.subagentRole && (
              <Badge variant="outline" className="text-xs">
                {message.subagentRole}
              </Badge>
            )}
            {message.success !== undefined && (
              message.success ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-500" />
              )
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(message.content)}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (targetAppStatus === 'not_initialized') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Claude Code SDK
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Target App is not initialized. Click below to start your development environment.
          </p>
          <Button 
            onClick={initializeTargetApp}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Code className="h-4 w-4 mr-2" />
            )}
            Initialize Target App
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (targetAppStatus === 'error') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Target App Error
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            There was an error with the Target App initialization.
          </p>
          <Button 
            onClick={initializeTargetApp}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Initialization
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Claude Code SDK
            <Badge variant="outline" className="ml-2">
              Phase {currentPhase} - {subagentRole}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={syncContext}
              title="Sync context"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptions(!showOptions)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {showOptions && (
          <div className="mt-4 p-3 border rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium">Max Turns</label>
                <select
                  value={options.maxTurns}
                  onChange={(e) => setOptions(prev => ({ ...prev, maxTurns: parseInt(e.target.value) }))}
                  className="w-full mt-1 text-xs border rounded px-2 py-1"
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={options.syncContext}
                    onChange={(e) => setOptions(prev => ({ ...prev, syncContext: e.target.checked }))}
                  />
                  Sync Context
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={options.includeArtifacts}
                    onChange={(e) => setOptions(prev => ({ ...prev, includeArtifacts: e.target.checked }))}
                  />
                  Include Artifacts
                </label>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-96 px-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ready to start development! Send a message to Claude.</p>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        <Separator />
        
        <div className="p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Send a message to Claude (${subagentRole})...`}
              className="min-h-[60px] resize-none"
              disabled={isLoading || targetAppStatus !== 'ready'}
            />
            <Button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading || targetAppStatus !== 'ready'}
              size="sm"
              className="self-end"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}