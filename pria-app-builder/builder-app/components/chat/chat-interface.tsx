'use client'

import { useState, useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { MessageSquare, Trash2, Download } from 'lucide-react'
import { ChatMessage as ChatMessageType } from '@/lib/types/database'

interface ChatInterfaceProps {
  sessionId?: string
  messages: ChatMessageType[]
  onSendMessage: (message: string) => Promise<void>
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

export function ChatInterface({
  sessionId,
  messages = [],
  onSendMessage,
  isLoading = false,
  disabled = false,
  className
}: ChatInterfaceProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, autoScroll])

  // Detect manual scrolling to disable auto-scroll
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10
    setAutoScroll(isAtBottom)
  }

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleClearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history? This action cannot be undone.')) {
      try {
        setIsLoading(true)
        
        // Clear local state
        setMessages([])
        
        // Clear chat history in database
        const response = await fetch('/api/chat/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            sessionId
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to clear chat history')
        }
        
        toast({
          title: "Chat Cleared",
          description: "Chat history has been cleared successfully.",
          duration: 3000,
        })
        
      } catch (error) {
        console.error('Failed to clear chat:', error)
        toast({
          title: "Error",
          description: "Failed to clear chat history. Please try again.",
          variant: "destructive",
          duration: 5000,
        })
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleExportChat = () => {
    const chatData = {
      sessionId,
      messages,
      exportedAt: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${sessionId || 'session'}-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyMessage = (content: string) => {
    // Optional: Show toast notification
    console.log('Message copied:', content.substring(0, 50) + '...')
  }

  if (!sessionId) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-8 text-center max-w-md">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Welcome to PRIA App Builder</h3>
            <p className="text-muted-foreground mb-4">
              Create a new session or select an existing one to start building your application with Claude Code AI.
            </p>
            <Button>
              Create New Session
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          <h2 className="font-semibold text-sm text-foreground">
            Chat with Claude Code
          </h2>
          <p className="text-xs text-muted-foreground">
            Session: {sessionId}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleExportChat}
            title="Export chat"
            disabled={messages.length === 0}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClearChat}
            title="Clear chat"
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Start the conversation</h3>
              <p className="text-muted-foreground mb-4">
                Begin by describing the application you want to build. Claude Code will guide you through the requirements gathering process.
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Try starting with:</p>
                <ul className="text-left space-y-1 mt-2">
                  <li>• "I want to build a todo app"</li>
                  <li>• "Create a dashboard for project management"</li>
                  <li>• "Build an e-commerce store"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea ref={scrollAreaRef} className="h-full">
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="group">
                  <ChatMessage
                    message={message}
                    onCopy={handleCopyMessage}
                  />
                </div>
              ))}
              
              {/* Scroll indicator */}
              {!autoScroll && (
                <div className="sticky bottom-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAutoScroll(true)
                      const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
                      if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight
                      }
                    }}
                    className="shadow-lg"
                  >
                    Scroll to bottom
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Chat Input */}
      <div className="border-t border-border p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          disabled={disabled}
          placeholder={
            disabled 
              ? "Initializing Target App with Claude Code SDK..."
              : messages.length === 0
              ? "Describe the application you want to build..."
              : "Continue the conversation..."
          }
        />
      </div>
    </div>
  )
}