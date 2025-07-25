import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'

export interface ChatRequest {
  message: string
  conversationId?: string
  systemPrompt?: string
  maxTurns?: number
  projectContext?: {
    currentFile?: string
    selectedText?: string
    gitBranch?: string
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatResponse {
  conversationId: string
  messages: ChatMessage[]
  actions?: Array<{
    type: 'file_created' | 'file_modified' | 'command_executed'
    details: any
  }>
}

export interface Conversation {
  id: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  projectContext?: any
}

export class ClaudeService {
  private conversations = new Map<string, Conversation>()
  private readonly projectRoot: string
  private isInitialized: boolean = false
  private anthropic: Anthropic | null = null

  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project'
    this.initialize()
  }

  private async initialize() {
    try {
      // Initialize Anthropic SDK
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️ ANTHROPIC_API_KEY not set - Claude functionality will be limited')
        return
      }

      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      })

      // Ensure project directory exists
      await fs.mkdir(this.projectRoot, { recursive: true })
      
      this.isInitialized = true
      console.log('✅ Claude service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Claude service:', error)
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isInitialized || !this.anthropic) {
      throw new Error('Claude service not initialized or API key missing')
    }

    const conversationId = request.conversationId || uuidv4()
    let conversation = this.conversations.get(conversationId)

    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectContext: request.projectContext
      }
      this.conversations.set(conversationId, conversation)
    }

    // Add user message to conversation
    const userMessage: ChatMessage = {
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString()
    }
    conversation.messages.push(userMessage)

    try {
      // Prepare context-aware prompt
      const contextualPrompt = await this.buildContextualPrompt(request)
      
      // Build messages for Claude API
      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: contextualPrompt
        }
      ]

      // Add conversation history if it exists
      const recentMessages = conversation.messages.slice(-10) // Last 10 messages
      for (let i = 0; i < recentMessages.length - 1; i++) { // Exclude the current message
        const msg = recentMessages[i]
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        }
      }

      const actions: any[] = []

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        system: request.systemPrompt || this.getDefaultSystemPrompt(),
        messages: messages
      })

      let assistantResponse = ''
      
      // Extract text content from response
      for (const content of response.content) {
        if (content.type === 'text') {
          assistantResponse += content.text
        }
      }

      // Parse actions from response (simple pattern matching)
      if (assistantResponse.includes('Created file:') || assistantResponse.includes('Modified file:')) {
        actions.push({
          type: assistantResponse.includes('Created') ? 'file_created' : 'file_modified',
          details: { message: 'File operation detected in response' }
        })
      }
      
      if (assistantResponse.includes('Executed:') || assistantResponse.includes('Running:')) {
        actions.push({
          type: 'command_executed',
          details: { message: 'Command execution detected in response' }
        })
      }

      // Add assistant response to conversation
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      }
      conversation.messages.push(assistantMessage)
      conversation.updatedAt = new Date().toISOString()

      return {
        conversationId,
        messages: conversation.messages,
        actions: actions.length > 0 ? actions : undefined
      }

    } catch (error) {
      console.error('Claude API execution error:', error)
      
      // Add error message to conversation
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or rephrase your request.`,
        timestamp: new Date().toISOString()
      }
      conversation.messages.push(errorMessage)

      return {
        conversationId,
        messages: conversation.messages,
        actions: []
      }
    }
  }

  private async buildContextualPrompt(request: ChatRequest): Promise<string> {
    let prompt = request.message

    // Add project context if available
    if (request.projectContext) {
      const context = request.projectContext
      prompt = `Context:\n`
      
      if (context.currentFile) {
        prompt += `- Current file: ${context.currentFile}\n`
        
        // Try to include file content if it exists
        try {
          const filePath = path.join(this.projectRoot, context.currentFile)
          const content = await fs.readFile(filePath, 'utf-8')
          prompt += `- File content:\n\`\`\`\n${content}\n\`\`\`\n`
        } catch (error) {
          // File doesn't exist or can't be read, continue without content
        }
      }
      
      if (context.selectedText) {
        prompt += `- Selected text: ${context.selectedText}\n`
      }
      
      if (context.gitBranch) {
        prompt += `- Current branch: ${context.gitBranch}\n`
      }

      prompt += `\nUser request: ${request.message}`
    }

    return prompt
  }

  private getDefaultSystemPrompt(): string {
    return `You are Claude, an AI assistant helping with software development in a containerized environment. You have access to a Next.js project in ${this.projectRoot}.

Key capabilities:
- You can help analyze, understand, and write code
- You can provide guidance on software architecture and best practices
- You can explain code, debug issues, and suggest improvements
- You have knowledge of modern web development with Next.js, React, TypeScript, and Tailwind CSS

Guidelines:
- Always follow Next.js 15 best practices and App Router conventions
- Use TypeScript when writing new code
- Follow existing code patterns and styling in the project
- Provide clear explanations of your suggestions
- Ask for clarification if the request is ambiguous
- Be helpful, accurate, and concise

Current working directory: ${this.projectRoot}
Available technologies: Next.js, React, TypeScript, Tailwind CSS, Git`
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null
  }

  async clearConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId)
  }

  async listConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
  }

  isHealthy(): boolean {
    return this.isInitialized && !!this.anthropic
  }

  getStats() {
    return {
      activeConversations: this.conversations.size,
      isInitialized: this.isInitialized,
      projectRoot: this.projectRoot,
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      hasAnthropicClient: !!this.anthropic
    }
  }
}