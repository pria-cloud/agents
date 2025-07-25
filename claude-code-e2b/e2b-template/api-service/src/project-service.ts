import fs from 'fs/promises'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { GitService } from './git-service'

export interface CreateProjectRequest {
  name: string
  template: 'nextjs' | 'react' | 'vue' | 'custom'
  gitRepo?: string
  description?: string
}

export interface CloneProjectRequest {
  gitUrl: string
  branch?: string
  credentials?: {
    token: string
    type: 'github' | 'gitlab' | 'custom'
  }
}

export interface ProjectStatus {
  name: string
  path: string
  type: string
  hasGit: boolean
  gitBranch?: string
  packageManager: 'npm' | 'yarn' | 'pnpm'
  scripts: string[]
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  buildStatus?: 'building' | 'success' | 'error'
  previewStatus?: 'starting' | 'running' | 'stopped' | 'error'
  previewUrl?: string
}

export interface BuildResult {
  success: boolean
  duration: number
  output: string
  errors?: string[]
}

export interface PreviewResult {
  success: boolean
  url: string
  port: number
  pid?: number
}

export class ProjectService {
  private readonly projectRoot: string
  private readonly gitService: GitService
  private isInitialized: boolean = false
  private buildProcess: ChildProcess | null = null
  private previewProcess: ChildProcess | null = null
  private previewPort: number = 3000

  constructor() {
    this.projectRoot = process.env.PROJECT_ROOT || '/code/baseline-project'
    this.gitService = new GitService()
    this.initialize()
  }

  private async initialize() {
    try {
      // Ensure project directory exists
      await fs.mkdir(this.projectRoot, { recursive: true })
      
      this.isInitialized = true
      console.log('✅ Project service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Project service:', error)
    }
  }

  async createProject(request: CreateProjectRequest): Promise<ProjectStatus> {
    if (!this.isInitialized) {
      throw new Error('Project service not initialized')
    }

    try {
      const projectPath = path.join('/code/projects', request.name)
      
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true })
      
      // Create project based on template
      await this.createFromTemplate(projectPath, request.template)
      
      // Initialize git if requested
      if (request.gitRepo) {
        await this.gitService.addRemote('origin', request.gitRepo)
      }

      // Create package.json with project details
      const packageJson = await this.createPackageJson(request)
      await fs.writeFile(
        path.join(projectPath, 'package.json'), 
        JSON.stringify(packageJson, null, 2)
      )

      return await this.getProjectStatusFromPath(projectPath)
    } catch (error) {
      console.error('Create project error:', error)
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async cloneProject(request: CloneProjectRequest): Promise<ProjectStatus> {
    if (!this.isInitialized) {
      throw new Error('Project service not initialized')
    }

    try {
      // Clone repository
      const cloneResult = await this.gitService.clone(
        request.gitUrl, 
        undefined, 
        request.branch
      )

      // Switch to the cloned project directory
      const newProjectRoot = cloneResult.path
      
      // Install dependencies if package.json exists
      const packageJsonPath = path.join(newProjectRoot, 'package.json')
      try {
        await fs.access(packageJsonPath)
        await this.installDependencies(newProjectRoot)
      } catch (error) {
        console.log('📦 No package.json found, skipping dependency installation')
      }

      return await this.getProjectStatusFromPath(newProjectRoot)
    } catch (error) {
      console.error('Clone project error:', error)
      throw new Error(`Failed to clone project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getProjectStatus(): Promise<ProjectStatus> {
    if (!this.isInitialized) {
      throw new Error('Project service not initialized')
    }

    return await this.getProjectStatusFromPath(this.projectRoot)
  }

  private async getProjectStatusFromPath(projectPath: string): Promise<ProjectStatus> {
    try {
      // Read package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      let packageJson: any = {}
      
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        packageJson = JSON.parse(content)
      } catch (error) {
        console.log('📦 No package.json found or invalid JSON')
      }

      // Check git status
      let hasGit = false
      let gitBranch: string | undefined
      
      try {
        const gitStatus = await this.gitService.getStatus()
        hasGit = true
        gitBranch = gitStatus.branch
      } catch (error) {
        // No git repository
      }

      // Determine package manager
      const packageManager = await this.detectPackageManager(projectPath)

      // Get project name from path or package.json
      const projectName = packageJson.name || path.basename(projectPath)

      return {
        name: projectName,
        path: projectPath,
        type: this.detectProjectType(packageJson),
        hasGit,
        gitBranch,
        packageManager,
        scripts: Object.keys(packageJson.scripts || {}),
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        previewUrl: this.previewProcess ? `http://localhost:${this.previewPort}` : undefined,
        previewStatus: this.previewProcess ? 'running' : 'stopped'
      }
    } catch (error) {
      console.error('Get project status error:', error)
      throw new Error(`Failed to get project status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async buildProject(): Promise<BuildResult> {
    if (!this.isInitialized) {
      throw new Error('Project service not initialized')
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      let output = ''
      let errors: string[] = []

      // Determine build command
      const packageManager = 'npm' // TODO: Detect actual package manager
      const buildCommand = packageManager === 'npm' ? 'npm run build' : 
                          packageManager === 'yarn' ? 'yarn build' : 'pnpm build'

      console.log(`🔨 Starting build: ${buildCommand}`)
      
      this.buildProcess = spawn('sh', ['-c', buildCommand], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      })

      this.buildProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        output += chunk
        console.log(chunk)
      })

      this.buildProcess.stderr?.on('data', (data) => {
        const chunk = data.toString()
        output += chunk
        errors.push(chunk)
        console.error(chunk)
      })

      this.buildProcess.on('close', (code) => {
        const duration = Date.now() - startTime
        this.buildProcess = null

        if (code === 0) {
          console.log('✅ Build completed successfully')
          resolve({
            success: true,
            duration,
            output
          })
        } else {
          console.error('❌ Build failed')
          reject(new Error(`Build failed with code ${code}`))
        }
      })

      this.buildProcess.on('error', (error) => {
        this.buildProcess = null
        console.error('❌ Build process error:', error)
        reject(new Error(`Build process error: ${error.message}`))
      })
    })
  }

  async startPreview(): Promise<PreviewResult> {
    if (!this.isInitialized) {
      throw new Error('Project service not initialized')
    }

    // Stop existing preview if running
    if (this.previewProcess) {
      await this.stopPreview()
    }

    return new Promise((resolve, reject) => {
      // Determine dev command
      const packageManager = 'npm' // TODO: Detect actual package manager
      const devCommand = packageManager === 'npm' ? 'npm run dev' : 
                        packageManager === 'yarn' ? 'yarn dev' : 'pnpm dev'

      console.log(`🚀 Starting preview: ${devCommand}`)
      
      this.previewProcess = spawn('sh', ['-c', devCommand], {
        cwd: this.projectRoot,
        stdio: 'pipe',
        env: {
          ...process.env,
          PORT: this.previewPort.toString()
        }
      })

      let hasStarted = false

      this.previewProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        console.log(chunk)
        
        // Check if server has started
        if (!hasStarted && (chunk.includes('Local:') || chunk.includes('localhost:') || chunk.includes('ready'))) {
          hasStarted = true
          resolve({
            success: true,
            url: `http://localhost:${this.previewPort}`,
            port: this.previewPort,
            pid: this.previewProcess?.pid
          })
        }
      })

      this.previewProcess.stderr?.on('data', (data) => {
        const chunk = data.toString()
        console.error(chunk)
      })

      this.previewProcess.on('close', (code) => {
        console.log(`Preview process exited with code ${code}`)
        this.previewProcess = null
      })

      this.previewProcess.on('error', (error) => {
        this.previewProcess = null
        console.error('❌ Preview process error:', error)
        if (!hasStarted) {
          reject(new Error(`Preview process error: ${error.message}`))
        }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!hasStarted) {
          this.stopPreview()
          reject(new Error('Preview startup timeout'))
        }
      }, 30000)
    })
  }

  async stopPreview(): Promise<void> {
    if (this.previewProcess) {
      console.log('🛑 Stopping preview server...')
      this.previewProcess.kill('SIGTERM')
      this.previewProcess = null
    }
  }

  private async createFromTemplate(projectPath: string, template: string) {
    // Copy baseline project template
    const templatePath = '/code/baseline-project'
    
    try {
      // Copy all files from baseline project
      await this.copyDirectory(templatePath, projectPath)
      console.log(`📁 Created project from ${template} template`)
    } catch (error) {
      // If baseline doesn't exist, create a minimal Next.js project
      await this.createMinimalNextProject(projectPath)
      console.log('📁 Created minimal Next.js project')
    }
  }

  private async copyDirectory(src: string, dest: string) {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  private async createMinimalNextProject(projectPath: string) {
    // Create basic Next.js structure
    const structure = [
      'app',
      'components',
      'lib',
      'public'
    ]

    for (const dir of structure) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true })
    }

    // Create basic files
    const files = {
      'app/page.tsx': `export default function Home() {
  return (
    <main>
      <h1>Welcome to your new project!</h1>
      <p>This project was created with Claude Code E2B integration.</p>
    </main>
  )
}`,
      'app/layout.tsx': `export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig`
    }

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(projectPath, filePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content)
    }
  }

  private async createPackageJson(request: CreateProjectRequest) {
    return {
      name: request.name,
      version: '0.1.0',
      description: request.description || `A ${request.template} project created with Claude Code E2B`,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        next: '15.0.0',
        react: '19.0.0',
        'react-dom': '19.0.0'
      },
      devDependencies: {
        '@types/node': '^20',
        '@types/react': '^18',
        '@types/react-dom': '^18',
        eslint: '^8',
        'eslint-config-next': '15.0.0',
        typescript: '^5'
      }
    }
  }

  private async detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    try {
      await fs.access(path.join(projectPath, 'yarn.lock'))
      return 'yarn'
    } catch {}

    try {
      await fs.access(path.join(projectPath, 'pnpm-lock.yaml'))
      return 'pnpm'
    } catch {}

    return 'npm'
  }

  private detectProjectType(packageJson: any): string {
    if (packageJson.dependencies?.next) return 'nextjs'
    if (packageJson.dependencies?.react) return 'react'
    if (packageJson.dependencies?.vue) return 'vue'
    return 'unknown'
  }

  private async installDependencies(projectPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const packageManager = 'npm' // TODO: Detect actual package manager
      const installCommand = packageManager === 'npm' ? 'npm install' : 
                            packageManager === 'yarn' ? 'yarn install' : 'pnpm install'

      console.log(`📦 Installing dependencies: ${installCommand}`)
      
      const installProcess = spawn('sh', ['-c', installCommand], {
        cwd: projectPath,
        stdio: 'pipe'
      })

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed successfully')
          resolve()
        } else {
          reject(new Error(`Dependency installation failed with code ${code}`))
        }
      })

      installProcess.on('error', (error) => {
        reject(new Error(`Dependency installation error: ${error.message}`))
      })
    })
  }

  isHealthy(): boolean {
    return this.isInitialized
  }

  getStats() {
    return {
      isInitialized: this.isInitialized,
      projectRoot: this.projectRoot,
      hasBuildProcess: !!this.buildProcess,
      hasPreviewProcess: !!this.previewProcess,
      previewPort: this.previewPort
    }
  }
}