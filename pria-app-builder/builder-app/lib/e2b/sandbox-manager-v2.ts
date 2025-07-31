import { Sandbox } from 'e2b'

export interface SandboxConfig {
  template: string
  apiKey: string
  timeoutMs?: number
  metadata?: Record<string, any>
}

export interface SandboxEnvironment {
  id: string
  sandbox: Sandbox
  workingDirectory: string
  status: 'initializing' | 'ready' | 'error' | 'terminated'
  metadata: Record<string, any>
  createdAt: Date
  lastActivity: Date
}

export class E2BSandboxManager {
  private sandboxes: Map<string, SandboxEnvironment> = new Map()
  private config: SandboxConfig

  constructor(config: SandboxConfig) {
    this.config = {
      template: 'nodejs',
      timeoutMs: 1800000, // 30 minutes
      ...config
    }
  }

  async createSandbox(sessionId: string, metadata: Record<string, any> = {}): Promise<SandboxEnvironment> {
    try {
      // Check if sandbox already exists
      const existing = this.sandboxes.get(sessionId)
      if (existing && existing.status !== 'terminated') {
        existing.lastActivity = new Date()
        return existing
      }

      // Create new sandbox - ensure all metadata values are strings
      const stringMetadata: Record<string, string> = {
        sessionId,
        purpose: 'pria-app-development'
      }
      
      // Convert all metadata values to strings
      for (const [key, value] of Object.entries(metadata)) {
        stringMetadata[key] = String(value)
      }
      
      console.log('Creating E2B sandbox with config:', {
        template: this.config.template,
        metadata: stringMetadata
      })
      
      const sandbox = await Sandbox.create({
        template: this.config.template,
        apiKey: this.config.apiKey,
        metadata: stringMetadata
      })

      console.log('Sandbox created:', sandbox.id)

      const workingDirectory = `/workspace/session-${sessionId}`
      
      // For now, just create the basic structure without filesystem API
      const environment: SandboxEnvironment = {
        id: sessionId,
        sandbox,
        workingDirectory,
        status: 'ready',
        metadata: { ...metadata, sandboxId: sandbox.id },
        createdAt: new Date(),
        lastActivity: new Date()
      }

      this.sandboxes.set(sessionId, environment)
      return environment

    } catch (error) {
      console.error('Failed to create sandbox:', error)
      throw error
    }
  }

  async getSandbox(sessionId: string): Promise<SandboxEnvironment | null> {
    const environment = this.sandboxes.get(sessionId)
    if (environment) {
      environment.lastActivity = new Date()
    }
    return environment || null
  }

  async executeCommand(
    sessionId: string, 
    command: string, 
    options: { cwd?: string; timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not found or not ready')
    }

    try {
      console.log(`Executing command in sandbox ${sessionId}: ${command}`)
      
      // Use the process API to execute commands
      const result = await environment.sandbox.process.startAndWait(command)
      
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0
      }
    } catch (error) {
      console.error('Failed to execute command:', error)
      throw error
    }
  }

  async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not found or not ready')
    }

    const fullPath = filePath.startsWith('/') ? filePath : `${environment.workingDirectory}/${filePath}`
    
    // Use shell command to write file
    const escapedContent = content.replace(/'/g, "'\"'\"'")
    const command = `cat > '${fullPath}' << 'EOF'\n${content}\nEOF`
    
    await this.executeCommand(sessionId, command)
  }

  async readFile(sessionId: string, filePath: string): Promise<string> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not found or not ready')
    }

    const fullPath = filePath.startsWith('/') ? filePath : `${environment.workingDirectory}/${filePath}`
    const result = await this.executeCommand(sessionId, `cat '${fullPath}'`)
    
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'Failed to read file')
    }
    
    return result.stdout
  }

  async listFiles(sessionId: string, directory?: string): Promise<Array<{
    name: string
    path: string
    type: 'file' | 'directory'
  }>> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      throw new Error('Sandbox not found or not ready')
    }

    const targetDir = directory || environment.workingDirectory
    const result = await this.executeCommand(sessionId, `find '${targetDir}' -maxdepth 1 -type f -o -type d | tail -n +2`)
    
    const files = result.stdout
      .split('\n')
      .filter(line => line.trim())
      .map(path => {
        const name = path.split('/').pop() || ''
        return {
          name,
          path: path.replace(targetDir + '/', ''),
          type: 'file' as const // Simplified for now
        }
      })
    
    return files
  }

  async terminateSandbox(sessionId: string): Promise<void> {
    const environment = this.sandboxes.get(sessionId)
    if (environment && environment.sandbox) {
      try {
        await environment.sandbox.close()
      } catch (error) {
        console.error('Failed to close sandbox:', error)
      }
      environment.status = 'terminated'
    }
    this.sandboxes.delete(sessionId)
  }

  async getProjectState(sessionId: string): Promise<{
    files: Array<{ name: string; path: string; type: 'file' | 'directory' }>
    packageJson?: any
    status: string
  }> {
    const environment = await this.getSandbox(sessionId)
    if (!environment || environment.status !== 'ready') {
      return { files: [], status: 'not_ready' }
    }

    try {
      const files = await this.listFiles(sessionId)
      
      let packageJson: any = undefined
      try {
        const packageContent = await this.readFile(sessionId, 'package.json')
        packageJson = JSON.parse(packageContent)
      } catch (error) {
        // package.json doesn't exist or is invalid
      }

      return {
        files: files.filter(f => !f.name.startsWith('.') && f.name !== 'node_modules'),
        packageJson,
        status: environment.status
      }
    } catch (error) {
      console.error('Failed to get project state:', error)
      return { files: [], status: 'error' }
    }
  }

  destroy(): void {
    // Clean up all sandboxes
    for (const [sessionId] of this.sandboxes) {
      this.terminateSandbox(sessionId).catch(console.error)
    }
  }
}

export default E2BSandboxManager