/**
 * End-to-End Workflow Testing for PRIA App Builder
 * 
 * Provides comprehensive testing utilities to validate the complete
 * Claude Code SDK integration and workflow functionality.
 */

import { InternalOperations, internalClient } from '@/lib/clients/internal-client'

export interface E2ETestConfig {
  skipCredentialCheck?: boolean
  timeoutMs?: number
  retryAttempts?: number
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

export interface TestResult {
  success: boolean
  step: string
  duration: number
  error?: string
  data?: any
}

export interface WorkflowTestResults {
  overall: {
    success: boolean
    totalDuration: number
    completedSteps: number
    totalSteps: number
  }
  steps: TestResult[]
  errors: string[]
  warnings: string[]
}

export class E2EWorkflowTester {
  private config: Required<E2ETestConfig>
  private results: TestResult[] = []
  private startTime: number = 0

  constructor(config: E2ETestConfig = {}) {
    this.config = {
      skipCredentialCheck: false,
      timeoutMs: 300000, // 5 minutes
      retryAttempts: 3,
      logLevel: 'info',
      ...config
    }
  }

  private log(level: string, message: string, data?: any) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 }
    if (levels[level as keyof typeof levels] >= levels[this.config.logLevel]) {
      console[level as keyof Console](`[E2E Test] ${message}`, data || '')
    }
  }

  private async runStep<T>(
    stepName: string, 
    operation: () => Promise<T>,
    retryable: boolean = true
  ): Promise<TestResult> {
    const stepStart = Date.now()
    this.log('info', `Starting step: ${stepName}`)

    let attempts = retryable ? this.config.retryAttempts : 1
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (attempt > 1) {
          this.log('info', `Retrying step: ${stepName} (attempt ${attempt}/${attempts})`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
        }

        const data = await operation()
        const duration = Date.now() - stepStart

        const result: TestResult = {
          success: true,
          step: stepName,
          duration,
          data
        }

        this.results.push(result)
        this.log('info', `✅ Completed step: ${stepName} (${duration}ms)`)
        return result

      } catch (error) {
        lastError = error as Error
        this.log('warn', `❌ Step failed: ${stepName} (attempt ${attempt}/${attempts})`, error)
        
        if (attempt === attempts) {
          const duration = Date.now() - stepStart
          const result: TestResult = {
            success: false,
            step: stepName,
            duration,
            error: lastError.message
          }
          
          this.results.push(result)
          return result
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Unknown error in runStep')
  }

  /**
   * Test 1: Environment and Credentials Check
   */
  async testEnvironmentSetup(): Promise<TestResult> {
    return this.runStep('Environment Setup Check', async () => {
      if (this.config.skipCredentialCheck) {
        return { status: 'skipped', message: 'Credential check skipped' }
      }

      const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
        'SUPABASE_SERVICE_ROLE_KEY',
        'ANTHROPIC_API_KEY',
        'E2B_API_KEY'
      ]

      const missing = requiredEnvVars.filter(key => !process.env[key] || process.env[key]?.includes('your_'))
      
      if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`)
      }

      // Test basic connectivity
      const healthCheck = await internalClient.healthCheck()
      
      return {
        status: 'success',
        credentials: 'validated',
        healthCheck
      }
    }, false)
  }

  /**
   * Test 2: Database Connectivity and Schema
   */
  async testDatabaseConnection(): Promise<TestResult> {
    return this.runStep('Database Connection', async () => {
      // Test workspace creation
      const testWorkspace = await internalClient.createWorkspace(
        `Test Workspace ${Date.now()}`,
        'E2E test workspace'
      )

      if (!testWorkspace.workspace?.id) {
        throw new Error('Failed to create test workspace')
      }

      return {
        workspaceId: testWorkspace.workspace.id,
        status: 'created'
      }
    })
  }

  /**
   * Test 3: E2B Sandbox Creation
   */
  async testSandboxCreation(workspaceId: string): Promise<TestResult> {
    return this.runStep('E2B Sandbox Creation', async () => {
      const sessionId = `test-session-${Date.now()}`
      
      const result = await internalClient.createSandbox(sessionId, workspaceId, {
        testMode: true,
        source: 'e2e-test'
      })

      if (!result.success) {
        throw new Error(result.error || 'Sandbox creation failed')
      }

      return {
        sessionId,
        sandboxId: result.result?.environment?.id,
        status: result.result?.environment?.status
      }
    })
  }

  /**
   * Test 4: Claude Code SDK Integration
   */
  async testClaudeIntegration(sessionId: string): Promise<TestResult> {
    return this.runStep('Claude Code SDK Integration', async () => {
      // Test basic Claude command execution
      const testCommand = 'ask "What is the current directory structure?"'
      
      const result = await internalClient.executeCommand(sessionId, testCommand, {
        timeout: 30000,
        testMode: true
      })

      if (!result.success) {
        throw new Error(result.error || 'Claude command execution failed')
      }

      return {
        command: testCommand,
        output: result.result?.output,
        executionTime: result.result?.output?.duration
      }
    })
  }

  /**
   * Test 5: File Operations
   */
  async testFileOperations(sessionId: string): Promise<TestResult> {
    return this.runStep('File Operations', async () => {
      const testFileName = 'test-file.md'
      const testContent = `# E2E Test File\n\nGenerated at: ${new Date().toISOString()}\nSession: ${sessionId}`

      // Test file write
      const writeResult = await internalClient.writeFile(sessionId, testFileName, testContent)
      if (!writeResult.success) {
        throw new Error('File write failed')
      }

      // Test file read
      const readResult = await internalClient.readFile(sessionId, testFileName)
      if (!readResult.success) {
        throw new Error('File read failed')
      }

      if (readResult.result?.content !== testContent) {
        throw new Error('File content mismatch')
      }

      // Test file listing
      const listResult = await internalClient.listFiles(sessionId)
      if (!listResult.success) {
        throw new Error('File listing failed')
      }

      const files = listResult.result?.files || []
      const testFile = files.find((f: any) => f.name === testFileName)
      if (!testFile) {
        throw new Error('Test file not found in listing')
      }

      return {
        fileName: testFileName,
        fileSize: testContent.length,
        totalFiles: files.length,
        operations: ['write', 'read', 'list']
      }
    })
  }

  /**
   * Test 6: Real-time Streaming
   */
  async testStreamingResponse(sessionId: string): Promise<TestResult> {
    return this.runStep('Streaming Response Test', async () => {
      const streamResponse = await internalClient.streamClaude({
        sessionId,
        message: 'Create a simple hello world function in TypeScript',
        options: { testMode: true }
      })

      if (!streamResponse.ok) {
        throw new Error('Stream initiation failed')
      }

      // Read stream chunks
      const reader = streamResponse.body?.getReader()
      if (!reader) {
        throw new Error('Stream reader unavailable')
      }

      const chunks: string[] = []
      const decoder = new TextDecoder()
      let chunkCount = 0
      const maxChunks = 10 // Limit for testing

      try {
        while (chunkCount < maxChunks) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          chunks.push(chunk)
          chunkCount++

          // Look for completion signal
          if (chunk.includes('"type":"done"')) {
            break
          }
        }
      } finally {
        reader.releaseLock()
      }

      return {
        chunksReceived: chunks.length,
        streamData: chunks.slice(0, 3), // First 3 chunks for verification
        streamWorking: chunks.length > 0
      }
    })
  }

  /**
   * Test 7: Project State Management
   */
  async testProjectState(sessionId: string): Promise<TestResult> {
    return this.runStep('Project State Management', async () => {
      const stateResult = await internalClient.getProjectState(sessionId)
      
      if (!stateResult.success) {
        throw new Error('Project state retrieval failed')
      }

      const projectState = stateResult.result?.projectState
      
      return {
        status: projectState?.status,
        fileCount: projectState?.files?.length || 0,
        hasPackageJson: projectState?.packageJson ? true : false,
        projectStructure: projectState?.files?.slice(0, 5) // Sample of files
      }
    })
  }

  /**
   * Test 8: Cleanup Operations
   */
  async testCleanup(sessionId: string): Promise<TestResult> {
    return this.runStep('Cleanup Operations', async () => {
      const cleanupResult = await internalClient.terminateSandbox(sessionId)
      
      if (!cleanupResult.success) {
        throw new Error('Sandbox termination failed')
      }

      return {
        sessionId,
        terminated: true,
        message: 'Sandbox cleaned up successfully'
      }
    }, false) // Don't retry cleanup
  }

  /**
   * Run complete end-to-end workflow test
   */
  async runCompleteWorkflow(config?: Partial<E2ETestConfig>): Promise<WorkflowTestResults> {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    this.startTime = Date.now()
    this.results = []

    this.log('info', '🚀 Starting complete E2E workflow test')

    // Test sequence
    const envResult = await this.testEnvironmentSetup()
    if (!envResult.success) {
      return this.generateResults(['Environment setup failed'])
    }

    const dbResult = await this.testDatabaseConnection()
    if (!dbResult.success) {
      return this.generateResults(['Database connection failed'])
    }

    const workspaceId = dbResult.data?.workspaceId
    if (!workspaceId) {
      return this.generateResults(['No workspace ID available'])
    }

    const sandboxResult = await this.testSandboxCreation(workspaceId)
    if (!sandboxResult.success) {
      return this.generateResults(['Sandbox creation failed'])
    }

    const sessionId = sandboxResult.data?.sessionId
    if (!sessionId) {
      return this.generateResults(['No session ID available'])
    }

    // Continue with sandbox-dependent tests
    await this.testClaudeIntegration(sessionId)
    await this.testFileOperations(sessionId)
    await this.testStreamingResponse(sessionId)
    await this.testProjectState(sessionId)
    
    // Always attempt cleanup
    await this.testCleanup(sessionId)

    return this.generateResults()
  }

  private generateResults(criticalErrors: string[] = []): WorkflowTestResults {
    const totalDuration = Date.now() - this.startTime
    const successful = this.results.filter(r => r.success)
    const failed = this.results.filter(r => !r.success)
    
    const errors = [
      ...criticalErrors,
      ...failed.map(r => `${r.step}: ${r.error}`)
    ]

    const warnings = this.results
      .filter(r => r.success && r.duration > 10000) // Slow operations
      .map(r => `${r.step} took ${r.duration}ms (slow)`)

    return {
      overall: {
        success: errors.length === 0,
        totalDuration,
        completedSteps: successful.length,
        totalSteps: this.results.length
      },
      steps: this.results,
      errors,
      warnings
    }
  }
}

/**
 * Simplified test runner for quick validation
 */
export async function runQuickE2ETest(config?: E2ETestConfig): Promise<WorkflowTestResults> {
  const tester = new E2EWorkflowTester(config)
  return await tester.runCompleteWorkflow()
}

/**
 * Health check test (minimal validation)
 */
export async function runHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
  const issues: string[] = []

  try {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'ANTHROPIC_API_KEY',
      'E2B_API_KEY'
    ]

    const missing = requiredEnvVars.filter(key => 
      !process.env[key] || 
      process.env[key]?.includes('your_') ||
      process.env[key]?.includes('template')
    )

    if (missing.length > 0) {
      issues.push(`Missing/template environment variables: ${missing.join(', ')}`)
    }

    // Test basic internal API
    const healthResult = await internalClient.healthCheck()
    if (!healthResult) {
      issues.push('Internal API health check failed')
    }

  } catch (error) {
    issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    healthy: issues.length === 0,
    issues
  }
}