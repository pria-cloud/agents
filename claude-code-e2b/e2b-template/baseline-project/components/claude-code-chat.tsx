'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, User, Bot, Copy, Check } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: Array<{
    type: 'file_created' | 'file_modified' | 'command_executed'
    details: any
  }>
}

interface ChatResponse {
  conversationId: string
  messages: Message[]
  actions?: Array<{
    type: 'file_created' | 'file_modified' | 'command_executed'
    details: any
  }>
}

export function ClaudeCodeChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/claude/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input.trim(),
          conversationId,
          projectContext: {
            gitBranch: 'main' // TODO: Get actual git branch
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ChatResponse = await response.json()
      
      if (!conversationId) {
        setConversationId(data.conversationId)
      }

      // Add the assistant's response
      if (data.messages.length > 0) {
        const assistantMessage = data.messages[data.messages.length - 1]
        if (assistantMessage.role === 'assistant') {
          setMessages(prev => [...prev, {
            ...assistantMessage,
            actions: data.actions
          }])
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const clearConversation = async () => {
    if (!conversationId) return

    try {
      await fetch(`/api/claude/conversation/${conversationId}`, {
        method: 'DELETE'
      })
      setMessages([])
      setConversationId(null)
    } catch (error) {
      console.error('Error clearing conversation:', error)
    }
  }

  const formatCode = (content: string) => {
    // Simple code block detection and formatting
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const inlineCodeRegex = /`([^`]+)`/g

    return content
      .replace(codeBlockRegex, (match, language, code) => {
        return `<div class="code-block"><pre><code class="language-${language || 'text'}">${code.trim()}</code></pre></div>`
      })
      .replace(inlineCodeRegex, '<code class="inline-code">$1</code>')
      .replace(/\n/g, '<br>')
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Claude Code Assistant</h2>
          <p className="text-sm text-muted-foreground">
            AI-powered development assistance with full project context
          </p>
        </div>
        <button
          onClick={clearConversation}
          className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
          disabled={messages.length === 0}
        >
          Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Bot size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Welcome to Claude Code!</h3>
            <p className="text-sm">
              I can help you with coding tasks, project management, git operations, and more.
              <br />
              Try asking me to create a component, fix a bug, or explain some code.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-primary-foreground" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formatCode(message.content) }}
              />
              
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-xs font-medium mb-2">Actions performed:</p>
                  <div className="space-y-1">
                    {message.actions.map((action, actionIndex) => (
                      <div key={actionIndex} className="text-xs bg-background/50 rounded px-2 py-1">
                        <span className="font-medium">
                          {action.type.replace('_', ' ').toUpperCase()}
                        </span>
                        {action.details && (
                          <span className="ml-2 opacity-70">
                            {typeof action.details === 'string' ? action.details : JSON.stringify(action.details)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-60">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => copyToClipboard(message.content, index)}
                  className="text-xs opacity-60 hover:opacity-100 transition-opacity p-1"
                  title="Copy message"
                >
                  {copiedIndex === index ? (
                    <Check size={12} />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-primary-foreground" />
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude Code to help with your project..."
            className="flex-1 min-h-[40px] max-h-32 px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}