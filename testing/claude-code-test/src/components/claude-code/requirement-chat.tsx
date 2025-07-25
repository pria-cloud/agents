'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Send, 
  MessageSquare, 
  Bot, 
  User, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  Lightbulb,
  FileText
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  type?: 'clarification' | 'requirement' | 'confirmation' | 'error'
  metadata?: {
    confidence?: number
    suggestions?: string[]
    requirements_extracted?: any
    next_steps?: string[]
  }
}

interface RequirementChatProps {
  sessionId: string
  mode: 'business' | 'developer'
  workspaceId: string
  userId: string
}

export function RequirementChat({ sessionId, mode, workspaceId, userId }: RequirementChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Initialize with welcome message
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: getWelcomeMessage(mode),
        timestamp: new Date(),
        type: 'clarification'
      }
      setMessages([welcomeMessage])
    }
  }, [mode, messages.length])

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/claude-sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          workspace_id: workspaceId,
          user_input: userMessage.content,
          context: {
            previous_messages: messages.slice(-5), // Send last 5 messages for context
            mode
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        type: data.type || 'clarification',
        metadata: {
          confidence: data.confidence_score,
          suggestions: data.suggestions,
          requirements_extracted: data.extracted_requirements,
          next_steps: data.next_steps
        }
      }

      setMessages(prev => [...prev, assistantMessage])

      // If requirements are sufficiently extracted, show confirmation
      if (data.confidence_score > 0.8 && data.extracted_requirements) {
        const confirmationMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'system',
          content: 'I have a good understanding of your requirements. Would you like me to proceed with generating your application?',
          timestamp: new Date(),
          type: 'confirmation',
          metadata: {
            requirements_extracted: data.extracted_requirements
          }
        }
        
        setTimeout(() => {
          setMessages(prev => [...prev, confirmationMessage])
        }, 1000)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        type: 'error'
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleQuickResponse = (response: string) => {
    setInputValue(response)
    textareaRef.current?.focus()
  }

  const handleConfirmRequirements = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/claude-sessions/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          workspace_id: workspaceId,
          confirmed: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to confirm requirements')
      }

      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Perfect! I\'ll now start generating your application. You can track the progress in the sidebar.',
        timestamp: new Date(),
        type: 'confirmation'
      }

      setMessages(prev => [...prev, confirmMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm requirements')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {mode === 'business' ? 'Tell me about your app' : 'Technical Requirements'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {mode === 'business' 
            ? 'Describe what you want to build in natural language'
            : 'Provide technical specifications and requirements'
          }
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 pr-4 mb-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onQuickResponse={handleQuickResponse}
                onConfirmRequirements={message.type === 'confirmation' ? handleConfirmRequirements : undefined}
              />
            ))}
            
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Claude is thinking...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Input */}
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={mode === 'business' 
              ? "Describe your app idea..." 
              : "Specify technical requirements..."
            }
            rows={3}
            className="resize-none"
            disabled={isLoading}
          />
          
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </div>
            <Button 
              onClick={handleSendMessage} 
              disabled={!inputValue.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface MessageBubbleProps {
  message: Message
  onQuickResponse: (response: string) => void
  onConfirmRequirements?: () => void
}

function MessageBubble({ message, onQuickResponse, onConfirmRequirements }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div className={`rounded-lg px-4 py-3 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : isSystem
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-muted'
        }`}>
          <div className="flex items-start gap-2">
            {!isUser && (
              <div className="flex-shrink-0 mt-1">
                {isSystem ? (
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
            )}
            
            <div className="flex-1">
              {message.type && (
                <Badge variant="secondary" className="mb-2 text-xs">
                  {message.type.charAt(0).toUpperCase() + message.type.slice(1)}
                </Badge>
              )}
              
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
              
              {/* Metadata */}
              {message.metadata?.confidence !== undefined && (
                <div className="mt-2 text-xs opacity-75">
                  Confidence: {Math.round(message.metadata.confidence * 100)}%
                </div>
              )}

              {/* Suggestions */}
              {message.metadata?.suggestions && message.metadata.suggestions.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs font-medium opacity-75">Quick responses:</div>
                  <div className="flex flex-wrap gap-1">
                    {message.metadata.suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => onQuickResponse(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements Summary */}
              {message.metadata?.requirements_extracted && (
                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Requirements Summary</span>
                  </div>
                  <div className="text-xs text-blue-800 space-y-1">
                    {Object.entries(message.metadata.requirements_extracted).map(([key, value]) => (
                      <div key={key}>
                        <strong>{key.replace('_', ' ')}:</strong> {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation Button */}
              {message.type === 'confirmation' && onConfirmRequirements && (
                <div className="mt-3">
                  <Button 
                    onClick={onConfirmRequirements}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Yes, proceed with generation
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
      
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser 
          ? 'bg-blue-600 text-white order-1 ml-2' 
          : 'bg-muted order-2 mr-2'
      }`}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
    </div>
  )
}

function getWelcomeMessage(mode: 'business' | 'developer'): string {
  if (mode === 'business') {
    return `Hello! I'm Claude, your AI development assistant. I'll help you create a professional application by asking you some questions about what you want to build.

Let's start with the basics:
• What type of application do you want to create?
• Who will be using it?
• What's the main purpose or problem it should solve?

Feel free to describe your idea in your own words - I'll ask follow-up questions to understand exactly what you need.`
  } else {
    return `Welcome to Developer Mode! I'm Claude, and I'll help you build applications with full technical control.

I can assist with:
• Architecture planning and technical specifications
• Code generation following PRIA best practices
• Database schema design with proper tenancy
• Component architecture and API design
• Testing and deployment strategies

What would you like to build today? Please provide any technical requirements, constraints, or preferences you have in mind.`
  }
}