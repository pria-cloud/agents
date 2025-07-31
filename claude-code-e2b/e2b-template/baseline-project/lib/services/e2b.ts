// E2B Sandbox Service for PRIA Developer Platform
import { Sandbox } from 'e2b'
import type { GeneratedFile } from '@/lib/supabase/types'

export interface SandboxSession {
  id: string
  url: string
  status: 'creating' | 'ready' | 'error' | 'stopped'
  template?: string
  created_at: Date
}

export interface FileSystemOperation {
  type: 'create' | 'update' | 'delete' | 'read' | 'list'
  path: string
  content?: string
  recursive?: boolean
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

export interface TerminalSession {
  id: string
  sandboxId: string
  status: 'active' | 'closed'
  created_at: Date
}

export class E2BSandboxService {
  private activeSandboxes = new Map<string, any>()
  private terminalSessions = new Map<string, TerminalSession>()
  
  constructor() {
    // E2B SDK uses environment variables E2B_API_KEY automatically
    if (!process.env.E2B_API_KEY) {
      console.warn('E2B_API_KEY not found in environment variables')
    }
  }

  /**
   * Create a new sandbox for a development session
   */
  async createSandbox(
    sessionId: string,
    options: {
      template?: string
      timeoutMs?: number
      environment?: Record<string, string>
    } = {}
  ): Promise<SandboxSession> {
    try {
      console.log(`Creating E2B sandbox for session ${sessionId}`)
      
      const {
        template = process.env.E2B_TEMPLATE_ID || 'next-js',
        timeoutMs = 300000, // 5 minutes
        environment = {}
      } = options

      // Create sandbox with specified template
      const sandbox = await Sandbox.create(template, {
        timeoutMs,
        envs: {
          // Default environment variables
          NODE_ENV: 'development',
          ...environment
        }
      })

      // Store sandbox reference
      this.activeSandboxes.set(sessionId, sandbox)
      
      // Generate sandbox URL (typically runs on port 3000)
      const sandboxUrl = `https://3000-${sandbox.sandboxId}.e2b.app`
      
      // Set up basic project structure
      await this.initializeProjectStructure(sandbox)
      
      console.log(`✅ Sandbox created: ${sandbox.sandboxId}`)
      
      return {
        id: sandbox.sandboxId,
        url: sandboxUrl,
        status: 'ready',
        template,
        created_at: new Date()
      }
      
    } catch (error) {
      console.error('Failed to create E2B sandbox:', error)
      
      // Try basic fallback sandbox
      try {
        console.log('Attempting fallback with basic template...')
        const fallbackSandbox = await Sandbox.create('base', {
          timeoutMs: 120000 // 2 minutes for fallback
        })
        
        this.activeSandboxes.set(sessionId, fallbackSandbox)
        
        return {
          id: fallbackSandbox.sandboxId,
          url: `https://3000-${fallbackSandbox.sandboxId}.e2b.app`,
          status: 'ready',
          template: 'base',
          created_at: new Date()
        }
      } catch (fallbackError) {
        console.error('Fallback sandbox creation failed:', fallbackError)
        return {
          id: '',
          url: '',
          status: 'error',
          created_at: new Date()
        }
      }
    }
  }

  /**
   * Initialize basic project structure in sandbox
   */
  private async initializeProjectStructure(sandbox: any): Promise<void> {
    try {
      // Create project directories
      await sandbox.commands.run('mkdir -p /home/user/project/{src,public,lib,components}')
      
      // Create basic package.json if it doesn't exist
      const packageJsonExists = await this.fileExists(sandbox, '/home/user/project/package.json')
      if (!packageJsonExists) {
        const packageJson = {
          name: 'pria-generated-project',
          version: '1.0.0',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint'
          },
          dependencies: {
            next: '^14.0.0',
            react: '^18.0.0',
            'react-dom': '^18.0.0',
            typescript: '^5.0.0'
          }
        }
        
        await sandbox.files.write(
          '/home/user/project/package.json',
          JSON.stringify(packageJson, null, 2)
        )
      }
      
      // Install dependencies if needed
      console.log('Installing project dependencies...')
      await sandbox.commands.run('cd /home/user/project && npm install', {
        timeout: 120000 // 2 minutes for npm install
      })
      
    } catch (error) {
      console.warn('Failed to initialize project structure:', error instanceof Error ? error.message : String(error))
      // Continue anyway - this is not critical
    }
  }

  /**
   * Execute file system operations
   */
  async executeFileOperation(
    sessionId: string,
    operation: FileSystemOperation
  ): Promise<any> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      switch (operation.type) {
        case 'create':
        case 'update':
          if (!operation.content) {
            throw new Error('Content is required for create/update operations')
          }
          await sandbox.files.write(operation.path, operation.content)
          return { success: true, path: operation.path }

        case 'read':
          const content = await sandbox.files.read(operation.path)
          return { success: true, content, path: operation.path }

        case 'delete':
          // Use command to handle both files and directories
          const deleteCmd = operation.recursive 
            ? `rm -rf "${operation.path}"` 
            : `rm "${operation.path}"`
          const result = await sandbox.commands.run(deleteCmd)
          return { 
            success: result.exitCode === 0, 
            path: operation.path,
            error: result.stderr 
          }

        case 'list':
          const listResult = await sandbox.commands.run(`ls -la "${operation.path}"`)
          const files = this.parseFileList(listResult.stdout)
          return { success: true, files, path: operation.path }

        default:
          throw new Error(`Unsupported operation type: ${operation.type}`)
      }
    } catch (error) {
      console.error(`File operation failed:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error), 
        path: operation.path 
      }
    }
  }

  /**
   * Execute command in sandbox
   */
  async executeCommand(
    sessionId: string,
    command: string,
    options: {
      workingDir?: string
      timeout?: number
    } = {}
  ): Promise<CommandResult> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      const startTime = Date.now()
      
      // Prepare command with working directory if specified
      const fullCommand = options.workingDir 
        ? `cd "${options.workingDir}" && ${command}`
        : command

      const result = await sandbox.commands.run(fullCommand, {
        timeout: options.timeout || 30000 // 30 seconds default
      })

      const duration = Date.now() - startTime

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode,
        duration
      }
    } catch (error) {
      console.error('Command execution failed:', error)
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: 0
      }
    }
  }

  /**
   * Deploy files to sandbox
   */
  async deployFiles(
    sessionId: string,
    files: GeneratedFile[],
    targetDirectory: string = '/home/user/project'
  ): Promise<{ success: boolean; deployed: number; errors: string[] }> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    const errors: string[] = []
    let deployed = 0

    try {
      // Ensure target directory exists
      await sandbox.commands.run(`mkdir -p "${targetDirectory}"`)

      // Deploy each file
      for (const file of files) {
        try {
          const filePath = `${targetDirectory}/${file.file_path}`
          
          // Create directory structure if needed
          const directory = filePath.substring(0, filePath.lastIndexOf('/'))
          if (directory !== targetDirectory) {
            await sandbox.commands.run(`mkdir -p "${directory}"`)
          }
          
          // Write file content
          await sandbox.files.write(filePath, file.content)
          deployed++
          
        } catch (error) {
          errors.push(`Failed to deploy ${file.file_path}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      return {
        success: errors.length === 0,
        deployed,
        errors
      }
      
    } catch (error) {
      console.error('File deployment failed:', error)
      return {
        success: false,
        deployed,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  /**
   * Start development server
   */
  async startDevServer(
    sessionId: string,
    options: {
      command?: string
      port?: number
      workingDir?: string
    } = {}
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      const {
        command = 'npm run dev',
        port = 3000,
        workingDir = '/home/user/project'
      } = options

      // Start dev server in background
      const startCommand = `cd "${workingDir}" && nohup ${command} > dev-server.log 2>&1 &`
      const result = await sandbox.commands.run(startCommand)

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to start development server'
        }
      }

      // Wait for server to be ready
      await this.waitForServerReady(sandbox, port)

      const url = `https://${port}-${sandbox.sandboxId}.e2b.app`
      
      return {
        success: true,
        url
      }
      
    } catch (error) {
      console.error('Failed to start dev server:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Get sandbox status
   */
  async getSandboxStatus(sessionId: string): Promise<'ready' | 'stopped' | 'error' | 'not_found'> {
    const sandbox = this.activeSandboxes.get(sessionId)
    
    if (!sandbox) {
      return 'not_found'
    }

    try {
      // Simple health check
      const result = await sandbox.commands.run('echo "health-check"', { timeout: 5000 })
      return result.exitCode === 0 ? 'ready' : 'error'
    } catch (error) {
      console.error('Sandbox health check failed:', error)
      return 'error'
    }
  }

  /**
   * Stop sandbox
   */
  async stopSandbox(sessionId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(sessionId)
    
    if (sandbox) {
      try {
        await sandbox.kill()
        this.activeSandboxes.delete(sessionId)
        
        // Clean up any terminal sessions
        for (const [termId, session] of this.terminalSessions.entries()) {
          if (session.sandboxId === sandbox.sandboxId) {
            this.terminalSessions.delete(termId)
          }
        }
        
        console.log(`✅ Sandbox stopped for session ${sessionId}`)
      } catch (error) {
        console.error('Failed to stop sandbox:', error)
      }
    }
  }

  /**
   * Get project file tree
   */
  async getFileTree(
    sessionId: string,
    rootPath: string = '/home/user/project'
  ): Promise<any[]> {
    const sandbox = this.activeSandboxes.get(sessionId)
    if (!sandbox) {
      throw new Error(`No active sandbox found for session ${sessionId}`)
    }

    try {
      const result = await sandbox.commands.run(
        `find "${rootPath}" -type f -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.css" | sort`
      )

      const files = result.stdout.split('\n').filter(Boolean)
      const fileTree = []

      for (const filePath of files.slice(0, 50)) { // Limit to 50 files
        try {
          const relativePath = filePath.replace(rootPath + '/', '')
          const content = await sandbox.files.read(filePath)
          
          fileTree.push({
            path: relativePath,
            fullPath: filePath,
            content: content.substring(0, 10000), // Limit content size
            size: content.length
          })
        } catch (error) {
          console.warn(`Failed to read file ${filePath}:`, error instanceof Error ? error.message : String(error))
        }
      }

      return fileTree
    } catch (error) {
      console.error('Failed to get file tree:', error)
      return []
    }
  }

  /**
   * Install npm packages
   */
  async installPackages(
    sessionId: string,
    packages: string[],
    options: {
      isDev?: boolean
      workingDir?: string
    } = {}
  ): Promise<CommandResult> {
    const {
      isDev = false,
      workingDir = '/home/user/project'
    } = options

    const installCommand = `npm install ${isDev ? '--save-dev' : ''} ${packages.join(' ')}`
    
    return this.executeCommand(sessionId, installCommand, {
      workingDir,
      timeout: 120000 // 2 minutes for package installation
    })
  }

  // Private helper methods

  private async fileExists(sandbox: any, path: string): Promise<boolean> {
    try {
      const result = await sandbox.commands.run(`test -f "${path}"`)
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  private parseFileList(output: string): any[] {
    const lines = output.split('\n').filter(Boolean)
    const files = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 9) {
        const permissions = parts[0]
        const size = parts[4]
        const name = parts.slice(8).join(' ')
        
        if (name !== '.' && name !== '..') {
          files.push({
            name,
            permissions,
            size: parseInt(size) || 0,
            type: permissions.startsWith('d') ? 'directory' : 'file'
          })
        }
      }
    }

    return files
  }

  private async waitForServerReady(
    sandbox: any,
    port: number,
    maxAttempts: number = 30
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await sandbox.commands.run(
          `curl -f http://localhost:${port}`,
          { timeout: 5000 }
        )
        
        if (result.exitCode === 0) {
          console.log(`✅ Server ready on port ${port}`)
          return
        }
      } catch (error) {
        // Server not ready yet
      }
      
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    console.warn(`⚠️ Server did not become ready on port ${port} after ${maxAttempts} attempts`)
  }
}

// Singleton instance
export const e2bSandboxService = new E2BSandboxService()