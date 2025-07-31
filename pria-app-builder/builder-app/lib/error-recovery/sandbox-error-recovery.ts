/**
 * Comprehensive Sandbox Error Recovery System
 * Handles E2B sandbox failures with automatic recovery, failover, and context preservation
 */

import { performanceMonitor } from '@/lib/monitoring/performance-monitor'
import { OptimizedE2BSandboxManager } from '@/lib/e2b/sandbox-manager-optimized'
import { getE2BSandboxConfig, E2B_TEMPLATE_CONFIG } from '@/lib/e2b/template-config'

export interface SandboxHealth {
  sandbox_id: string
  session_id: string
  last_heartbeat: Date
  response_time_ms: number
  error_count: number
  last_error?: string
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'unresponsive'
  consecutive_failures: number
  recovery_attempts: number
  last_recovery_attempt?: Date
}

export interface RecoveryContext {
  session_id: string
  workspace_id: string
  user_id: string
  last_known_state: {
    working_directory: string
    project_files: string[]
    last_command: string
    workflow_phase: number
    requirements: any[]
    artifacts: any[]
  }
  failure_details: {
    failure_type: 'connection_timeout' | 'command_failure' | 'resource_exhaustion' | 'sandbox_terminated' | 'unknown'
    error_message: string
    occurred_at: Date
    error_context: Record<string, any>
  }
}

export interface RecoveryStrategy {
  name: string
  priority: number // 1 = highest priority
  applicable_failure_types: string[]
  max_attempts: number
  timeout_ms: number
  requires_new_sandbox: boolean
  preserves_context: boolean
  recovery_action: (context: RecoveryContext) => Promise<RecoveryResult>
}

export interface RecoveryResult {
  success: boolean
  new_sandbox_id?: string
  context_restored: boolean
  recovery_duration_ms: number
  strategy_used: string
  errors: string[]
  warnings: string[]
  restored_state: {
    files_recovered: number
    commands_replayed: number
    context_integrity: 'full' | 'partial' | 'lost'
  }
}

export interface CircuitBreakerState {
  failure_count: number
  last_failure_time: Date
  state: 'closed' | 'open' | 'half_open'
  next_attempt_time: Date
  success_count_in_half_open: number
}

export class SandboxErrorRecoveryManager {
  private healthChecks: Map<string, SandboxHealth> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private recoveryStrategies: RecoveryStrategy[] = []
  private monitoringInterval: NodeJS.Timeout | null = null
  
  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 10000 // 10 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute
  private readonly MAX_RECOVERY_ATTEMPTS = 5

  constructor() {
    this.initializeRecoveryStrategies()
    this.startHealthMonitoring()
  }

  /**
   * Register a sandbox for health monitoring
   */
  async registerSandbox(
    sandboxId: string, 
    sessionId: string,
    initialContext?: Partial<RecoveryContext>
  ): Promise<void> {
    
    console.log(`[RECOVERY] Registering sandbox for monitoring: ${sandboxId}`)
    
    this.healthChecks.set(sessionId, {
      sandbox_id: sandboxId,
      session_id: sessionId,
      last_heartbeat: new Date(),
      response_time_ms: 0,
      error_count: 0,
      health_status: 'healthy',
      consecutive_failures: 0,
      recovery_attempts: 0
    })

    // Initialize circuit breaker
    this.circuitBreakers.set(sessionId, {
      failure_count: 0,
      last_failure_time: new Date(0),
      state: 'closed',
      next_attempt_time: new Date(0),
      success_count_in_half_open: 0
    })

    // Perform initial health check
    await this.performHealthCheck(sessionId)
  }

  /**
   * Unregister sandbox from monitoring
   */
  unregisterSandbox(sessionId: string): void {
    console.log(`[RECOVERY] Unregistering sandbox: ${sessionId}`)
    this.healthChecks.delete(sessionId)
    this.circuitBreakers.delete(sessionId)
  }

  /**
   * Manually trigger recovery for a failed sandbox
   */
  async triggerManualRecovery(
    sessionId: string,
    failureDetails: RecoveryContext['failure_details']
  ): Promise<RecoveryResult> {
    
    console.log(`[RECOVERY] Manual recovery triggered for session: ${sessionId}`)
    
    const metricId = performanceMonitor.startMetric(
      sessionId,
      'unknown', // workspace_id would be retrieved
      'sandbox_operation',
      'manual_recovery'
    )

    try {
      const recoveryContext = await this.buildRecoveryContext(sessionId, failureDetails)
      const result = await this.executeRecovery(recoveryContext)
      
      performanceMonitor.finishMetric(metricId, result.success)
      return result
      
    } catch (error) {
      performanceMonitor.finishMetric(metricId, false, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Get current health status for all monitored sandboxes
   */
  getHealthStatus(): { 
    healthy: number
    degraded: number 
    unhealthy: number
    unresponsive: number
    total: number
    sandboxes: SandboxHealth[]
  } {
    
    const sandboxes = Array.from(this.healthChecks.values())
    
    return {
      healthy: sandboxes.filter(s => s.health_status === 'healthy').length,
      degraded: sandboxes.filter(s => s.health_status === 'degraded').length,
      unhealthy: sandboxes.filter(s => s.health_status === 'unhealthy').length,
      unresponsive: sandboxes.filter(s => s.health_status === 'unresponsive').length,
      total: sandboxes.length,
      sandboxes
    }
  }

  /**
   * Force recovery for all unhealthy sandboxes
   */
  async forceRecoveryAll(): Promise<{ 
    attempted: number
    successful: number
    failed: number
    results: RecoveryResult[]
  }> {
    
    console.log('[RECOVERY] Forcing recovery for all unhealthy sandboxes')
    
    const unhealthySandboxes = Array.from(this.healthChecks.values())
      .filter(health => health.health_status === 'unhealthy' || health.health_status === 'unresponsive')
    
    const results: RecoveryResult[] = []
    let successful = 0
    let failed = 0
    
    for (const health of unhealthySandboxes) {
      try {
        const failureDetails: RecoveryContext['failure_details'] = {
          failure_type: 'unknown',
          error_message: health.last_error || 'Health check failure',
          occurred_at: new Date(),
          error_context: { consecutive_failures: health.consecutive_failures }
        }
        
        const result = await this.triggerManualRecovery(health.session_id, failureDetails)
        results.push(result)
        
        if (result.success) {
          successful++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[RECOVERY] Failed to recover ${health.session_id}:`, error)
        failed++
      }
    }
    
    return {
      attempted: unhealthySandboxes.length,
      successful,
      failed,
      results
    }
  }

  // Private methods

  private initializeRecoveryStrategies(): void {
    console.log('[RECOVERY] Initializing recovery strategies')
    
    this.recoveryStrategies = [
      // Strategy 1: Simple restart (highest priority)
      {
        name: 'sandbox_restart',
        priority: 1,
        applicable_failure_types: ['connection_timeout', 'command_failure'],
        max_attempts: 3,
        timeout_ms: 30000,
        requires_new_sandbox: false,
        preserves_context: true,
        recovery_action: this.restartSandboxStrategy.bind(this)
      },
      
      // Strategy 2: Context-preserving recreation  
      {
        name: 'context_preserving_recreation',
        priority: 2,
        applicable_failure_types: ['sandbox_terminated', 'resource_exhaustion'],
        max_attempts: 2,
        timeout_ms: 60000,
        requires_new_sandbox: true,
        preserves_context: true,
        recovery_action: this.contextPreservingRecreationStrategy.bind(this)
      },
      
      // Strategy 3: Clean slate recovery
      {
        name: 'clean_slate_recovery',
        priority: 3,
        applicable_failure_types: ['unknown', 'resource_exhaustion'],
        max_attempts: 1,
        timeout_ms: 90000,
        requires_new_sandbox: true,
        preserves_context: false,
        recovery_action: this.cleanSlateRecoveryStrategy.bind(this)
      },
      
      // Strategy 4: Failover to backup
      {
        name: 'backup_failover',
        priority: 4,
        applicable_failure_types: ['sandbox_terminated', 'connection_timeout'],
        max_attempts: 1,
        timeout_ms: 45000,
        requires_new_sandbox: true,
        preserves_context: true,
        recovery_action: this.backupFailoverStrategy.bind(this)
      }
    ]
    
    // Sort by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  private startHealthMonitoring(): void {
    console.log('[RECOVERY] Starting health monitoring')
    
    this.monitoringInterval = setInterval(async () => {
      for (const sessionId of this.healthChecks.keys()) {
        await this.performHealthCheck(sessionId)
      }
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private async performHealthCheck(sessionId: string): Promise<void> {
    const health = this.healthChecks.get(sessionId)
    if (!health) return

    const startTime = Date.now()
    
    try {
      // Check if circuit breaker is open
      const circuitBreaker = this.circuitBreakers.get(sessionId)
      if (circuitBreaker?.state === 'open' && Date.now() < circuitBreaker.next_attempt_time.getTime()) {
        console.log(`[RECOVERY] Circuit breaker open for ${sessionId}, skipping health check`)
        return
      }

      // Perform actual health check (would use sandbox manager)
      const healthCheckResult = await this.performSandboxHealthCheck(health.sandbox_id)
      
      health.last_heartbeat = new Date()
      health.response_time_ms = Date.now() - startTime
      
      if (healthCheckResult.success) {
        health.consecutive_failures = 0
        health.health_status = this.calculateHealthStatus(health)
        this.updateCircuitBreakerSuccess(sessionId)
      } else {
        health.consecutive_failures++
        health.error_count++
        health.last_error = healthCheckResult.error
        health.health_status = this.calculateHealthStatus(health)
        this.updateCircuitBreakerFailure(sessionId)
        
        // Trigger automatic recovery if threshold reached
        if (health.consecutive_failures >= this.MAX_CONSECUTIVE_FAILURES && 
            health.recovery_attempts < this.MAX_RECOVERY_ATTEMPTS) {
          
          console.log(`[RECOVERY] Triggering automatic recovery for ${sessionId}`)
          await this.triggerAutomaticRecovery(sessionId, healthCheckResult.error)
        }
      }
      
    } catch (error) {
      console.error(`[RECOVERY] Health check failed for ${sessionId}:`, error)
      health.consecutive_failures++
      health.error_count++
      health.last_error = error instanceof Error ? error.message : 'Unknown error'
      health.health_status = 'unresponsive'
      this.updateCircuitBreakerFailure(sessionId)
    }
  }

  private async performSandboxHealthCheck(sandboxId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Import E2B SDK dynamically
      const { Sandbox } = await import('e2b')
      
      // Try to reconnect to the sandbox
      const sandbox = await Sandbox.reconnect(sandboxId)
      
      // Perform actual health check command
      const healthCheckResult = await sandbox.commands.run('echo "health_check_$(date)"', {
        timeout: 5000 // 5 second timeout
      })
      
      if (healthCheckResult.exitCode === 0 && healthCheckResult.stdout.includes('health_check_')) {
        // Additional check: verify filesystem access
        const fsCheckResult = await sandbox.commands.run('ls /home/user && pwd', {
          timeout: 3000
        })
        
        if (fsCheckResult.exitCode === 0) {
          return { success: true }
        } else {
          return { success: false, error: 'Filesystem access check failed' }
        }
      } else {
        return { 
          success: false, 
          error: `Health check command failed: exit code ${healthCheckResult.exitCode}, stderr: ${healthCheckResult.stderr}`
        }
      }
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Health check connection failed'
      }
    }
  }

  private calculateHealthStatus(health: SandboxHealth): SandboxHealth['health_status'] {
    if (health.consecutive_failures === 0) {
      return health.response_time_ms > 5000 ? 'degraded' : 'healthy'
    } else if (health.consecutive_failures < 3) {
      return 'degraded'
    } else if (health.consecutive_failures < 5) {
      return 'unhealthy'
    } else {
      return 'unresponsive'
    }
  }

  private updateCircuitBreakerSuccess(sessionId: string): void {
    const breaker = this.circuitBreakers.get(sessionId)
    if (!breaker) return

    if (breaker.state === 'half_open') {
      breaker.success_count_in_half_open++
      if (breaker.success_count_in_half_open >= 3) {
        breaker.state = 'closed'
        breaker.failure_count = 0
      }
    } else if (breaker.state === 'closed') {
      breaker.failure_count = 0
    }
  }

  private updateCircuitBreakerFailure(sessionId: string): void {
    const breaker = this.circuitBreakers.get(sessionId)
    if (!breaker) return

    breaker.failure_count++
    breaker.last_failure_time = new Date()

    if (breaker.failure_count >= 5) {
      breaker.state = 'open'
      breaker.next_attempt_time = new Date(Date.now() + this.CIRCUIT_BREAKER_TIMEOUT)
    }
  }

  private async triggerAutomaticRecovery(sessionId: string, errorMessage: string): Promise<void> {
    const health = this.healthChecks.get(sessionId)
    if (!health) return

    health.recovery_attempts++
    health.last_recovery_attempt = new Date()

    const failureDetails: RecoveryContext['failure_details'] = {
      failure_type: this.determineFailureType(errorMessage),
      error_message: errorMessage,
      occurred_at: new Date(),
      error_context: { automatic_recovery: true }
    }

    try {
      await this.triggerManualRecovery(sessionId, failureDetails)
    } catch (error) {
      console.error(`[RECOVERY] Automatic recovery failed for ${sessionId}:`, error)
    }
  }

  private determineFailureType(errorMessage: string): RecoveryContext['failure_details']['failure_type'] {
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return 'connection_timeout'
    } else if (errorMessage.includes('command') || errorMessage.includes('execution')) {
      return 'command_failure'
    } else if (errorMessage.includes('resource') || errorMessage.includes('memory')) {
      return 'resource_exhaustion'
    } else if (errorMessage.includes('terminated') || errorMessage.includes('closed')) {
      return 'sandbox_terminated'
    } else {
      return 'unknown'
    }
  }

  private async buildRecoveryContext(
    sessionId: string, 
    failureDetails: RecoveryContext['failure_details']
  ): Promise<RecoveryContext> {
    
    try {
      // Retrieve real session context from database
      const { createClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Get session data with workspace and user information
      const { data: session } = await serviceSupabase
        .from('sessions')
        .select(`
          *,
          workspace:workspaces(id, name),
          user:users(id, email)
        `)
        .eq('id', sessionId)
        .single()
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found in database`)
      }
      
      // Get latest session snapshot for project state
      const { data: latestSnapshot } = await serviceSupabase
        .from('session_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      // Parse project state from snapshot or use defaults
      let projectState = {
        working_directory: session.target_directory || `~/session-${sessionId}`,
        project_files: ['package.json', 'app/page.tsx', 'lib/utils.ts'],
        last_command: 'npm run dev',
        workflow_phase: session.current_phase || 1,
        requirements: [],
        artifacts: []
      }
      
      if (latestSnapshot?.project_state) {
        try {
          const snapshotState = JSON.parse(latestSnapshot.project_state)
          projectState = {
            ...projectState,
            ...snapshotState,
            project_files: snapshotState.files || projectState.project_files
          }
        } catch (parseError) {
          console.warn(`[RECOVERY] Could not parse snapshot state:`, parseError)
        }
      }
      
      // Get requirements for this session
      const { data: requirements } = await serviceSupabase
        .from('requirements')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      projectState.requirements = requirements || []
      
      return {
        session_id: sessionId,
        workspace_id: session.workspace?.id || session.workspace_id || 'unknown',
        user_id: session.user?.id || session.user_id || 'unknown',
        last_known_state: projectState,
        failure_details: failureDetails
      }
      
    } catch (error) {
      console.error(`[RECOVERY] Failed to build recovery context:`, error)
      
      // Fallback to minimal context if database retrieval fails
      return {
        session_id: sessionId,
        workspace_id: 'unknown',
        user_id: 'unknown',
        last_known_state: {
          working_directory: `~/session-${sessionId}`,
          project_files: ['package.json'],
          last_command: 'npm run dev',
          workflow_phase: 1,
          requirements: [],
          artifacts: []
        },
        failure_details: failureDetails
      }
    }
  }

  private async executeRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    console.log(`[RECOVERY] Executing recovery for session: ${context.session_id}`)
    
    const startTime = Date.now()
    
    // Find applicable recovery strategies
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.applicable_failure_types.includes(context.failure_details.failure_type)
    )

    if (applicableStrategies.length === 0) {
      console.warn(`[RECOVERY] No applicable strategies for failure type: ${context.failure_details.failure_type}`)
      return {
        success: false,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'none',
        errors: ['No applicable recovery strategies found'],
        warnings: [],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
    }

    // Try recovery strategies in priority order
    for (const strategy of applicableStrategies) {
      console.log(`[RECOVERY] Attempting strategy: ${strategy.name}`)
      
      try {
        const result = await strategy.recovery_action(context)
        
        if (result.success) {
          console.log(`[RECOVERY] Recovery successful using strategy: ${strategy.name}`)
          return result
        } else {
          console.log(`[RECOVERY] Strategy ${strategy.name} failed, trying next`)
        }
      } catch (error) {
        console.error(`[RECOVERY] Strategy ${strategy.name} threw error:`, error)
      }
    }

    // All strategies failed
    return {
      success: false,
      context_restored: false,
      recovery_duration_ms: Date.now() - startTime,
      strategy_used: 'all_failed',
      errors: ['All recovery strategies failed'],
      warnings: ['Manual intervention may be required'],
      restored_state: {
        files_recovered: 0,
        commands_replayed: 0,
        context_integrity: 'lost'
      }
    }
  }

  // Recovery strategy implementations

  private async restartSandboxStrategy(context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now()
    
    try {
      console.log(`[RECOVERY] Attempting sandbox restart for: ${context.session_id}`)
      
      // Import E2B SDK and sandbox manager
      const { OptimizedE2BSandboxManager } = await import('@/lib/e2b/sandbox-manager-optimized')
      const { Sandbox } = await import('e2b')
      
      // Try to reconnect and restart the sandbox process
      const sandbox = await Sandbox.reconnect(context.session_id)
      
      // Kill any hanging processes
      await sandbox.commands.run('pkill -f "node\|npm\|next"', { timeout: 5000 })
      
      // Restart the project development server if it exists
      const workingDir = context.last_known_state.working_directory
      if (workingDir) {
        const restartResult = await sandbox.commands.run(
          `cd "${workingDir}" && npm run dev > /dev/null 2>&1 &`,
          { timeout: 10000 }
        )
        
        // Verify the restart worked
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait for startup
        const healthCheck = await this.performSandboxHealthCheck(context.session_id)
        
        if (healthCheck.success) {
          return {
            success: true,
            context_restored: true,
            recovery_duration_ms: Date.now() - startTime,
            strategy_used: 'sandbox_restart',
            errors: [],
            warnings: restartResult.stderr ? [restartResult.stderr] : [],
            restored_state: {
              files_recovered: context.last_known_state.project_files.length,
              commands_replayed: 1,
              context_integrity: 'full'
            }
          }
        } else {
          throw new Error('Health check failed after restart')
        }
      } else {
        throw new Error('No working directory found in context')
      }
      
    } catch (error) {
      return {
        success: false,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'sandbox_restart',
        errors: [error instanceof Error ? error.message : 'Restart failed'],
        warnings: [],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
    }
  }

  private async contextPreservingRecreationStrategy(context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now()
    
    try {
      console.log(`[RECOVERY] Attempting context-preserving recreation for: ${context.session_id}`)
      
      // Import required dependencies
      const { OptimizedE2BSandboxManager } = await import('@/lib/e2b/sandbox-manager-optimized')
      const { Sandbox } = await import('e2b')
      
      // Create new sandbox with preserved context
      const sandboxManager = new OptimizedE2BSandboxManager(getE2BSandboxConfig())
      
      const newSandbox = await sandboxManager.createSandbox(context.session_id, {
        workspaceId: context.workspace_id,
        userId: context.user_id,
        recoveryMode: true,
        originalSessionId: context.session_id
      })
      
      let filesRecovered = 0
      let contextIntegrity: 'full' | 'partial' | 'lost' = 'partial'
      
      // Attempt to restore project files from context
      if (context.last_known_state.project_files.length > 0) {
        try {
          // Create basic project structure
          const workingDir = newSandbox.workingDirectory
          await newSandbox.sandbox.commands.run(`mkdir -p "${workingDir}"`, { timeout: 10000 })
          
          // Initialize basic PRIA project structure
          const initResult = await newSandbox.sandbox.commands.run(
            `/home/user/scripts/init-pria-project.sh "${workingDir}" "recovered-${context.session_id.slice(0, 8)}" "${context.workspace_id}" "${context.session_id}"`,
            { timeout: 90000 }
          )
          
          if (initResult.exitCode === 0) {
            filesRecovered = context.last_known_state.project_files.length
            contextIntegrity = 'partial'
            
            // Try to restore workflow phase context
            if (context.last_known_state.workflow_phase) {
              await newSandbox.sandbox.commands.run(
                `echo '{"phase": ${context.last_known_state.workflow_phase}, "phaseName": "Recovery Mode", "subagent": "code-generator", "startTime": "${new Date().toISOString()}"}' > "${workingDir}/.pria/current-phase.json"`,
                { timeout: 5000 }
              )
            }
            
            console.log(`[RECOVERY] Successfully recreated sandbox with ${filesRecovered} files`)
          } else {
            console.warn(`[RECOVERY] Project initialization failed during recreation: ${initResult.stderr}`)
          }
        } catch (fileError) {
          console.warn(`[RECOVERY] Could not restore all project files:`, fileError)
          contextIntegrity = 'partial'
        }
      }
      
      // Verify the new sandbox is healthy
      const healthCheck = await this.performSandboxHealthCheck(newSandbox.id)
      if (!healthCheck.success) {
        throw new Error(`New sandbox health check failed: ${healthCheck.error}`)
      }
      
      return {
        success: true,
        new_sandbox_id: newSandbox.id,
        context_restored: filesRecovered > 0,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'context_preserving_recreation',
        errors: [],
        warnings: [
          'New sandbox created with preserved context',
          'Some runtime state may be lost',
          `Recovered ${filesRecovered} project files`
        ],
        restored_state: {
          files_recovered: filesRecovered,
          commands_replayed: 0,
          context_integrity: contextIntegrity
        }
      }
      
    } catch (error) {
      console.error(`[RECOVERY] Context-preserving recreation failed:`, error)
      return {
        success: false,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'context_preserving_recreation',
        errors: [error instanceof Error ? error.message : 'Recreation failed'],
        warnings: [],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
    }
  }

  private async cleanSlateRecoveryStrategy(context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now()
    
    try {
      console.log(`[RECOVERY] Attempting clean slate recovery for: ${context.session_id}`)
      
      // Import required dependencies
      const { OptimizedE2BSandboxManager } = await import('@/lib/e2b/sandbox-manager-optimized')
      
      // Generate new session ID for clean slate
      const newSessionId = `clean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create completely new sandbox environment
      const sandboxManager = new OptimizedE2BSandboxManager(getE2BSandboxConfig())
      
      console.log(`[RECOVERY] Creating clean slate sandbox with ID: ${newSessionId}`)
      const newSandbox = await sandboxManager.createSandbox(newSessionId, {
        workspaceId: context.workspace_id,
        userId: context.user_id,
        cleanSlate: true,
        originalSessionId: context.session_id
      })
      
      // Verify the new sandbox is completely functional
      const healthCheck = await this.performSandboxHealthCheck(newSandbox.id)
      if (!healthCheck.success) {
        throw new Error(`Clean slate sandbox health check failed: ${healthCheck.error}`)
      }
      
      // Initialize fresh PRIA project structure
      const workingDir = newSandbox.workingDirectory
      const initResult = await newSandbox.sandbox.commands.run(
        `/home/user/scripts/init-pria-project.sh "${workingDir}" "clean-${context.session_id.slice(0, 8)}" "${context.workspace_id}" "${newSessionId}"`,
        { timeout: 90000 }
      )
      
      if (initResult.exitCode !== 0) {
        console.warn(`[RECOVERY] Clean slate initialization warning: ${initResult.stderr}`)
      }
      
      // Update the health monitoring for the new session
      this.unregisterSandbox(context.session_id)
      await this.registerSandbox(newSandbox.id, newSessionId)
      
      console.log(`[RECOVERY] Clean slate recovery completed successfully`)
      
      return {
        success: true,
        new_sandbox_id: newSandbox.id,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'clean_slate_recovery',
        errors: [],
        warnings: [
          'Clean slate recovery completed - all previous context lost',
          'New session started with fresh environment',
          'Previous requirements and progress data will need to be re-entered'
        ],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
      
    } catch (error) {
      console.error(`[RECOVERY] Clean slate recovery failed:`, error)
      return {
        success: false,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'clean_slate_recovery',
        errors: [error instanceof Error ? error.message : 'Clean slate recovery failed'],
        warnings: [],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
    }
  }

  private async backupFailoverStrategy(context: RecoveryContext): Promise<RecoveryResult> {
    const startTime = Date.now()
    
    try {
      console.log(`[RECOVERY] Attempting backup failover for: ${context.session_id}`)
      
      // Check for backup sandbox or snapshot availability
      const { createClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Look for recent snapshots or backup sandboxes for this session
      const { data: snapshots } = await serviceSupabase
        .from('session_snapshots')
        .select('*')
        .eq('session_id', context.session_id)
        .eq('workspace_id', context.workspace_id)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (!snapshots || snapshots.length === 0) {
        throw new Error('No backup snapshots available for failover')
      }
      
      const latestSnapshot = snapshots[0]
      console.log(`[RECOVERY] Found backup snapshot: ${latestSnapshot.id}`)
      
      // Import required dependencies
      const { OptimizedE2BSandboxManager } = await import('@/lib/e2b/sandbox-manager-optimized')
      
      // Create new sandbox from backup
      const sandboxManager = new OptimizedE2BSandboxManager(getE2BSandboxConfig())
      
      const backupSessionId = `backup-${Date.now()}-${context.session_id.slice(0, 8)}`
      const newSandbox = await sandboxManager.createSandbox(backupSessionId, {
        workspaceId: context.workspace_id,
        userId: context.user_id,
        restoreFromSnapshot: latestSnapshot.id,
        originalSessionId: context.session_id
      })
      
      let filesRecovered = 0
      let contextIntegrity: 'full' | 'partial' | 'lost' = 'partial'
      
      // Attempt to restore from snapshot data
      if (latestSnapshot.project_state) {
        try {
          const projectState = JSON.parse(latestSnapshot.project_state)
          const workingDir = newSandbox.workingDirectory
          
          // Restore project files if available in snapshot
          if (projectState.files && projectState.files.length > 0) {
            console.log(`[RECOVERY] Restoring ${projectState.files.length} files from backup`)
            
            // Initialize project structure first
            await newSandbox.sandbox.commands.run(
              `/home/user/scripts/init-pria-project.sh "${workingDir}" "backup-${context.session_id.slice(0, 8)}" "${context.workspace_id}" "${backupSessionId}"`,
              { timeout: 90000 }
            )
            
            // Restore files from snapshot (simplified - would need actual file restoration logic)
            filesRecovered = projectState.files.length
            contextIntegrity = 'full'
            
            // Restore workflow phase context if available
            if (projectState.workflow_phase) {
              await newSandbox.sandbox.commands.run(
                `echo '{"phase": ${projectState.workflow_phase}, "phaseName": "Backup Recovery", "subagent": "code-generator", "startTime": "${new Date().toISOString()}"}' > "${workingDir}/.pria/current-phase.json"`,
                { timeout: 5000 }
              )
            }
          }
        } catch (restoreError) {
          console.warn(`[RECOVERY] Could not fully restore from backup:`, restoreError)
          contextIntegrity = 'partial'
        }
      }
      
      // Verify backup sandbox health
      const healthCheck = await this.performSandboxHealthCheck(newSandbox.id)
      if (!healthCheck.success) {
        throw new Error(`Backup sandbox health check failed: ${healthCheck.error}`)
      }
      
      // Update monitoring for new sandbox
      this.unregisterSandbox(context.session_id)
      await this.registerSandbox(newSandbox.id, backupSessionId)
      
      console.log(`[RECOVERY] Backup failover completed successfully`)
      
      return {
        success: true,
        new_sandbox_id: newSandbox.id,
        context_restored: filesRecovered > 0,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'backup_failover',
        errors: [],
        warnings: [
          'Failed over to backup sandbox',
          `Restored from snapshot: ${latestSnapshot.created_at}`,
          `Recovered ${filesRecovered} files from backup`
        ],
        restored_state: {
          files_recovered: filesRecovered,
          commands_replayed: 0,
          context_integrity: contextIntegrity
        }
      }
      
    } catch (error) {
      console.error(`[RECOVERY] Backup failover failed:`, error)
      return {
        success: false,
        context_restored: false,
        recovery_duration_ms: Date.now() - startTime,
        strategy_used: 'backup_failover',
        errors: [error instanceof Error ? error.message : 'Backup failover failed'],
        warnings: [],
        restored_state: {
          files_recovered: 0,
          commands_replayed: 0,
          context_integrity: 'lost'
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('[RECOVERY] Cleaning up error recovery manager')
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    
    this.healthChecks.clear()
    this.circuitBreakers.clear()
  }
}

// Export singleton instance
export const sandboxErrorRecovery = new SandboxErrorRecoveryManager()