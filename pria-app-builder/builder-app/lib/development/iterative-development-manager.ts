/**
 * Iterative Development Manager - Coordinates Phase 4 development with PRIA compliance
 * Manages code generation, validation, refinement cycles, and quality gates
 */

import { PRIAComplianceChecker, ComplianceReport } from '@/lib/compliance/pria-compliance-checker'
import createServerClient from '@/lib/supabase/server'

export interface DevelopmentTask {
  id: string
  title: string
  description: string
  type: 'database' | 'api' | 'component' | 'integration' | 'testing' | 'deployment' | 'documentation'
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'not_started' | 'in_progress' | 'code_review' | 'compliance_check' | 'testing' | 'completed' | 'blocked'
  estimated_hours: number
  actual_hours?: number
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'
  dependencies: string[]
  acceptance_criteria: string[]
  generated_files?: GeneratedFile[]
  compliance_score?: number
  last_compliance_check?: string
}

export interface GeneratedFile {
  path: string
  content: string
  type: 'component' | 'api' | 'type' | 'util' | 'test' | 'documentation'
  created_at: string
  updated_at: string
  compliance_issues?: number
}

export interface DevelopmentIteration {
  id: string
  task_id: string
  iteration_number: number
  description: string
  files_changed: string[]
  compliance_report: ComplianceReport
  feedback: string[]
  improvements: string[]
  status: 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
}

export interface DevelopmentSession {
  session_id: string
  workspace_id: string
  current_task?: DevelopmentTask
  active_iterations: DevelopmentIteration[]
  overall_compliance_score: number
  total_files_generated: number
  development_phase: 'planning' | 'implementation' | 'refinement' | 'validation' | 'completed'
  quality_gates_passed: string[]
  quality_gates_pending: string[]
}

export class IterativeDevelopmentManager {
  private sessionId: string
  private workspaceId: string

  constructor(sessionId: string, workspaceId: string) {
    this.sessionId = sessionId
    this.workspaceId = workspaceId
  }

  /**
   * Initialize development session for Phase 4
   */
  async initializeDevelopmentSession(): Promise<DevelopmentSession> {
    try {
      const supabase = await createServerClient()
      
      // Get pending tasks from Phase 3
      const { data: tasks, error } = await supabase
        .from('development_tasks')
        .select('*')
        .eq('session_id', this.sessionId)
        .eq('workspace_id', this.workspaceId)
        .eq('status', 'not_started')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) {
        throw new Error(`Failed to fetch development tasks: ${error.message}`)
      }

      const session: DevelopmentSession = {
        session_id: this.sessionId,
        workspace_id: this.workspaceId,
        current_task: tasks?.[0] || undefined,
        active_iterations: [],
        overall_compliance_score: 100,
        total_files_generated: 0,
        development_phase: 'planning',
        quality_gates_passed: [],
        quality_gates_pending: [
          'authentication_implementation',
          'database_schema_implementation', 
          'api_endpoints_implementation',
          'ui_components_implementation',
          'error_handling_implementation',
          'testing_implementation',
          'pria_compliance_validation'
        ]
      }

      await this.saveDevelopmentSession(session)
      return session

    } catch (error) {
      console.error('[DEV MANAGER] Failed to initialize development session:', error)
      throw error
    }
  }

  /**
   * Get current development session state
   */
  async getDevelopmentSession(): Promise<DevelopmentSession | null> {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('development_sessions')
        .select('*')
        .eq('session_id', this.sessionId)
        .eq('workspace_id', this.workspaceId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw new Error(`Failed to fetch development session: ${error.message}`)
      }

      return data || null

    } catch (error) {
      console.error('[DEV MANAGER] Failed to get development session:', error)
      return null
    }
  }

  /**
   * Start development iteration for a specific task
   */
  async startDevelopmentIteration(
    taskId: string, 
    description: string,
    userRequirements: string
  ): Promise<DevelopmentIteration> {
    try {
      const session = await this.getDevelopmentSession()
      if (!session) {
        throw new Error('Development session not initialized')
      }

      // Get task details
      const task = await this.getTask(taskId)
      if (!task) {
        throw new Error(`Task ${taskId} not found`)
      }

      // Create new iteration
      const iteration: DevelopmentIteration = {
        id: `iter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        task_id: taskId,
        iteration_number: session.active_iterations.filter(i => i.task_id === taskId).length + 1,
        description,
        files_changed: [],
        compliance_report: {
          score: 100,
          totalIssues: 0,
          criticalIssues: 0,
          highIssues: 0,
          mediumIssues: 0,
          lowIssues: 0,
          issues: [],
          summary: 'Iteration started',
          recommendations: []
        },
        feedback: [],
        improvements: [],
        status: 'in_progress',
        created_at: new Date().toISOString()
      }

      // Update task status
      await this.updateTaskStatus(taskId, 'in_progress')

      // Save iteration
      await this.saveIteration(iteration)

      console.log(`[DEV MANAGER] Started iteration ${iteration.iteration_number} for task: ${task.title}`)
      return iteration

    } catch (error) {
      console.error('[DEV MANAGER] Failed to start development iteration:', error)
      throw error
    }
  }

  /**
   * Process code generation with PRIA compliance checking
   */
  async processCodeGeneration(
    iterationId: string,
    generatedFiles: GeneratedFile[]
  ): Promise<{
    compliance_report: ComplianceReport
    files_processed: number
    critical_issues: number
    recommendations: string[]
  }> {
    try {
      const iteration = await this.getIteration(iterationId)
      if (!iteration) {
        throw new Error(`Iteration ${iterationId} not found`)
      }

      // Run PRIA compliance check on generated files
      const filesToAnalyze = generatedFiles.map(f => ({
        path: f.path,
        content: f.content
      }))

      const complianceReport = PRIAComplianceChecker.analyzeFiles(filesToAnalyze)

      // Update files with compliance info
      const updatedFiles = generatedFiles.map(file => ({
        ...file,
        compliance_issues: complianceReport.issues.filter(issue => issue.file === file.path).length,
        updated_at: new Date().toISOString()
      }))

      // Update iteration with compliance results
      iteration.compliance_report = complianceReport
      iteration.files_changed = updatedFiles.map(f => f.path)
      
      // Generate feedback based on compliance issues
      iteration.feedback = this.generateIterationFeedback(complianceReport)
      iteration.improvements = this.generateImprovementSuggestions(complianceReport)

      await this.saveIteration(iteration)

      // Update task compliance score
      await this.updateTaskCompliance(iteration.task_id, complianceReport.score)

      // Store generated files
      await this.saveGeneratedFiles(iteration.task_id, updatedFiles)

      console.log(`[DEV MANAGER] Processed ${generatedFiles.length} files with compliance score: ${complianceReport.score}`)

      return {
        compliance_report: complianceReport,
        files_processed: generatedFiles.length,
        critical_issues: complianceReport.criticalIssues,
        recommendations: complianceReport.recommendations
      }

    } catch (error) {
      console.error('[DEV MANAGER] Failed to process code generation:', error)
      throw error
    }
  }

  /**
   * Complete development iteration with validation
   */
  async completeIteration(
    iterationId: string,
    finalFiles: GeneratedFile[],
    userFeedback?: string
  ): Promise<{
    success: boolean
    compliance_score: number
    next_actions: string[]
    quality_gates_status: { [key: string]: boolean }
  }> {
    try {
      const iteration = await this.getIteration(iterationId)
      if (!iteration) {
        throw new Error(`Iteration ${iterationId} not found`)
      }

      // Final compliance check
      const finalComplianceReport = PRIAComplianceChecker.analyzeFiles(
        finalFiles.map(f => ({ path: f.path, content: f.content }))
      )

      // Update iteration
      iteration.compliance_report = finalComplianceReport
      iteration.status = 'completed'
      iteration.completed_at = new Date().toISOString()
      
      if (userFeedback) {
        iteration.feedback.push(`User feedback: ${userFeedback}`)
      }

      await this.saveIteration(iteration)

      // Check quality gates
      const qualityGatesStatus = await this.checkQualityGates(iteration.task_id, finalComplianceReport)

      // Determine next actions
      const nextActions = this.determineNextActions(finalComplianceReport, qualityGatesStatus)

      // Update task status based on compliance
      if (finalComplianceReport.score >= 90 && finalComplianceReport.criticalIssues === 0) {
        await this.updateTaskStatus(iteration.task_id, 'completed')
      } else if (finalComplianceReport.criticalIssues > 0) {
        await this.updateTaskStatus(iteration.task_id, 'blocked')
      } else {
        await this.updateTaskStatus(iteration.task_id, 'code_review')
      }

      console.log(`[DEV MANAGER] Completed iteration ${iteration.iteration_number} with score: ${finalComplianceReport.score}`)

      return {
        success: finalComplianceReport.score >= 75,
        compliance_score: finalComplianceReport.score,
        next_actions: nextActions,
        quality_gates_status: qualityGatesStatus
      }

    } catch (error) {
      console.error('[DEV MANAGER] Failed to complete iteration:', error)
      throw error
    }
  }

  /**
   * Get development progress summary
   */
  async getDevelopmentProgress(): Promise<{
    total_tasks: number
    completed_tasks: number
    in_progress_tasks: number
    blocked_tasks: number
    overall_compliance: number
    critical_issues: number
    files_generated: number
    quality_gates_passed: number
    quality_gates_total: number
  }> {
    try {
      const supabase = await createServerClient()
      
      // Get task statistics
      const { data: taskStats } = await supabase
        .from('development_tasks')
        .select('status, compliance_score')
        .eq('session_id', this.sessionId)
        .eq('workspace_id', this.workspaceId)

      const totalTasks = taskStats?.length || 0
      const completedTasks = taskStats?.filter(t => t.status === 'completed').length || 0
      const inProgressTasks = taskStats?.filter(t => t.status === 'in_progress').length || 0
      const blockedTasks = taskStats?.filter(t => t.status === 'blocked').length || 0

      // Calculate overall compliance
      const complianceScores = taskStats?.filter(t => t.compliance_score).map(t => t.compliance_score) || []
      const overallCompliance = complianceScores.length > 0 
        ? Math.round(complianceScores.reduce((sum, score) => sum + score, 0) / complianceScores.length)
        : 100

      // Get file count
      const { data: files } = await supabase
        .from('generated_files')
        .select('id')
        .eq('session_id', this.sessionId)
        .eq('workspace_id', this.workspaceId)

      const filesGenerated = files?.length || 0

      // Get development session for quality gates
      const session = await this.getDevelopmentSession()
      const qualityGatesPassed = session?.quality_gates_passed.length || 0
      const qualityGatesTotal = (session?.quality_gates_passed.length || 0) + (session?.quality_gates_pending.length || 0)

      return {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        blocked_tasks: blockedTasks,
        overall_compliance: overallCompliance,
        critical_issues: 0, // TODO: Calculate from compliance reports
        files_generated: filesGenerated,
        quality_gates_passed: qualityGatesPassed,
        quality_gates_total: qualityGatesTotal
      }

    } catch (error) {
      console.error('[DEV MANAGER] Failed to get development progress:', error)
      throw error
    }
  }

  // Private helper methods

  private async getTask(taskId: string): Promise<DevelopmentTask | null> {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('development_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('workspace_id', this.workspaceId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data
    } catch (error) {
      console.error('[DEV MANAGER] Failed to get task:', error)
      return null
    }
  }

  private async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      await supabase
        .from('development_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('workspace_id', this.workspaceId)

    } catch (error) {
      console.error('[DEV MANAGER] Failed to update task status:', error)
    }
  }

  private async updateTaskCompliance(taskId: string, complianceScore: number): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase
        .from('development_tasks')
        .update({ 
          compliance_score: complianceScore,
          last_compliance_check: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('workspace_id', this.workspaceId)

    } catch (error) {
      console.error('[DEV MANAGER] Failed to update task compliance:', error)
    }
  }

  private async getIteration(iterationId: string): Promise<DevelopmentIteration | null> {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('development_iterations')
        .select('*')
        .eq('id', iterationId)
        .eq('workspace_id', this.workspaceId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data ? {
        ...data,
        compliance_report: data.compliance_report || { score: 0, issues: [] }
      } : null

    } catch (error) {
      console.error('[DEV MANAGER] Failed to get iteration:', error)
      return null
    }
  }

  private async saveIteration(iteration: DevelopmentIteration): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase
        .from('development_iterations')
        .upsert({
          id: iteration.id,
          workspace_id: this.workspaceId,
          session_id: this.sessionId,
          task_id: iteration.task_id,
          iteration_number: iteration.iteration_number,
          description: iteration.description,
          files_changed: iteration.files_changed,
          compliance_report: iteration.compliance_report,
          feedback: iteration.feedback,
          improvements: iteration.improvements,
          status: iteration.status,
          created_at: iteration.created_at,
          completed_at: iteration.completed_at
        })

    } catch (error) {
      console.error('[DEV MANAGER] Failed to save iteration:', error)
    }
  }

  private async saveDevelopmentSession(session: DevelopmentSession): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      await supabase
        .from('development_sessions')
        .upsert({
          session_id: session.session_id,
          workspace_id: session.workspace_id,
          current_task_id: session.current_task?.id,
          overall_compliance_score: session.overall_compliance_score,
          total_files_generated: session.total_files_generated,
          development_phase: session.development_phase,
          quality_gates_passed: session.quality_gates_passed,
          quality_gates_pending: session.quality_gates_pending,
          updated_at: new Date().toISOString()
        })

    } catch (error) {
      console.error('[DEV MANAGER] Failed to save development session:', error)
    }
  }

  private async saveGeneratedFiles(taskId: string, files: GeneratedFile[]): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      const records = files.map(file => ({
        workspace_id: this.workspaceId,
        session_id: this.sessionId,
        task_id: taskId,
        file_path: file.path,
        file_content: file.content,
        file_type: file.type,
        compliance_issues: file.compliance_issues || 0,
        created_at: file.created_at,
        updated_at: file.updated_at
      }))

      await supabase
        .from('generated_files')
        .upsert(records)

    } catch (error) {
      console.error('[DEV MANAGER] Failed to save generated files:', error)
    }
  }

  private generateIterationFeedback(report: ComplianceReport): string[] {
    const feedback: string[] = []

    if (report.criticalIssues > 0) {
      feedback.push(`🔥 ${report.criticalIssues} critical security/architecture issues must be fixed immediately`)
    }

    if (report.highIssues > 0) {
      feedback.push(`⚠️ ${report.highIssues} high-priority issues need attention before completion`)
    }

    if (report.score >= 90) {
      feedback.push(`✅ Excellent code quality! PRIA compliance score: ${report.score}/100`)
    } else if (report.score >= 75) {
      feedback.push(`👍 Good progress! PRIA compliance score: ${report.score}/100 - minor improvements needed`)
    } else {
      feedback.push(`📝 Significant improvements needed. PRIA compliance score: ${report.score}/100`)
    }

    return feedback
  }

  private generateImprovementSuggestions(report: ComplianceReport): string[] {
    const suggestions: string[] = []

    // Group issues by category for targeted suggestions
    const securityIssues = report.issues.filter(i => i.category === 'security').length
    const architectureIssues = report.issues.filter(i => i.category === 'architecture').length
    const performanceIssues = report.issues.filter(i => i.category === 'performance').length
    const accessibilityIssues = report.issues.filter(i => i.category === 'accessibility').length

    if (securityIssues > 0) {
      suggestions.push('🔐 Review authentication, authorization, and data validation patterns')
    }

    if (architectureIssues > 0) {
      suggestions.push('🏗️ Ensure proper workspace isolation and PRIA architectural compliance')
    }

    if (performanceIssues > 0) {
      suggestions.push('⚡ Optimize for performance with proper caching and bundle size management')
    }

    if (accessibilityIssues > 0) {
      suggestions.push('♿ Improve accessibility with proper ARIA labels and semantic HTML')
    }

    if (suggestions.length === 0) {
      suggestions.push('🎉 Code meets PRIA standards - ready for the next development iteration!')
    }

    return suggestions
  }

  private async checkQualityGates(taskId: string, report: ComplianceReport): Promise<{ [key: string]: boolean }> {
    return {
      'authentication_implementation': report.issues.filter(i => i.title.includes('auth')).length === 0,
      'workspace_isolation': report.issues.filter(i => i.title.includes('workspace')).length === 0,
      'error_handling': report.issues.filter(i => i.title.includes('error')).length === 0,
      'typescript_compliance': report.issues.filter(i => i.title.includes('TypeScript')).length === 0,
      'security_compliance': report.criticalIssues === 0,
      'accessibility_compliance': report.issues.filter(i => i.category === 'accessibility').length === 0,
      'overall_quality': report.score >= 85
    }
  }

  private determineNextActions(report: ComplianceReport, qualityGates: { [key: string]: boolean }): string[] {
    const actions: string[] = []

    if (report.criticalIssues > 0) {
      actions.push('Fix critical security and architecture issues')
    }

    if (!qualityGates['workspace_isolation']) {
      actions.push('Implement proper workspace_id filtering in all database queries')
    }

    if (!qualityGates['authentication_implementation']) {
      actions.push('Add authentication checks to all protected endpoints')
    }

    if (report.score < 85) {
      actions.push('Address code quality issues to meet PRIA standards')
    }

    if (actions.length === 0) {
      actions.push('Code ready for testing phase - proceed to Phase 5')
    }

    return actions
  }
}