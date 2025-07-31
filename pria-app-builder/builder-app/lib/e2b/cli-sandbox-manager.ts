import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { Sandbox } from 'e2b'

const execAsync = promisify(exec)

export interface CLISandboxResult {
  sandboxId: string
  templateId: string
  success: boolean
  error?: string
  output?: string
}

export class CLISandboxManager {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Create sandbox using E2B CLI (workaround for SDK template issue)
   * This bypasses the E2B Node.js SDK which doesn't properly handle custom templates
   */
  async createSandboxWithCLI(templateId: string, timeoutMs: number = 60000): Promise<CLISandboxResult> {
    console.log(`[CLI MANAGER] Creating sandbox with template: ${templateId}`)
    
    try {
      // Validate E2B CLI is available
      await this.validateCLI()
      
      // Use a more direct approach - spawn sandbox and extract ID
      const command = `e2b sandbox spawn ${templateId}`
      console.log(`[CLI MANAGER] Running command: ${command}`)
      
      const result = await this.runCLICommand(command, timeoutMs)
      
      if (result.success && result.output) {
        // Parse sandbox ID from CLI output
        const sandboxId = this.extractSandboxId(result.output)
        
        if (sandboxId) {
          console.log(`[CLI MANAGER] Successfully created sandbox: ${sandboxId}`)
          
          // Kill the CLI session (it opens an interactive terminal)
          try {
            await this.runCLICommand(`e2b sandbox kill ${sandboxId}`, 10000)
            console.log(`[CLI MANAGER] Terminated CLI session for ${sandboxId}`)
          } catch (error) {
            console.log(`[CLI MANAGER] Note: Could not terminate CLI session (this is expected)`)
          }
          
          return {
            sandboxId,
            templateId,
            success: true,
            output: result.output
          }
        }
      }
      
      throw new Error(`Failed to extract sandbox ID from CLI output: ${result.output}`)
      
    } catch (error) {
      console.error('[CLI MANAGER] Sandbox creation failed:', error)
      return {
        sandboxId: '',
        templateId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        output: error instanceof Error ? error.message : undefined
      }
    }
  }

  /**
   * Connect to existing sandbox using SDK (this part works fine)
   */
  async reconnectToSandbox(sandboxId: string): Promise<Sandbox> {
    console.log(`[CLI MANAGER] Connecting to sandbox: ${sandboxId}`)
    try {
      const sandbox = await Sandbox.connect(sandboxId)
      console.log(`[CLI MANAGER] Successfully connected to sandbox: ${sandboxId}`)
      return sandbox
    } catch (error) {
      console.error(`[CLI MANAGER] Failed to connect to sandbox ${sandboxId}:`, error)
      throw error
    }
  }

  /**
   * Alternative approach: Use CLI API call method
   */
  async createSandboxWithAPI(templateId: string): Promise<CLISandboxResult> {
    console.log(`[CLI MANAGER] Creating sandbox via API approach: ${templateId}`)
    
    try {
      // Try to create sandbox using a more direct CLI approach
      const command = `echo '{"template": "${templateId}"}' | e2b sandbox create`
      
      const result = await this.runCLICommand(command, 30000)
      
      if (result.success) {
        // Parse response for sandbox ID
        const sandboxId = this.extractSandboxId(result.output || '')
        
        if (sandboxId) {
          return {
            sandboxId,
            templateId,
            success: true,
            output: result.output
          }
        }
      }
      
      throw new Error(`API creation failed: ${result.output}`)
      
    } catch (error) {
      return {
        sandboxId: '',
        templateId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate that E2B CLI is available and authenticated
   */
  private async validateCLI(): Promise<void> {
    try {
      const { stdout } = await execAsync('e2b --version')
      console.log(`[CLI MANAGER] E2B CLI version: ${stdout.trim()}`)
    } catch (error) {
      throw new Error('E2B CLI not available. Please install with: npm install -g @e2b/cli')
    }

    // Check authentication
    try {
      const { stdout } = await execAsync('e2b auth whoami')
      console.log(`[CLI MANAGER] Authenticated as: ${stdout.trim()}`)
    } catch (error) {
      throw new Error('E2B CLI not authenticated. Please run: e2b auth login')
    }
  }

  /**
   * Run CLI command with timeout and proper error handling
   */
  private async runCLICommand(command: string, timeoutMs: number): Promise<{success: boolean, output?: string, error?: string}> {
    return new Promise((resolve) => {
      const process = spawn('cmd', ['/c', command], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          E2B_API_KEY: this.apiKey
        }
      })

      let stdout = ''
      let stderr = ''
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          process.kill('SIGTERM')
          resolve({
            success: false,
            error: `Command timed out after ${timeoutMs}ms`,
            output: stdout + stderr
          })
        }
      }, timeoutMs)

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
        console.log(`[CLI MANAGER] stdout: ${data.toString().trim()}`)
        
        // Check if we got a sandbox ID immediately
        const sandboxId = this.extractSandboxId(stdout)
        if (sandboxId && !resolved) {
          resolved = true
          clearTimeout(timeout)
          process.kill('SIGTERM')
          resolve({
            success: true,
            output: stdout
          })
        }
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
        console.log(`[CLI MANAGER] stderr: ${data.toString().trim()}`)
      })

      process.on('close', (code) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          
          // Special handling for E2B spawn command - it may exit with code 1 due to terminal issues
          // but still successfully create the sandbox if we got a sandbox ID
          const hasSandboxId = this.extractSandboxId(stdout)
          
          if (command.includes('sandbox spawn') && hasSandboxId) {
            // Sandbox was created successfully despite terminal error
            resolve({
              success: true,
              output: stdout,
              error: stderr
            })
          } else {
            resolve({
              success: code === 0,
              output: stdout,
              error: stderr
            })
          }
        }
      })

      process.on('error', (error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve({
            success: false,
            error: error.message,
            output: stdout + stderr
          })
        }
      })
    })
  }

  /**
   * Extract sandbox ID from CLI output
   */
  private extractSandboxId(output: string): string | null {
    // Common patterns for sandbox IDs in E2B CLI output
    const patterns = [
      /sandbox ID\s+([a-z0-9]+)/i,
      /connecting to template [^\s]+ with sandbox ID ([a-z0-9]+)/i,
      /sandbox\s+([a-z0-9]{20,})/i,
      /ID:\s*([a-z0-9]+)/i,
      /created.*?([a-z0-9]{20,})/i
    ]

    for (const pattern of patterns) {
      const match = output.match(pattern)
      if (match && match[1]) {
        const sandboxId = match[1].trim()
        // Validate sandbox ID format (usually 20+ lowercase alphanumeric)
        if (sandboxId.length >= 15 && /^[a-z0-9]+$/.test(sandboxId)) {
          return sandboxId
        }
      }
    }

    // Fallback: look for any 20+ character alphanumeric string
    const fallbackMatch = output.match(/\b([a-z0-9]{20,})\b/)
    if (fallbackMatch) {
      return fallbackMatch[1]
    }

    return null
  }

  /**
   * Test connection to a sandbox ID
   */
  async testSandboxConnection(sandboxId: string): Promise<boolean> {
    try {
      const sandbox = await this.reconnectToSandbox(sandboxId)
      
      // Test basic command
      const result = await sandbox.commands.run('echo "test"', { timeout: 5000 })
      await sandbox.kill()
      
      return result.stdout.includes('test')
    } catch (error) {
      console.error(`[CLI MANAGER] Connection test failed for ${sandboxId}:`, error)
      return false
    }
  }

  /**
   * List active sandboxes using CLI
   */
  async listActiveSandboxes(): Promise<string[]> {
    try {
      const result = await this.runCLICommand('e2b sandbox list', 10000)
      
      if (result.success && result.output) {
        // Parse sandbox IDs from list output
        const sandboxIds: string[] = []
        const lines = result.output.split('\n')
        
        for (const line of lines) {
          const sandboxId = this.extractSandboxId(line)
          if (sandboxId) {
            sandboxIds.push(sandboxId)
          }
        }
        
        return sandboxIds
      }
      
      return []
    } catch (error) {
      console.error('[CLI MANAGER] Failed to list sandboxes:', error)
      return []
    }
  }
}

export default CLISandboxManager