/**
 * Target App Client - Communicates with Claude Code SDK running in Target App via E2B
 * 
 * This is the CORRECT architecture:
 * Builder App → E2B API → Target App (where Claude Code SDK runs)
 */

import { E2B_TEMPLATE_CONFIG } from './template-config'

export interface TargetAppCommand {
  type: 'claude_query' | 'file_operation' | 'build' | 'test' | 'get_state'
  payload: any
  sessionId: string
}

export interface TargetAppResponse {
  success: boolean
  data?: any
  error?: string
  stream?: boolean
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, any>
}

export interface ProjectState {
  files: Array<{
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    content?: string
  }>
  status: string
  buildStatus?: 'idle' | 'building' | 'success' | 'error'
  devServerStatus?: 'stopped' | 'starting' | 'running' | 'error'
  packageJson?: any
}

export class TargetAppClient {
  private sandboxId: string | null = null
  private sessionId: string
  private initializationFailed: boolean = false
  private isInitializing: boolean = false
  private workspaceId: string | null = null

  constructor(sessionId: string, workspaceId?: string) {
    this.sessionId = sessionId
    this.workspaceId = workspaceId || null
  }

  /**
   * Set the workspace ID (called from dashboard when session is selected)
   */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId
  }

  /**
   * Reset the initialization failure state (allows retry)
   */
  resetInitializationState(): void {
    this.initializationFailed = false
    this.isInitializing = false
  }

  async initializeSandbox(): Promise<void> {
    // Prevent retries if initialization already failed
    if (this.initializationFailed) {
      throw new Error('Sandbox initialization previously failed. Please refresh the page to retry.')
    }

    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      throw new Error('Sandbox initialization already in progress')
    }

    try {
      this.isInitializing = true
      console.log(`Initializing E2B sandbox for session ${this.sessionId}...`)
      
      // Ensure we have a workspace ID
      if (!this.workspaceId) {
        throw new Error('Workspace ID is required for sandbox initialization. Please ensure the TargetAppClient is initialized with a workspace ID.')
      }
      
      // Check if sandbox already exists via API
      const checkResponse = await fetch(`/api/e2b/sandbox?sessionId=${this.sessionId}`, {
        credentials: 'include' // Include cookies for authentication
      })
      
      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        if (checkData.exists) {
          console.log('E2B sandbox already exists:', checkData.environment.id)
          this.sandboxId = checkData.environment.id
          this.initializationFailed = false // Reset failure state since sandbox exists
          return // Already initialized
        }
      }

      // Create sandbox via server-side API
      console.log('Creating E2B sandbox via API...')
      const createResponse = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'create',
          data: {
            workspaceId: this.workspaceId, // Include workspaceId for proper validation
            template: E2B_TEMPLATE_CONFIG.TEMPLATE_ID,
            metadata: {
              type: 'pria-app-builder',
              sessionId: this.sessionId,
              template_version: E2B_TEMPLATE_CONFIG.TEMPLATE_VERSION
            }
          }
        })
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${createResponse.status}`)
      }

      const createData = await createResponse.json()
      if (!createData.success) {
        throw new Error(createData.error || 'Failed to create sandbox')
      }

      this.sandboxId = createData.result.environment.id
      console.log(`E2B sandbox created successfully: ${this.sandboxId}`)

      // Set up the target app structure
      console.log('Setting up target app structure...')
      await this.setupTargetAppStructure()
      
      console.log('Target app initialization completed successfully')
      this.initializationFailed = false // Mark as successful
    } catch (error) {
      console.error('Failed to initialize E2B sandbox:', error)
      this.initializationFailed = true // Mark as failed to prevent retries
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('E2B API key is invalid or missing')
        } else if (error.message.includes('template')) {
          throw new Error('E2B template not found or invalid')
        } else if (error.message.includes('quota')) {
          throw new Error('E2B quota exceeded')
        } else if (error.message.includes('configuration')) {
          throw new Error('E2B configuration error - check server logs')
        } else {
          throw new Error(`E2B sandbox creation failed: ${error.message}`)
        }
      } else {
        throw new Error('Unknown error during sandbox initialization')
      }
    } finally {
      this.isInitializing = false // Always reset initialization flag
    }
  }

  private async setupTargetAppStructure(): Promise<void> {
    if (!this.sandboxId) throw new Error('Sandbox not initialized')

    try {
      console.log('Target app structure already created by E2B sandbox manager')
      // The E2B sandbox manager now handles all directory and file creation
      // No need for additional setup commands here

      // All project files are now created by the E2B sandbox manager
      console.log('Complete project structure with all files created by E2B sandbox manager')

      console.log(`Target app structure created successfully for session ${this.sessionId}`)
    } catch (error) {
      console.error('Failed to setup target app structure:', error)
      throw new Error(`Target app setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Send a message to Claude Code SDK running in the Target App
   */
  async sendClaudeMessage(message: string, context?: any): Promise<TargetAppResponse> {
    if (!this.sandboxId) {
      await this.initializeSandbox()
    }

    try {
      const targetAppPath = `/workspace/target-apps/session-${this.sessionId}`
      const claudeCommand = `cd ${targetAppPath} && claude ask "${message.replace(/"/g, '\\"')}"`
      
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'execute',
          data: {
            command: claudeCommand,
            options: { timeout: 60000 } // 60 second timeout for Claude operations
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const result = await response.json()
      
      return {
        success: result.success,
        data: result.result || result.data
      }
    } catch (error) {
      console.error('Failed to send Claude message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Stream Claude responses from Target App
   */
  async *streamClaudeResponse(message: string): AsyncGenerator<any, void, unknown> {
    if (!this.sandboxId) {
      await this.initializeSandbox()
    }

    try {
      // For now, use the non-streaming version since streaming is complex with API calls
      // TODO: Implement proper streaming via WebSocket or SSE
      const result = await this.sendClaudeMessage(message)
      
      if (result.success && result.data) {
        yield {
          type: 'message',
          content: result.data.output || result.data
        }
      }
      
      yield {
        type: 'done',
        success: result.success
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get current project state from Target App
   */
  async getProjectState(): Promise<ProjectState> {
    if (!this.sandboxId) {
      // Don't try to initialize if it previously failed
      if (this.initializationFailed) {
        return {
          files: [],
          status: 'error',
          devServerStatus: 'stopped'
        }
      }
      
      // Don't try to initialize if already in progress
      if (this.isInitializing) {
        return {
          files: [],
          status: 'initializing',
          devServerStatus: 'stopped'
        }
      }
      
      try {
        await this.initializeSandbox()
      } catch (error) {
        console.error('Failed to initialize sandbox for project state:', error)
        return {
          files: [],
          status: 'error',
          devServerStatus: 'stopped'
        }
      }
    }

    try {
      // Use the API's get_state action
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'get_state'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get project state: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success && result.result.projectState) {
        return result.result.projectState
      }

      // Fallback: Get basic file listing manually
      const listResponse = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'list_files',
          data: {
            directory: `/workspace/target-apps/session-${this.sessionId}`
          }
        })
      })

      let files = []
      if (listResponse.ok) {
        const listResult = await listResponse.json()
        files = listResult.result?.files || []
      }

      return {
        files,
        status: 'ready',
        devServerStatus: 'stopped'
      }
    } catch (error) {
      console.error('Failed to get project state:', error)
      return {
        files: [],
        status: 'error',
        devServerStatus: 'stopped'
      }
    }
  }

  /**
   * Read a specific file from Target App
   */
  async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.sandboxId) {
      await this.initializeSandbox()
    }

    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'read_file',
          data: {
            filePath: `/workspace/target-apps/session-${this.sessionId}/${filePath}`
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const result = await response.json()
      
      return {
        success: result.success,
        content: result.result?.content,
        error: result.success ? undefined : result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get file content with metadata for CodeView
   */
  async getFileContent(filePath: string): Promise<{
    content: string
    exists: boolean
    size?: number
    lastModified?: string
    error?: string
  }> {
    try {
      const fileResult = await this.readFile(filePath)
      
      if (fileResult.success && fileResult.content !== undefined) {
        return {
          content: fileResult.content,
          exists: true,
          size: fileResult.content.length,
          lastModified: new Date().toISOString()
        }
      } else {
        return {
          content: '',
          exists: false,
          error: fileResult.error || 'File not found'
        }
      }
    } catch (error) {
      return {
        content: '',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Start the development server in Target App
   */
  async startDevServer(): Promise<{ success: boolean; error?: string }> {
    if (!this.sandboxId) {
      await this.initializeSandbox()
    }

    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'execute',
          data: {
            command: `cd /workspace/target-apps/session-${this.sessionId} && npm run dev &`,
            options: { timeout: 5000 }
          }
        })
      })

      const result = await response.json()
      return { 
        success: result.success,
        error: result.success ? undefined : result.error
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Terminate the sandbox and cleanup
   */
  async terminate(): Promise<void> {
    if (this.sandboxId) {
      try {
        await fetch('/api/e2b/sandbox', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: this.sessionId,
            action: 'terminate'
          })
        })
      } catch (error) {
        console.error('Failed to terminate sandbox:', error)
      }
      this.sandboxId = null
    }
  }

  /**
   * Check if dev server is running
   */
  async checkDevServerStatus(): Promise<{ running: boolean; port?: number; error?: string }> {
    if (!this.sandboxId) {
      return { running: false, error: 'Sandbox not initialized' }
    }

    try {
      // Check if port 3000 is in use (indicating dev server is running)
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'execute',
          data: {
            command: 'netstat -tlpn | grep :3000 || echo "PORT_NOT_FOUND"',
            options: { timeout: 5000 }
          }
        })
      })

      const result = await response.json()
      
      if (result.success && result.result?.output) {
        const output = result.result.output
        return {
          running: !output.includes('PORT_NOT_FOUND'),
          port: 3000
        }
      }
      
      return { running: false }
    } catch (error) {
      return {
        running: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Ensure dev server is running - start it if not already running
   */
  async ensureDevServerRunning(): Promise<{ success: boolean; started: boolean; error?: string }> {
    try {
      // Check if already running
      const status = await this.checkDevServerStatus()
      if (status.running) {
        return { success: true, started: false } // Already running
      }

      // Start the dev server
      const startResult = await this.startDevServer()
      if (!startResult.success) {
        return { success: false, started: false, error: startResult.error }
      }

      // Wait a few seconds and check again
      await new Promise(resolve => setTimeout(resolve, 3000))
      const newStatus = await this.checkDevServerStatus()
      
      return {
        success: newStatus.running,
        started: true,
        error: newStatus.running ? undefined : 'Dev server started but not responding'
      }
    } catch (error) {
      return {
        success: false,
        started: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get the sandbox URL for live preview - ensures dev server is running
   */
  async getPreviewUrl(): Promise<string | null> {
    if (!this.sandboxId) return null
    
    // Ensure dev server is running
    await this.ensureDevServerRunning()
    
    // E2B provides a URL for port 3000 where Next.js dev server runs
    return `https://${this.sandboxId}-3000.e2b.dev`
  }

  /**
   * Get the sandbox URL for live preview (synchronous version for compatibility)
   */
  getPreviewUrlSync(): string | null {
    if (!this.sandboxId) return null
    
    // E2B provides a URL for port 3000 where Next.js dev server runs
    return `https://${this.sandboxId}-3000.e2b.dev`
  }
}

/**
 * Global registry of Target App clients by session ID
 */
class TargetAppRegistry {
  private clients: Map<string, TargetAppClient> = new Map()

  getClient(sessionId: string, workspaceId?: string): TargetAppClient {
    if (!this.clients.has(sessionId)) {
      this.clients.set(sessionId, new TargetAppClient(sessionId, workspaceId))
    } else if (workspaceId) {
      // Update workspace ID if provided and client already exists
      this.clients.get(sessionId)!.setWorkspaceId(workspaceId)
    }
    return this.clients.get(sessionId)!
  }

  async terminateClient(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId)
    if (client) {
      await client.terminate()
      this.clients.delete(sessionId)
    }
  }

  async terminateAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(client => client.terminate())
    await Promise.all(promises)
    this.clients.clear()
  }
}

export const targetAppRegistry = new TargetAppRegistry()