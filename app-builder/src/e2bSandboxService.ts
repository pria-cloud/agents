import { Sandbox } from 'e2b'
import { logger } from './logger'
import { supabase } from './supabase'
import { SandboxEventService } from './sandboxEventService'

export interface GeneratedFile {
  filePath: string
  content: string
  operation?: string
}

export interface E2BSandboxConfig {
  templateId: string
  teamId: string
  workspaceId: string
  conversationId: string
}

export interface SandboxInfo {
  sandboxId: string
  sandboxUrl: string
  status: 'creating' | 'ready' | 'failed'
  createdAt: string
}

export class E2BSandboxService {
  private readonly templateId: string
  private readonly teamId: string
  private readonly eventService: SandboxEventService

  constructor(templateId?: string, teamId?: string) {
    this.templateId = templateId || process.env.E2B_TEMPLATE_ID || 'bslm087lozmkvjz6nwle'
    this.teamId = teamId || process.env.E2B_TEAM_ID || 'd9ae965a-2a35-4a01-bc6e-6ff76faaa12c'
    this.eventService = new SandboxEventService()
    
    logger.info({
      event: 'e2b.service.init',
      templateId: this.templateId,
      teamId: this.teamId,
      usingEnvVars: {
        template: !!process.env.E2B_TEMPLATE_ID,
        team: !!process.env.E2B_TEAM_ID
      }
    }, 'E2B Sandbox Service initialized')
  }

  /**
   * Creates a new E2B sandbox and injects the generated files
   */
  async createSandbox(
    files: GeneratedFile[],
    dependencies: string[],
    config: E2BSandboxConfig
  ): Promise<SandboxInfo> {
    const startTime = Date.now()
    
    try {
      logger.info({ 
        event: 'e2b.sandbox.creating', 
        conversationId: config.conversationId,
        filesCount: files.length,
        templateId: this.templateId
      }, 'Creating E2B sandbox')

      // Broadcast sandbox creation started event
      await this.eventService.broadcastSandboxCreating(
        config.conversationId,
        config.workspaceId,
        'Creating live preview sandbox...'
      )

      // Create sandbox instance
      const sandbox = await Sandbox.create(this.templateId, {
        timeoutMs: 1200000, // 20 minutes timeout
      })

      const sandboxId = sandbox.sandboxId
      
      logger.info({ 
        event: 'e2b.sandbox.created', 
        sandboxId,
        conversationId: config.conversationId,
        creationTime: Date.now() - startTime
      }, 'E2B sandbox created')

      // Inject files into sandbox
      await this.injectFiles(sandbox, files)

      // Update package.json dependencies if needed
      await this.updateDependencies(sandbox, dependencies)

      // Install dependencies
      await this.installDependencies(sandbox)

      // Note: shadcn components are installed by start-sandbox.sh startup script
      // No need to install them here as it causes redundant installation failures

      // Start the development server
      await this.startDevServer(sandbox)

      const host = sandbox.getHost(3000)
      const sandboxUrl = `https://${host}`
      
      const sandboxInfo: SandboxInfo = {
        sandboxId,
        sandboxUrl,
        status: 'ready',
        createdAt: new Date().toISOString()
      }

      // Store sandbox info in Supabase
      await this.storeSandboxInfo(config, sandboxInfo)

      // Broadcast sandbox ready event
      await this.eventService.broadcastSandboxReady(
        config.conversationId,
        config.workspaceId,
        sandboxId,
        sandboxUrl,
        'Live preview ready'
      )

      logger.info({ 
        event: 'e2b.sandbox.ready', 
        sandboxId,
        sandboxUrl,
        conversationId: config.conversationId,
        totalTime: Date.now() - startTime
      }, 'E2B sandbox ready')

      return sandboxInfo

    } catch (error) {
      logger.error({ 
        event: 'e2b.sandbox.error', 
        error: error instanceof Error ? error.message : String(error),
        conversationId: config.conversationId,
        templateId: this.templateId
      }, 'Failed to create E2B sandbox')

      // Broadcast sandbox failed event
      await this.eventService.broadcastSandboxFailed(
        config.conversationId,
        config.workspaceId,
        error instanceof Error ? error.message : String(error),
        'Live preview creation failed'
      )

      throw new Error(`Failed to create E2B sandbox: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Injects generated files into the sandbox
   */
  private async injectFiles(sandbox: Sandbox, files: GeneratedFile[]): Promise<void> {
    logger.info({ 
      event: 'e2b.files.injecting', 
      filesCount: files.length,
      filesList: files.map(f => f.filePath),
      sandboxId: sandbox.sandboxId
    }, 'Injecting files into sandbox')

    let injectedCount = 0
    let failedCount = 0

    for (const file of files) {
      try {
        // Log file details before injection
        logger.info({ 
          event: 'e2b.file.injecting', 
          filePath: file.filePath,
          contentLength: file.content.length,
          isAppPage: file.filePath === 'app/page.tsx',
          sandboxId: sandbox.sandboxId
        }, `Injecting file: ${file.filePath}`)

        // Ensure directory exists
        const dirPath = file.filePath.split('/').slice(0, -1).join('/')
        if (dirPath) {
          await sandbox.files.makeDir(dirPath)
          logger.debug({ 
            event: 'e2b.dir.created', 
            dirPath,
            sandboxId: sandbox.sandboxId
          }, `Created directory: ${dirPath}`)
        }

        // Write file content with absolute path
        const absolutePath = `/code/${file.filePath}`
        await sandbox.files.write(absolutePath, file.content)
        
        // Verify file was written by reading it back
        try {
          const writtenContent = await sandbox.files.read(absolutePath)
          const contentMatches = writtenContent === file.content
          
          logger.info({ 
            event: 'e2b.file.injected', 
            filePath: file.filePath,
            absolutePath,
            contentLength: file.content.length,
            writtenLength: writtenContent.length,
            contentMatches,
            isAppPage: file.filePath === 'app/page.tsx',
            sandboxId: sandbox.sandboxId
          }, `Successfully injected: ${file.filePath}`)
          
          if (!contentMatches) {
            logger.warn({ 
              event: 'e2b.file.content_mismatch', 
              filePath: file.filePath,
              expected: file.content.substring(0, 100),
              actual: writtenContent.substring(0, 100),
              sandboxId: sandbox.sandboxId
            }, 'File content mismatch after injection')
          }
          
          injectedCount++
        } catch (verifyError) {
          logger.error({ 
            event: 'e2b.file.verify_error', 
            filePath: file.filePath,
            error: verifyError instanceof Error ? verifyError.message : String(verifyError),
            sandboxId: sandbox.sandboxId
          }, 'Failed to verify file after injection')
          failedCount++
        }

      } catch (error) {
        logger.error({ 
          event: 'e2b.file.error', 
          filePath: file.filePath,
          error: error instanceof Error ? error.message : String(error),
          sandboxId: sandbox.sandboxId
        }, 'Failed to inject file')
        
        failedCount++
        // Continue with other files even if one fails
      }
    }

    // Final summary log
    logger.info({ 
      event: 'e2b.files.injection_complete', 
      totalFiles: files.length,
      injectedCount,
      failedCount,
      hasAppPage: files.some(f => f.filePath === 'app/page.tsx'),
      sandboxId: sandbox.sandboxId
    }, `File injection complete: ${injectedCount}/${files.length} files successfully injected`)

    // Ensure .env.local exists with environment variables
    await this.ensureEnvFile(sandbox)

    // List current /code directory contents for debugging
    try {
      const dirContents = await sandbox.commands.run('find /code -type f -name "*.tsx" -o -name "*.ts" -o -name "*.js" | head -20', {
        cwd: '/code'
      })
      
      logger.info({ 
        event: 'e2b.debug.directory_contents', 
        contents: dirContents.stdout,
        sandboxId: sandbox.sandboxId
      }, 'Current sandbox file structure')
    } catch (error) {
      logger.debug({ 
        event: 'e2b.debug.directory_list_error', 
        error: error instanceof Error ? error.message : String(error)
      }, 'Could not list directory contents')
    }
  }

  /**
   * Ensures .env.local exists with required environment variables from process.env
   * Environment variables should be provided securely through the deployment environment
   */
  private async ensureEnvFile(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.env.ensuring', 
        sandboxId: sandbox.sandboxId
      }, 'Ensuring .env.local exists with environment variables')

      // Read environment variables from process.env (should be provided securely)
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'POSTGRES_URL',
        'POSTGRES_PRISMA_URL',
        'POSTGRES_URL_NON_POOLING',
        'POSTGRES_USER',
        'POSTGRES_HOST',
        'POSTGRES_PASSWORD',
        'POSTGRES_DATABASE',
        'SUPABASE_JWT_SECRET'
      ]

      const envVars: string[] = []
      const missingVars: string[] = []

      for (const varName of requiredVars) {
        const value = process.env[varName]
        if (value) {
          envVars.push(`${varName}="${value}"`)
        } else {
          missingVars.push(varName)
          // Use placeholder for missing variables to prevent runtime errors
          envVars.push(`${varName}="PLACEHOLDER_${varName}"`)
        }
      }

      if (missingVars.length > 0) {
        logger.warn({ 
          event: 'e2b.env.missing_vars', 
          missingVars,
          sandboxId: sandbox.sandboxId
        }, `Missing environment variables: ${missingVars.join(', ')}. Using placeholders.`)
      }

      const envContent = envVars.join('\n') + '\n'
      await sandbox.files.write('/code/.env.local', envContent)
      
      logger.info({ 
        event: 'e2b.env.created', 
        sandboxId: sandbox.sandboxId,
        varsProvided: requiredVars.length - missingVars.length,
        varsTotal: requiredVars.length
      }, 'Successfully created .env.local file')
      
    } catch (error) {
      logger.error({ 
        event: 'e2b.env.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to create .env.local file')
      throw error
    }
  }

  /**
   * Updates package.json with additional dependencies
   */
  private async updateDependencies(sandbox: Sandbox, dependencies: string[]): Promise<void> {
    if (dependencies.length === 0) return

    try {
      logger.info({ 
        event: 'e2b.dependencies.updating', 
        dependencies,
        sandboxId: sandbox.sandboxId
      }, 'Updating dependencies')

      // Read existing package.json
      const packageJsonContent = await sandbox.files.read('/code/package.json')
      const packageJson = JSON.parse(packageJsonContent)

      // Add new dependencies
      for (const dep of dependencies) {
        const [name, version] = dep.includes('@') ? dep.split('@') : [dep, 'latest']
        packageJson.dependencies[name] = version
      }

      // Write updated package.json
      await sandbox.files.write('/code/package.json', JSON.stringify(packageJson, null, 2))

    } catch (error) {
      logger.error({ 
        event: 'e2b.dependencies.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to update dependencies')
    }
  }

  /**
   * Installs dependencies in the sandbox
   */
  private async installDependencies(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.dependencies.installing', 
        sandboxId: sandbox.sandboxId
      }, 'Installing dependencies')

      const result = await sandbox.commands.run('npm install --legacy-peer-deps', {
        cwd: '/code',
        timeoutMs: 180000 // 3 minutes for better compatibility
      })

      if (result.exitCode !== 0) {
        logger.warn({ 
          event: 'e2b.dependencies.warning', 
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
          sandboxId: sandbox.sandboxId
        }, 'Dependencies installation completed with warnings')
      } else {
        logger.info({ 
          event: 'e2b.dependencies.success', 
          sandboxId: sandbox.sandboxId
        }, 'Dependencies installed successfully')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.dependencies.install.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to install dependencies')
      
      // Don't throw error, continue with other setup steps
    }
  }


  /**
   * Starts the development server with health checks and monitoring
   */
  private async startDevServer(sandbox: Sandbox): Promise<void> {
    try {
      logger.info({ 
        event: 'e2b.server.starting', 
        sandboxId: sandbox.sandboxId
      }, 'Starting development server')

      // Start dev server in background with logging
      const devProcess = sandbox.commands.run('cd /code && npm run dev > /tmp/dev-server.log 2>&1 &', {
        background: true
      })

      // Monitor for infinite loops and validate server health
      await this.validateDevServer(sandbox, devProcess)

    } catch (error) {
      logger.error({ 
        event: 'e2b.server.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandbox.sandboxId
      }, 'Failed to start development server')
      throw error
    }
  }

  /**
   * Validates dev server is healthy and accessible
   */
  private async validateDevServer(sandbox: Sandbox, devProcess: any): Promise<void> {
    const maxAttempts = 30 // 30 seconds max wait
    const checkInterval = 1000
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      // Check for infinite loops (high CPU usage)
      const cpuUsage = await this.checkCpuUsage(sandbox, devProcess)
      if (cpuUsage > 90) {
        logger.warn({ 
          event: 'e2b.server.high_cpu', 
          sandboxId: sandbox.sandboxId,
          cpuUsage
        }, 'High CPU usage detected, checking for infinite loop')

        if (await this.detectInfiniteLoop(sandbox, devProcess)) {
          throw new Error('Infinite loop detected in dev server process')
        }
      }

      // Check dev server logs for errors
      const logCheck = await this.checkDevServerLogs(sandbox)
      if (logCheck.hasErrors) {
        logger.warn({ 
          event: 'e2b.server.compilation_errors', 
          sandboxId: sandbox.sandboxId,
          errors: logCheck.errors,
          attempt: attempts
        }, 'Compilation errors detected, attempting auto-fix')

        // Attempt to auto-fix compilation errors
        const fixAttempted = await this.attemptErrorFix(sandbox, logCheck.errors, logCheck.errorContext)
        if (!fixAttempted) {
          throw new Error(`Dev server compilation errors: ${logCheck.errors.join(', ')}`)
        }
        
        // Continue monitoring after fix attempt
        continue
      }

      // Health check - verify server responds
      if (await this.healthCheckDevServer(sandbox)) {
        logger.info({ 
          event: 'e2b.server.ready', 
          sandboxId: sandbox.sandboxId,
          attempts
        }, 'Development server is healthy and accessible')
        return
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
    }

    throw new Error('Dev server failed to become accessible within timeout period')
  }

  /**
   * Checks if dev server responds on port 3000
   */
  private async healthCheckDevServer(sandbox: Sandbox): Promise<boolean> {
    try {
      const result = await sandbox.commands.run('curl -f -s http://localhost:3000 > /dev/null 2>&1 && echo "OK" || echo "FAIL"', {
        cwd: '/code'
      })
      return result.stdout.trim() === 'OK'
    } catch {
      return false
    }
  }

  /**
   * Monitors CPU usage of dev server process
   */
  private async checkCpuUsage(sandbox: Sandbox, devProcess: any): Promise<number> {
    try {
      const result = await sandbox.commands.run('ps aux | grep "npm run dev" | grep -v grep | awk \'{print $3}\'', {
        cwd: '/code'
      })
      const cpuUsage = parseFloat(result.stdout.trim()) || 0
      return cpuUsage
    } catch {
      return 0
    }
  }

  /**
   * Detects infinite loops by checking CPU usage over time
   */
  private async detectInfiniteLoop(sandbox: Sandbox, devProcess: any): Promise<boolean> {
    const samples = 3
    const highCpuThreshold = 85
    let highCpuCount = 0

    for (let i = 0; i < samples; i++) {
      const cpuUsage = await this.checkCpuUsage(sandbox, devProcess)
      if (cpuUsage > highCpuThreshold) {
        highCpuCount++
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // If CPU is consistently high, likely an infinite loop
    if (highCpuCount >= samples - 1) {
      logger.error({ 
        event: 'e2b.server.infinite_loop', 
        sandboxId: sandbox.sandboxId,
        highCpuCount,
        samples
      }, 'Infinite loop detected - killing process')

      // Kill the hanging process
      await sandbox.commands.run('pkill -f "npm run dev"', { cwd: '/code' })
      return true
    }

    return false
  }

  /**
   * Checks dev server logs for compilation errors with context
   */
  private async checkDevServerLogs(sandbox: Sandbox): Promise<{ hasErrors: boolean; errors: string[]; errorContext?: any }> {
    try {
      const result = await sandbox.commands.run('tail -n 50 /tmp/dev-server.log 2>/dev/null || echo ""', {
        cwd: '/code'
      })

      const logs = result.stdout
      const errors: string[] = []
      let errorContext: any = null
      
      // Check for common error patterns with context extraction
      const errorPatterns = [
        { pattern: /Error: (.+)/gi, type: 'error' },
        { pattern: /SyntaxError: (.+)/gi, type: 'syntax' },
        { pattern: /TypeError: (.+)/gi, type: 'type' },
        { pattern: /Module not found: (.+)/gi, type: 'module' },
        { pattern: /Failed to compile/gi, type: 'compile' },
        { pattern: /webpack\.Error: (.+)/gi, type: 'webpack' }
      ]

      for (const { pattern, type } of errorPatterns) {
        const matches = [...logs.matchAll(pattern)]
        if (matches.length > 0) {
          errors.push(...matches.map(m => m[0]))
          
          // Extract error context for fixing
          if (!errorContext) {
            errorContext = {
              type,
              message: matches[0][1] || matches[0][0],
              fullLogs: logs,
              affectedFile: this.extractAffectedFile(logs),
              lineNumber: this.extractLineNumber(logs)
            }
          }
        }
      }

      return { hasErrors: errors.length > 0, errors, errorContext }
    } catch {
      return { hasErrors: false, errors: [] }
    }
  }

  /**
   * Extracts the affected file from error logs
   */
  private extractAffectedFile(logs: string): string | null {
    const filePatterns = [
      /at (.+\.tsx?):(\d+):(\d+)/g,
      /in (.+\.tsx?)/g,
      /Module not found.*'(.+)'/g,
      /Error in (.+\.tsx?)/g
    ]

    for (const pattern of filePatterns) {
      const match = pattern.exec(logs)
      if (match && match[1]) {
        return match[1].replace('/code/', '')
      }
    }
    return null
  }

  /**
   * Extracts line number from error logs
   */
  private extractLineNumber(logs: string): number | null {
    const linePattern = /at .+:(\d+):(\d+)/g
    const match = linePattern.exec(logs)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Attempts to automatically fix compilation errors using Gemini
   */
  private async attemptErrorFix(sandbox: Sandbox, errors: string[], errorContext: any): Promise<boolean> {
    if (!errorContext || !errorContext.affectedFile) {
      logger.info({ 
        event: 'e2b.fix.skip', 
        reason: 'no_file_context',
        errors 
      }, 'Skipping auto-fix: cannot identify affected file')
      return false
    }

    try {
      logger.info({ 
        event: 'e2b.fix.attempt', 
        file: errorContext.affectedFile,
        errorType: errorContext.type,
        sandboxId: sandbox.sandboxId
      }, 'Attempting to fix compilation error')

      // Read the current file content
      const fileResult = await sandbox.commands.run(`cat /code/${errorContext.affectedFile} 2>/dev/null || echo "FILE_NOT_FOUND"`, {
        cwd: '/code'
      })

      if (fileResult.stdout.trim() === 'FILE_NOT_FOUND') {
        logger.warn({ 
          event: 'e2b.fix.file_not_found', 
          file: errorContext.affectedFile 
        }, 'Cannot fix: file not found')
        return false
      }

      // Generate fix using Gemini (simplified for now - would need proper integration)
      const fixedContent = await this.generateErrorFix(
        errorContext.affectedFile,
        fileResult.stdout,
        errorContext
      )

      if (!fixedContent) {
        return false
      }

      // Write the fixed content back to the file
      await sandbox.commands.run(`cat > /code/${errorContext.affectedFile} << 'AUTOFIX_EOF'
${fixedContent}
AUTOFIX_EOF`, {
        cwd: '/code'
      })

      logger.info({ 
        event: 'e2b.fix.applied', 
        file: errorContext.affectedFile,
        sandboxId: sandbox.sandboxId
      }, 'Applied auto-fix to file')

      return true

    } catch (error) {
      logger.error({ 
        event: 'e2b.fix.error', 
        error: error instanceof Error ? error.message : String(error),
        file: errorContext.affectedFile
      }, 'Failed to apply auto-fix')
      return false
    }
  }

  /**
   * Generates error fix using Gemini API for complex syntax/logic errors
   */
  private async generateErrorFix(filePath: string, content: string, errorContext: any): Promise<string | null> {
    const { type, message, fullLogs, lineNumber } = errorContext
    
    // Try basic fixes first for common patterns
    const basicFix = await this.tryBasicFixes(type, message, content)
    if (basicFix) {
      return basicFix
    }

    // For complex errors, use Gemini API
    try {
      logger.info({ 
        event: 'e2b.fix.gemini_api_attempt', 
        file: filePath,
        errorType: type,
        lineNumber
      }, 'Attempting Gemini API fix for complex error')

      const { generateWithGemini } = await import('./llmAdapter')
      const fixPrompt = this.buildErrorFixPrompt(filePath, content, errorContext)
      
      const systemPrompt = `You are an expert TypeScript/React developer specializing in fixing compilation errors. 
Analyze the error and provide only the corrected file content without explanations or markdown formatting.
Focus on minimal changes to fix the specific error while preserving existing functionality.`

      const response = await generateWithGemini({
        prompt: fixPrompt,
        system: systemPrompt
      })

      if (!response) {
        logger.warn({ 
          event: 'e2b.fix.gemini_empty_response', 
          file: filePath 
        }, 'Gemini returned empty response')
        return null
      }

      // Extract fixed code from Gemini's response
      const fixedContent = this.extractFixedCode(response, content)
      if (!fixedContent) {
        logger.warn({ 
          event: 'e2b.fix.gemini_parse_failed', 
          file: filePath 
        }, 'Failed to parse fixed code from Gemini response')
        return null
      }

      logger.info({ 
        event: 'e2b.fix.gemini_success', 
        file: filePath,
        responseLength: response.length
      }, 'Gemini successfully generated error fix')

      return fixedContent

    } catch (error) {
      logger.error({ 
        event: 'e2b.fix.gemini_error', 
        error: error instanceof Error ? error.message : String(error),
        file: filePath,
        errorType: type
      }, 'Gemini API fix attempt failed')
      return null
    }
  }

  /**
   * Attempts basic pattern-based fixes before using Gemini API
   */
  private async tryBasicFixes(type: string, message: string, content: string): Promise<string | null> {
    const errorClass = this.classifyError(type, message)
    
    switch (errorClass) {
      case 'missing_import':
        return this.fixMissingImport(message, content)
      case 'syntax_error':
        return this.fixBasicSyntax(message, content)
      case 'type_error':
        return this.fixBasicTypeError(message, content)
      default:
        return null
    }
  }

  /**
   * Classifies error types for appropriate fix strategies
   */
  private classifyError(type: string, message: string): string {
    if (type === 'module' && message.includes('Module not found')) {
      return 'missing_import'
    }
    if (type === 'syntax' && (message.includes('Unexpected token') || message.includes('Expected'))) {
      return 'syntax_error'
    }
    if (type === 'type' && (message.includes('Property') || message.includes('Argument of type'))) {
      return 'type_error'
    }
    if (message.includes('JSX element') || message.includes('React')) {
      return 'react_jsx_error'
    }
    return 'complex_error'
  }

  /**
   * Fixes missing import errors
   */
  private fixMissingImport(message: string, content: string): string | null {
    logger.info({ 
      event: 'e2b.fix.missing_import', 
      message 
    }, 'Attempting missing import fix')
    
    const moduleMatch = message.match(/Module not found.*['"](.+)['"]/i)
    if (moduleMatch) {
      const missingModule = moduleMatch[1]
      
      const commonFixes: { [key: string]: string } = {
        'react': "import React from 'react'",
        'next/link': "import Link from 'next/link'",
        'next/image': "import Image from 'next/image'",
        'next/router': "import { useRouter } from 'next/router'",
        'next/head': "import Head from 'next/head'",
        'react/jsx-runtime': '' // JSX runtime is auto-imported
      }
      
      if (commonFixes[missingModule] !== undefined) {
        const importStatement = commonFixes[missingModule]
        if (importStatement && !content.includes(importStatement)) {
          const lines = content.split('\n')
          const importIndex = lines.findIndex(line => line.startsWith('import ')) || 0
          lines.splice(importIndex, 0, importStatement)
          return lines.join('\n')
        }
      }
    }
    return null
  }

  /**
   * Fixes basic syntax errors
   */
  private fixBasicSyntax(message: string, content: string): string | null {
    logger.info({ 
      event: 'e2b.fix.basic_syntax', 
      message 
    }, 'Attempting basic syntax fix')
    
    // Fix missing semicolons
    if (message.includes('Expected ";"')) {
      // This would need line number context for proper fixing
      return null
    }
    
    // Fix unclosed brackets/braces
    if (message.includes('Expected "}"')) {
      const openBraces = (content.match(/{/g) || []).length
      const closeBraces = (content.match(/}/g) || []).length
      if (openBraces > closeBraces) {
        return content + '\n}'
      }
    }
    
    return null
  }

  /**
   * Fixes basic TypeScript type errors
   */
  private fixBasicTypeError(message: string, content: string): string | null {
    logger.info({ 
      event: 'e2b.fix.basic_type_error', 
      message 
    }, 'Attempting basic type error fix')
    
    // Fix common React prop type issues
    if (message.includes('Property') && message.includes('does not exist on type')) {
      // This typically requires more context, defer to AI
      return null
    }
    
    return null
  }

  /**
   * Builds a comprehensive prompt for Gemini to fix the error
   */
  private buildErrorFixPrompt(filePath: string, content: string, errorContext: any): string {
    const { type, message, fullLogs, lineNumber } = errorContext
    const errorClass = this.classifyError(type, message)
    
    // Customize prompt based on error classification
    const specificInstructions = this.getErrorSpecificInstructions(errorClass)

    return `Fix this ${type} error in a TypeScript/React Next.js file:

**Error Details:**
- File: ${filePath}
- Error Type: ${type}
- Error Classification: ${errorClass}
- Error Message: ${message}
${lineNumber ? `- Line Number: ${lineNumber}` : ''}

**Current File Content:**
\`\`\`typescript
${content}
\`\`\`

**Full Error Logs:**
\`\`\`
${fullLogs?.substring(0, 1000) || 'No additional logs'}
\`\`\`

**General Instructions:**
1. Analyze the error and identify the root cause
2. Fix the error while preserving the existing functionality
3. Follow Next.js and React best practices
4. Use TypeScript types correctly
5. Return ONLY the corrected file content
6. Do not include explanations or markdown formatting
7. Ensure all imports are properly added/fixed
8. Make minimal changes necessary to fix the error

**Specific Instructions for ${errorClass}:**
${specificInstructions}

**Fixed Code:**`
  }

  /**
   * Gets error-specific instructions for Gemini
   */
  private getErrorSpecificInstructions(errorClass: string): string {
    switch (errorClass) {
      case 'missing_import':
        return '- Add the missing import statement at the top of the file\n- Use correct import syntax (default vs named imports)\n- Check if the module name is correct'
      case 'syntax_error':
        return '- Fix syntax issues like missing brackets, semicolons, or parentheses\n- Ensure proper JSX syntax\n- Check for unclosed tags or expressions'
      case 'type_error':
        return '- Add proper TypeScript type annotations\n- Fix interface/type mismatches\n- Ensure props are correctly typed'
      case 'react_jsx_error':
        return '- Ensure JSX elements are properly closed\n- Fix React component usage\n- Add missing React imports if needed'
      default:
        return '- Focus on the specific error message\n- Make minimal but effective changes\n- Test that the fix addresses the root cause'
    }
  }

  /**
   * Extracts the fixed code from Gemini's response
   */
  private extractFixedCode(response: string, originalContent: string): string | null {
    // Try to extract code block first
    const codeBlockMatch = response.match(/```(?:typescript|tsx|ts|javascript|jsx|js)?\n([\s\S]*?)\n```/)
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim()
    }

    // If no code block, look for code after "Fixed Code:" or similar markers
    const fixedCodeMatch = response.match(/(?:Fixed Code:|Fixed:|Solution:)\s*\n([\s\S]*?)(?:\n\n|$)/i)
    if (fixedCodeMatch && fixedCodeMatch[1]) {
      return fixedCodeMatch[1].trim()
    }

    // If response looks like direct code (starts with import/export/const/function/etc)
    const directCodeMatch = response.match(/^((?:import|export|const|function|class|interface|type)\b[\s\S]*)/m)
    if (directCodeMatch && directCodeMatch[1]) {
      return directCodeMatch[1].trim()
    }

    // As fallback, if response is significantly different from original and looks like code
    if (response.length > 50 && 
        response.includes('import') && 
        !response.toLowerCase().includes('error') &&
        response !== originalContent) {
      return response.trim()
    }

    return null
  }

  /**
   * Stores sandbox information in Supabase
   */
  private async storeSandboxInfo(config: E2BSandboxConfig, sandboxInfo: SandboxInfo): Promise<void> {
    if (!supabase) {
      logger.warn({ 
        event: 'e2b.storage.skipped', 
        reason: 'Supabase not configured',
        sandboxId: sandboxInfo.sandboxId
      }, 'Skipping sandbox info storage - Supabase not configured');
      return;
    }

    try {
      const { error } = await supabase
        .from('sandbox_instances')
        .insert({
          workspace_id: config.workspaceId,
          conversation_id: config.conversationId,
          sandbox_id: sandboxInfo.sandboxId,
          sandbox_url: sandboxInfo.sandboxUrl,
          status: sandboxInfo.status,
          template_id: this.templateId,
          created_at: sandboxInfo.createdAt
        })

      if (error) {
        logger.error({ 
          event: 'e2b.storage.error', 
          error: error instanceof Error ? error.message : String(error),
          sandboxId: sandboxInfo.sandboxId
        }, 'Failed to store sandbox info')
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.storage.error', 
        error: error instanceof Error ? error.message : String(error),
        sandboxId: sandboxInfo.sandboxId
      }, 'Failed to store sandbox info')
    }
  }

  /**
   * Retrieves sandbox information from Supabase
   */
  async getSandboxInfo(conversationId: string, workspaceId: string): Promise<SandboxInfo | null> {
    if (!supabase) {
      logger.warn({ 
        event: 'e2b.retrieval.skipped', 
        reason: 'Supabase not configured',
        conversationId
      }, 'Skipping sandbox info retrieval - Supabase not configured');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('sandbox_instances')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        return null
      }

      return {
        sandboxId: data.sandbox_id,
        sandboxUrl: data.sandbox_url,
        status: data.status,
        createdAt: data.created_at
      }

    } catch (error) {
      logger.error({ 
        event: 'e2b.retrieval.error', 
        error: error instanceof Error ? error.message : String(error),
        conversationId
      }, 'Failed to retrieve sandbox info')
      return null
    }
  }
}