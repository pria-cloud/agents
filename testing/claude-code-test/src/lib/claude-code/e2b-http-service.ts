import fetch from 'node-fetch'

export interface SandboxSession {
  id: string
  url: string
  status: 'creating' | 'ready' | 'error' | 'stopped'
}

export class E2BHttpService {
  private apiKey: string
  private baseUrl: string = 'https://api.e2b.dev'
  private activeSandboxes = new Map<string, string>() // sessionId -> sandboxId

  constructor() {
    this.apiKey = process.env.E2B_API_KEY!
    if (!this.apiKey) {
      throw new Error('E2B_API_KEY environment variable is required')
    }
  }

  private async makeRequest(endpoint: string, options: any = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`E2B API error (${response.status}): ${error}`)
    }

    return response.json()
  }

  async createSandbox(sessionId: string): Promise<SandboxSession> {
    try {
      console.log(`Creating E2B sandbox via HTTP API for session ${sessionId}`)
      console.log(`Using template: ${process.env.E2B_TEMPLATE_ID}`)
      
      const requestBody = {
        template_id: process.env.E2B_TEMPLATE_ID,
        metadata: {
          session_id: sessionId,
          type: 'claude-code',
          created_at: new Date().toISOString()
        }
      }

      console.log('Creating sandbox with:', requestBody)

      const result = await this.makeRequest('/sandboxes', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      console.log('Sandbox creation result:', result)

      const sandboxId = result.sandbox_id || result.id
      this.activeSandboxes.set(sessionId, sandboxId)

      const sandboxUrl = `https://3000-${sandboxId}.e2b.app`
      console.log(`HTTP API sandbox created: ${sandboxId}, URL: ${sandboxUrl}`)

      return {
        id: sandboxId,
        url: sandboxUrl,
        status: 'ready'
      }
    } catch (error) {
      console.error('Failed to create E2B sandbox via HTTP API:', error)
      
      // Fallback to manual sandbox if available
      if (process.env.E2B_MANUAL_SANDBOX_ID) {
        console.log(`🔧 Falling back to manual sandbox: ${process.env.E2B_MANUAL_SANDBOX_ID}`)
        
        const manualSandboxId = process.env.E2B_MANUAL_SANDBOX_ID
        this.activeSandboxes.set(sessionId, manualSandboxId)
        
        return {
          id: manualSandboxId,
          url: `https://3000-${manualSandboxId}.e2b.app`,
          status: 'ready'
        }
      }

      throw error
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (!sandboxId) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      console.log(`Executing command in sandbox ${sandboxId}: ${command}`)

      const result = await this.makeRequest(`/sandboxes/${sandboxId}/commands`, {
        method: 'POST',
        body: JSON.stringify({
          command: command,
          timeout: 30000 // 30 seconds
        })
      })

      console.log('Command execution result:', result)

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exit_code || result.exitCode || 0
      }
    } catch (error) {
      console.error('Failed to execute command via HTTP API:', error)
      throw error
    }
  }

  async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (!sandboxId) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      console.log(`Writing file to sandbox ${sandboxId}: ${filePath}`)

      await this.makeRequest(`/sandboxes/${sandboxId}/files`, {
        method: 'POST',
        body: JSON.stringify({
          path: filePath,
          content: content
        })
      })

      console.log('File written successfully via HTTP API')
    } catch (error) {
      console.error('Failed to write file via HTTP API:', error)
      throw error
    }
  }

  async readFile(sessionId: string, filePath: string): Promise<string> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (!sandboxId) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      console.log(`Reading file from sandbox ${sandboxId}: ${filePath}`)

      const result = await this.makeRequest(`/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`, {
        method: 'GET'
      })

      console.log('File read successfully via HTTP API')
      return result.content || ''
    } catch (error) {
      console.error('Failed to read file via HTTP API:', error)
      throw error
    }
  }

  async sendMessage(sessionId: string, message: string, context?: any): Promise<any> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (!sandboxId) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      console.log(`Sending message to Claude Code SDK in sandbox ${sandboxId}`)

      // Write the message to a file first
      const messagePayload = {
        message,
        context: context || {},
        timestamp: new Date().toISOString()
      }

      await this.writeFile(sessionId, '/tmp/user_message.json', JSON.stringify(messagePayload))

      // Execute curl command to call the Claude Code SDK API
      const curlCommand = `curl -X POST http://localhost:8080/api/claude/chat -H "Content-Type: application/json" -d @/tmp/user_message.json`
      
      const result = await this.executeCommand(sessionId, curlCommand)

      if (result.exitCode === 0 && result.stdout) {
        try {
          const claudeResponse = JSON.parse(result.stdout)
          return claudeResponse
        } catch (parseError) {
          console.error('Failed to parse Claude response:', parseError)
          return {
            response: result.stdout,
            type: 'clarification',
            confidence_score: 0.5
          }
        }
      } else {
        throw new Error(`Claude Code SDK returned error: ${result.stderr || 'No response'}`)
      }
    } catch (error) {
      console.error('Failed to send message via HTTP API:', error)
      
      return {
        response: `🔧 **HTTP API Sandbox Connected** (ID: ${sandboxId.slice(0, 8)})\\n\\n**Your Development Environment:**\\n• Sandbox URL: https://3000-${sandboxId}.e2b.app\\n• Method: Direct HTTP API calls\\n• Status: Connected but Claude SDK unavailable\\n\\n**Your Request:** "${message}"\\n\\n**Note:** Using HTTP API fallback due to E2B SDK WebSocket issues. The sandbox is running and accessible at the URL above.\\n\\n**Services Status:**\\n• Sandbox: Connected via HTTP API\\n• Claude Code SDK: Checking startup...`,
        type: 'response',
        confidence_score: 0.6,
        sandbox_info: {
          sandbox_id: sandboxId,
          sandbox_url: `https://3000-${sandboxId}.e2b.app`,
          status: 'connected_http_api',
          error: error.message
        }
      }
    }
  }

  async getSandboxStatus(sessionId: string): Promise<'ready' | 'stopped' | 'error' | 'not_found'> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (!sandboxId) {
      return 'not_found'
    }

    try {
      // Check sandbox status via HTTP API
      const result = await this.makeRequest(`/sandboxes/${sandboxId}`, {
        method: 'GET'
      })

      return result.status === 'running' ? 'ready' : 'error'
    } catch (error) {
      console.error('Failed to check sandbox status via HTTP API:', error)
      return 'error'
    }
  }

  async stopSandbox(sessionId: string): Promise<void> {
    const sandboxId = this.activeSandboxes.get(sessionId)
    
    if (sandboxId) {
      try {
        await this.makeRequest(`/sandboxes/${sandboxId}`, {
          method: 'DELETE'
        })
        this.activeSandboxes.delete(sessionId)
        console.log(`Sandbox stopped via HTTP API for session ${sessionId}`)
      } catch (error) {
        console.error('Failed to stop sandbox via HTTP API:', error)
      }
    }
  }
}

// Singleton instance
export const e2bHttpService = new E2BHttpService()