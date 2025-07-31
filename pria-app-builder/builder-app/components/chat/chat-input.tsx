'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Send, Loader2, Square, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { validateChatMessage } from '@/lib/validation/input-sanitizer'

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatInput({
  onSendMessage,
  isLoading = false,
  disabled = false,
  placeholder = "Describe your app idea or ask a question...",
  className
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [validationError, setValidationError] = useState<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!message.trim() || isLoading || disabled) return
    
    // Clear previous validation errors
    setValidationError('')
    
    // Validate the message before sending
    const validation = validateChatMessage(message.trim())
    if (!validation.isValid) {
      setValidationError(validation.errors.join(', '))
      return
    }
    
    const messageToSend = validation.sanitized
    setMessage('')
    
    try {
      await onSendMessage(messageToSend)
    } catch (error) {
      console.error('Failed to send message:', error)
      // Restore message on error
      setMessage(messageToSend)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea and validate on input change
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
    
    // Clear validation error when user starts typing
    if (validationError && message.trim()) {
      setValidationError('')
    }
  }, [message, validationError])

  return (
    <Card className={cn("p-4", className)}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed",
              "disabled:opacity-50 min-h-[40px] max-h-[120px]",
              validationError && "border-red-500 focus-visible:ring-red-500"
            )}
            rows={1}
          />
          {validationError && (
            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-1">
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || isLoading || disabled}
            className="h-10 w-10"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          
          {isLoading && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-10"
              title="Stop generation"
            >
              <Square className="h-3 w-3" />
            </Button>
          )}
        </div>
      </form>
      
      <div className="mt-2 text-xs text-muted-foreground">
        Press Enter to send, Shift + Enter for new line
      </div>
    </Card>
  )
}