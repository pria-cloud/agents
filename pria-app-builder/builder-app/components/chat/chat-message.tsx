'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, User, Bot, Settings } from 'lucide-react'
import { ChatMessage as ChatMessageType } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
  onCopy?: (content: string) => void
}

export function ChatMessage({ message, onCopy }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setIsCopied(true)
      onCopy?.(message.content)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const getIcon = () => {
    switch (message.role) {
      case 'user':
        return <User className="h-4 w-4" />
      case 'assistant':
        return <Bot className="h-4 w-4" />
      case 'system':
        return <Settings className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'You'
      case 'assistant':
        return 'Claude Code'
      case 'system':
        return 'System'
      default:
        return 'Unknown'
    }
  }

  const getRoleColor = () => {
    switch (message.role) {
      case 'user':
        return 'text-blue-600 dark:text-blue-400'
      case 'assistant':
        return 'text-green-600 dark:text-green-400'
      case 'system':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <Card className={cn(
      "mb-4 p-4 transition-colors hover:bg-accent/5",
      message.role === 'user' && "ml-8",
      message.role === 'assistant' && "mr-8",
      message.role === 'system' && "bg-muted/30"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 p-1.5 rounded-full bg-muted", getRoleColor())}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", getRoleColor())}>
                {getRoleLabel()}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(message.created_at).toLocaleTimeString()}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
              title="Copy message"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {message.content}
            </pre>
          </div>
          
          {message.metadata && Object.keys(message.metadata).length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              <details>
                <summary className="cursor-pointer hover:text-foreground">
                  Metadata
                </summary>
                <pre className="mt-1 text-xs bg-muted p-2 rounded">
                  {JSON.stringify(message.metadata, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
      
      {isCopied && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Copied!
        </div>
      )}
    </Card>
  )
}