/**
 * Internal API Client
 * 
 * Provides a secure client for making internal service-to-service API calls
 * with proper authentication and error handling.
 */

import { createInternalAuthHeaders } from '@/lib/auth/internal-auth'

export interface E2BSandboxRequest {
  sessionId: string
  action: 'create' | 'execute' | 'write_file' | 'read_file' | 'list_files' | 'get_state' | 'terminate'
  data?: {
    workspaceId?: string
    command?: string
    filePath?: string
    content?: string
    directory?: string
    options?: Record<string, any>
  }
}

export interface E2BSandboxResponse {
  success: boolean
  result?: any
  error?: string
}

export interface ClaudeStreamRequest {
  sessionId: string
  message: string
  options?: {
    workspaceId?: string
    env?: Record<string, string>
  }
}

export class InternalApiClient {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    // Auto-detect baseUrl for server-side usage
    if (!baseUrl && typeof window === 'undefined') {
      // Server-side: use localhost with default port
      this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    } else {
      this.baseUrl = baseUrl
    }
  }

  /**
   * Makes a secure internal API call
   */
  private async makeInternalCall<T>(
    endpoint: string, 
    method: 'GET' | 'POST' = 'POST',
    data?: any,
    purpose: string = 'internal-api-call'
  ): Promise<T> {
    try {
      const headers = createInternalAuthHeaders(purpose)
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Internal API call failed: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Internal API call to ${endpoint} failed:`, error)
      throw error
    }
  }

  /**
   * E2B Sandbox Operations
   */
  async e2b(request: E2BSandboxRequest): Promise<E2BSandboxResponse> {
    return this.makeInternalCall<E2BSandboxResponse>(
      '/api/e2b/sandbox',
      'POST',
      request,
      `e2b-${request.action}`
    )
  }

  /**
   * Create E2B sandbox
   */
  async createSandbox(sessionId: string, workspaceId: string, metadata?: Record<string, any>): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'create',
      data: { workspaceId, ...metadata }
    })
  }

  /**
   * Execute command in E2B sandbox
   */
  async executeCommand(
    sessionId: string, 
    command: string, 
    options?: Record<string, any>
  ): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'execute',
      data: { command, options }
    })
  }

  /**
   * Write file to E2B sandbox
   */
  async writeFile(sessionId: string, filePath: string, content: string): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'write_file',
      data: { filePath, content }
    })
  }

  /**
   * Read file from E2B sandbox
   */
  async readFile(sessionId: string, filePath: string): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'read_file',
      data: { filePath }
    })
  }

  /**
   * List files in E2B sandbox
   */
  async listFiles(sessionId: string, directory?: string): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'list_files',
      data: { directory }
    })
  }

  /**
   * Get E2B sandbox project state
   */
  async getProjectState(sessionId: string): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'get_state'
    })
  }

  /**
   * Terminate E2B sandbox
   */
  async terminateSandbox(sessionId: string): Promise<E2BSandboxResponse> {
    return this.e2b({
      sessionId,
      action: 'terminate'
    })
  }

  /**
   * Claude Streaming API
   */
  async streamClaude(request: ClaudeStreamRequest): Promise<Response> {
    const headers = createInternalAuthHeaders('claude-stream')
    
    const response = await fetch(`${this.baseUrl}/api/claude/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Claude stream call failed: ${response.status} - ${errorText}`)
    }

    return response
  }

  /**
   * Workspace Operations
   */
  async createWorkspace(name: string, description?: string, ownerId?: string): Promise<any> {
    return this.makeInternalCall(
      '/api/workspaces',
      'POST',
      { name, description, ownerId },
      'workspace-create'
    )
  }

  /**
   * Project Operations
   */
  async createProject(workspaceId: string, name: string, description?: string): Promise<any> {
    return this.makeInternalCall(
      '/api/projects',
      'POST',
      { workspaceId, name, description },
      'project-create'
    )
  }

  /**
   * Session Operations
   */
  async createSession(projectId: string, name: string, description?: string): Promise<any> {
    return this.makeInternalCall(
      '/api/sessions',
      'POST',
      { projectId, name, description },
      'session-create'
    )
  }

  /**
   * File Event Operations
   */
  async recordFileEvent(
    sessionId: string,
    workspaceId: string,
    eventType: 'create' | 'modify' | 'delete',
    filePath: string,
    content?: string
  ): Promise<any> {
    return this.makeInternalCall(
      '/api/file-events',
      'POST',
      {
        sessionId,
        workspaceId,
        eventType,
        filePath,
        content
      },
      'file-event-record'
    )
  }

  /**
   * Health check for internal services
   */
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    try {
      const response = await this.makeInternalCall<{ status: string }>(
        '/api/health',
        'GET',
        undefined,
        'health-check'
      )
      return { ...response, timestamp: Date.now() }
    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

/**
 * Global internal API client instance
 */
export const internalClient = new InternalApiClient()

/**
 * Helper functions for common operations
 */
export const InternalOperations = {
  /**
   * Initialize a complete E2B environment for a session
   */
  async initializeSessionEnvironment(
    sessionId: string,
    workspaceId: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await internalClient.createSandbox(sessionId, workspaceId, metadata)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  },

  /**
   * Execute a Claude command with full error handling
   */
  async executeClaudeCommand(
    sessionId: string,
    command: string,
    options?: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await internalClient.executeCommand(sessionId, command, options)
      return { success: result.success, result: result.result, error: result.error }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  },

  /**
   * Safely clean up a session environment
   */
  async cleanupSessionEnvironment(sessionId: string): Promise<void> {
    try {
      await internalClient.terminateSandbox(sessionId)
    } catch (error) {
      console.warn(`Failed to cleanup session ${sessionId}:`, error)
      // Don't throw - cleanup should be best effort
    }
  }
}