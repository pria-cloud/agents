/**
 * Enhanced PRIA Environment Setup
 * 
 * This system ensures every E2B sandbox has the correct PRIA environment
 * regardless of E2B SDK template bugs. It transforms base templates into
 * production-ready PRIA development environments.
 */

import { Sandbox } from 'e2b'

export interface PRIASetupResult {
  success: boolean
  nodeVersion?: string
  priaFilesInstalled: boolean
  scriptsInstalled: boolean
  validationPassed: boolean
  errors: string[]
  setupLog: string[]
}

export interface PRIASetupOptions {
  forceNodejsUpgrade?: boolean
  skipExistingFiles?: boolean
  sessionId: string
  workspaceId: string
  projectName?: string
  timeoutMs?: number
}

export class EnhancedPRIASetup {
  private sandbox: Sandbox
  private setupLog: string[] = []
  private errors: string[] = []

  constructor(sandbox: Sandbox) {
    this.sandbox = sandbox
  }

  /**
   * Main setup method that ensures PRIA environment
   */
  async setupPRIAEnvironment(options: PRIASetupOptions): Promise<PRIASetupResult> {
    this.log('🚀 Starting Enhanced PRIA Environment Setup')
    this.log(`Session: ${options.sessionId}, Workspace: ${options.workspaceId}`)

    try {
      // Step 1: Validate sandbox is running
      await this.validateSandboxRunning()
      
      // Step 2: Check current Node.js version
      const currentNodeVersion = await this.checkNodeVersion()
      this.log(`Current Node.js version: ${currentNodeVersion}`)
      
      // Step 3: Upgrade to Node.js v22 if needed
      let nodeVersion = currentNodeVersion
      if (!currentNodeVersion.startsWith('v22.') || options.forceNodejsUpgrade) {
        nodeVersion = await this.upgradeNodeJS()
      }
      
      // Step 4: Create project directory structure
      await this.createProjectStructure(options)
      
      // Step 5: Install PRIA template files
      const priaFilesInstalled = await this.installPRIAFiles(options)
      
      // Step 6: Install PRIA scripts
      const scriptsInstalled = await this.installPRIAScripts(options)
      
      // Step 7: Install dependencies
      await this.installDependencies(options)
      
      // Step 8: Final validation
      const validationPassed = await this.validatePRIAEnvironment()
      
      const result: PRIASetupResult = {
        success: this.errors.length === 0 && validationPassed,
        nodeVersion,
        priaFilesInstalled,
        scriptsInstalled,
        validationPassed,
        errors: this.errors,
        setupLog: this.setupLog
      }
      
      this.log(`✅ Setup completed. Success: ${result.success}`)
      return result
      
    } catch (error) {
      this.error(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        success: false,
        priaFilesInstalled: false,
        scriptsInstalled: false,
        validationPassed: false,
        errors: this.errors,
        setupLog: this.setupLog
      }
    }
  }

  /**
   * Validate sandbox is running and accessible
   */
  private async validateSandboxRunning(): Promise<void> {
    this.log('🔍 Validating sandbox is running...')
    
    try {
      const result = await this.sandbox.commands.run('echo "sandbox-test"', { timeout: 10000 })
      if (!result.stdout.includes('sandbox-test')) {
        throw new Error('Sandbox not responding correctly')
      }
      this.log('✅ Sandbox is running and accessible')
    } catch (error) {
      this.error(`Sandbox validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * Check current Node.js version
   */
  private async checkNodeVersion(): Promise<string> {
    try {
      const result = await this.sandbox.commands.run('node --version', { timeout: 5000 })
      return result.stdout.trim()
    } catch (error) {
      this.error(`Failed to check Node.js version: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return 'unknown'
    }
  }

  /**
   * Upgrade Node.js to v22
   */
  private async upgradeNodeJS(): Promise<string> {
    this.log('🔧 Upgrading to Node.js v22...')
    
    try {
      // Install Node.js v22 using NodeSource repository
      const commands = [
        'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -',
        'sudo apt-get install -y nodejs',
        'npm install -g npm@latest'
      ]
      
      for (const command of commands) {
        this.log(`Running: ${command}`)
        const result = await this.sandbox.commands.run(command, { timeout: 120000 })
        if (result.exitCode !== 0) {
          throw new Error(`Command failed: ${command}\\nError: ${result.stderr}`)
        }
      }
      
      // Verify installation
      const newVersion = await this.checkNodeVersion()
      if (newVersion.startsWith('v22.')) {
        this.log(`✅ Node.js upgraded to ${newVersion}`)
        return newVersion
      } else {
        throw new Error(`Node.js upgrade failed. Current version: ${newVersion}`)
      }
      
    } catch (error) {
      this.error(`Node.js upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * Create project directory structure
   */
  private async createProjectStructure(options: PRIASetupOptions): Promise<void> {
    this.log('📁 Creating project directory structure...')
    
    const projectDir = `/home/user/workspace/session-${options.sessionId}`
    const directories = [
      projectDir,
      `${projectDir}/app`,
      `${projectDir}/components`,
      `${projectDir}/lib`,
      `${projectDir}/public`
    ]
    
    try {
      for (const dir of directories) {
        await this.sandbox.commands.run(`mkdir -p "${dir}"`, { timeout: 5000 })
      }
      
      this.log(`✅ Project directories created at ${projectDir}`)
    } catch (error) {
      this.error(`Failed to create project structure: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * Install PRIA template files
   */
  private async installPRIAFiles(options: PRIASetupOptions): Promise<boolean> {
    this.log('📦 Installing PRIA template files...')
    
    try {
      const projectDir = `/home/user/workspace/session-${options.sessionId}`
      
      // Core PRIA files content
      const files = {
        'package.json': this.generatePackageJson(options),
        'next.config.js': this.generateNextConfig(),
        'tailwind.config.js': this.generateTailwindConfig(),
        'tsconfig.json': this.generateTSConfig(),
        '.env.local': this.generateEnvLocal(options),
        'CLAUDE.md': this.generateClaudeConfig(options),
        'TARGET_APP_SPECIFICATION.md': this.generateTargetAppSpec(options)
      }
      
      for (const [filename, content] of Object.entries(files)) {
        const filePath = `${projectDir}/${filename}`
        
        // Check if file exists and skip if requested
        if (options.skipExistingFiles) {
          const checkResult = await this.sandbox.commands.run(`test -f "${filePath}" && echo "exists"`, { timeout: 5000 })
          if (checkResult.stdout.includes('exists')) {
            this.log(`⏭️  Skipping existing file: ${filename}`)
            continue
          }
        }
        
        // Write file content
        const writeCommand = `cat > "${filePath}" << 'PRIA_FILE_EOF'\\n${content}\\nPRIA_FILE_EOF`
        const result = await this.sandbox.commands.run(writeCommand, { timeout: 30000 })
        
        if (result.exitCode === 0) {
          this.log(`✅ Created: ${filename}`)
        } else {
          this.error(`Failed to create ${filename}: ${result.stderr}`)
        }
      }
      
      this.log('✅ PRIA template files installed successfully')
      return true
      
    } catch (error) {
      this.error(`PRIA files installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Install PRIA helper scripts
   */
  private async installPRIAScripts(options: PRIASetupOptions): Promise<boolean> {
    this.log('📜 Installing PRIA helper scripts...')
    
    try {
      const scriptsDir = '/home/user/scripts'
      await this.sandbox.commands.run(`mkdir -p "${scriptsDir}"`, { timeout: 5000 })
      
      const scripts = {
        'validate-pria.sh': this.generateValidationScript(),
        'setup-development.sh': this.generateDevelopmentScript(),
        'run-pria-dev.sh': this.generateRunScript(options)
      }
      
      for (const [scriptName, content] of Object.entries(scripts)) {
        const scriptPath = `${scriptsDir}/${scriptName}`
        const writeCommand = `cat > "${scriptPath}" << 'PRIA_SCRIPT_EOF'\\n${content}\\nPRIA_SCRIPT_EOF`
        
        await this.sandbox.commands.run(writeCommand, { timeout: 10000 })
        await this.sandbox.commands.run(`chmod +x "${scriptPath}"`, { timeout: 5000 })
        
        this.log(`✅ Created script: ${scriptName}`)
      }
      
      this.log('✅ PRIA scripts installed successfully')
      return true
      
    } catch (error) {
      this.error(`Scripts installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  /**
   * Install Node.js dependencies
   */
  private async installDependencies(options: PRIASetupOptions): Promise<void> {
    this.log('📦 Installing Node.js dependencies...')
    
    try {
      const projectDir = `/home/user/workspace/session-${options.sessionId}`
      
      // Install dependencies
      const result = await this.sandbox.commands.run(
        `cd "${projectDir}" && npm install`,
        { timeout: 180000 }
      )
      
      if (result.exitCode === 0) {
        this.log('✅ Dependencies installed successfully')
      } else {
        this.error(`Dependency installation failed: ${result.stderr}`)
      }
      
    } catch (error) {
      this.error(`Dependency installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  /**
   * Validate PRIA environment is properly set up
   */
  private async validatePRIAEnvironment(): Promise<boolean> {
    this.log('🔍 Validating PRIA environment...')
    
    try {
      const checks = [
        {
          name: 'Node.js v22',
          command: 'node --version',
          expect: (output: string) => output.startsWith('v22.')
        },
        {
          name: 'npm available',
          command: 'npm --version',
          expect: (output: string) => output.length > 0
        },
        {
          name: 'Project structure',
          command: 'ls -la /home/user/workspace/',
          expect: (output: string) => output.includes('session-')
        },
        {
          name: 'PRIA scripts',
          command: 'ls -la /home/user/scripts/',
          expect: (output: string) => output.includes('validate-pria.sh')
        }
      ]
      
      let allPassed = true
      
      for (const check of checks) {
        try {
          const result = await this.sandbox.commands.run(check.command, { timeout: 10000 })
          const passed = check.expect(result.stdout)
          
          if (passed) {
            this.log(`✅ ${check.name}: PASSED`)
          } else {
            this.error(`❌ ${check.name}: FAILED - ${result.stdout}`)
            allPassed = false
          }
        } catch (error) {
          this.error(`❌ ${check.name}: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`)
          allPassed = false
        }
      }
      
      return allPassed
      
    } catch (error) {
      this.error(`Environment validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return false
    }
  }

  // File generation methods
  private generatePackageJson(options: PRIASetupOptions): string {
    const projectName = options.projectName || `pria-app-${options.sessionId.substring(0, 8)}`
    
    return JSON.stringify({
      name: projectName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
        'pria:validate': '/home/user/scripts/validate-pria.sh'
      },
      dependencies: {
        'next': '^15.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.0.0',
        '@types/react-dom': '^18.0.0',
        'typescript': '^5.0.0',
        'tailwindcss': '^3.4.0',
        'autoprefixer': '^10.4.0',
        'postcss': '^8.4.0'
      },
      devDependencies: {
        'eslint': '^8.0.0',
        'eslint-config-next': '^15.0.0'
      }
    }, null, 2)
  }

  private generateNextConfig(): string {
    return `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig`
  }

  private generateTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
  }

  private generateTSConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [
          {
            name: 'next'
          }
        ],
        paths: {
          '@/*': ['./*']
        }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2)
  }

  private generateEnvLocal(options: PRIASetupOptions): string {
    return `# PRIA Target App Environment
# Session: ${options.sessionId}
# Workspace: ${options.workspaceId}

NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Add your API keys and configuration here
`
  }

  private generateClaudeConfig(options: PRIASetupOptions): string {
    return `# PRIA Target App - Development Context

This is a PRIA Target App created for session ${options.sessionId} in workspace ${options.workspaceId}.

## Development Environment
- Node.js v22+
- Next.js 15
- TypeScript
- Tailwind CSS

## Commands
- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run pria:validate\` - Validate PRIA environment

## PRIA Compliance
This project follows PRIA development standards and includes all required tooling for production-ready application development.
`
  }

  private generateTargetAppSpec(options: PRIASetupOptions): string {
    return `# TARGET APP SPECIFICATION

**Session ID:** ${options.sessionId}
**Workspace ID:** ${options.workspaceId}
**Created:** ${new Date().toISOString()}

## Project Overview
PRIA-compliant Next.js application generated through the PRIA Builder App workflow.

## Technical Stack
- **Framework:** Next.js 15
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Node.js:** v22+

## Development Status
- ✅ Environment Setup Complete
- ⏳ Requirements Gathering
- ⏳ Implementation Planning
- ⏳ Development Phase
- ⏳ Testing & QA
- ⏳ Deployment Ready

## Requirements
*Requirements will be populated during the development workflow*

## Implementation Notes
*Implementation details will be added as development progresses*
`
  }

  private generateValidationScript(): string {
    return `#!/bin/bash
# PRIA Environment Validation Script

echo "🔍 PRIA Environment Validation"
echo "================================"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

if [[ $NODE_VERSION == v22.* ]]; then
  echo "✅ Node.js v22 detected"
else
  echo "❌ Node.js v22 required, found $NODE_VERSION"
  exit 1
fi

# Check npm
NPM_VERSION=$(npm --version)
echo "npm version: $NPM_VERSION"

# Check project structure
if [ -d "/home/user/workspace" ]; then
  echo "✅ Workspace directory exists"
else
  echo "❌ Workspace directory missing"
  exit 1
fi

# Check scripts
if [ -f "/home/user/scripts/validate-pria.sh" ]; then
  echo "✅ PRIA scripts installed"
else
  echo "❌ PRIA scripts missing"
  exit 1
fi

echo "🎉 PRIA environment validation completed successfully!"
`
  }

  private generateDevelopmentScript(): string {
    return `#!/bin/bash
# PRIA Development Setup Script

echo "🚀 Setting up PRIA development environment..."

# Set up environment
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1

echo "✅ PRIA development environment ready"
`
  }

  private generateRunScript(options: PRIASetupOptions): string {
    return `#!/bin/bash
# PRIA Development Server Script

SESSION_DIR="/home/user/workspace/session-${options.sessionId}"

if [ ! -d "$SESSION_DIR" ]; then
  echo "❌ Session directory not found: $SESSION_DIR"
  exit 1
fi

cd "$SESSION_DIR"

echo "🚀 Starting PRIA development server..."
echo "Session: ${options.sessionId}"
echo "Workspace: ${options.workspaceId}"

npm run dev
`
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    this.setupLog.push(logMessage)
    console.log(`[PRIA SETUP] ${message}`)
  }

  private error(message: string): void {
    this.errors.push(message)
    this.log(`ERROR: ${message}`)
  }
}

export default EnhancedPRIASetup