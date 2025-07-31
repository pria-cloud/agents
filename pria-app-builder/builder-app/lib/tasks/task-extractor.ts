/**
 * Task Extractor for Phase 3 (Implementation Planning)
 * Automatically extracts development tasks, estimates, and dependencies from Claude's planning responses
 */

export interface DevelopmentTask {
  id?: string
  workspace_id?: string
  session_id?: string
  title: string
  description: string
  type: 'database' | 'api' | 'component' | 'integration' | 'testing' | 'deployment' | 'documentation'
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'skipped'
  estimated_hours: number
  actual_hours?: number
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'
  dependencies: string[] // Task IDs or external dependencies
  sprint?: number
  milestone?: string
  assignee?: string
  tags: string[]
  acceptance_criteria: string[]
  technical_notes?: string
  metadata: {
    extracted_from?: string
    extraction_confidence?: number
    workflow_phase?: number
    pria_compliance_required?: boolean
    critical_path?: boolean
    risk_level?: 'low' | 'medium' | 'high'
  }
  created_at?: string
  updated_at?: string
  completed_at?: string
}

export interface Sprint {
  id?: string
  workspace_id?: string
  session_id?: string
  sprint_number: number
  name: string
  description: string
  start_date?: string
  end_date?: string
  capacity_hours: number
  allocated_hours: number
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  goals: string[]
  tasks: string[] // Task IDs
  metadata: {
    velocity?: number
    burn_down_data?: Record<string, number>
  }
  created_at?: string
  updated_at?: string
}

export interface Milestone {
  id?: string
  workspace_id?: string
  session_id?: string
  name: string
  description: string
  target_date?: string
  actual_date?: string
  status: 'planned' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
  deliverables: string[]
  dependencies: string[] // Other milestone IDs
  tasks: string[] // Task IDs
  quality_gates: string[]
  metadata: {
    business_value?: string
    risk_assessment?: string
  }
  created_at?: string
  updated_at?: string
}

export class TaskExtractor {
  /**
   * Extract development tasks from Claude's implementation planning responses
   */
  static extractFromText(
    text: string, 
    context: {
      workflow_phase?: number
      session_id?: string
      workspace_id?: string
      requirements?: any[]
      technical_specs?: any[]
    }
  ): {
    tasks: DevelopmentTask[]
    sprints: Sprint[]
    milestones: Milestone[]
  } {
    const tasks: DevelopmentTask[] = []
    const sprints: Sprint[] = []
    const milestones: Milestone[] = []
    
    // Extract tasks
    const extractedTasks = this.extractTasks(text, context)
    tasks.push(...extractedTasks)

    // Extract sprints
    const extractedSprints = this.extractSprints(text, context)
    sprints.push(...extractedSprints)

    // Extract milestones
    const extractedMilestones = this.extractMilestones(text, context)
    milestones.push(...extractedMilestones)

    // Analyze dependencies and critical path
    this.analyzeDependencies(tasks)
    this.identifyCriticalPath(tasks, milestones)

    return { tasks, sprints, milestones }
  }

  /**
   * Extract individual development tasks
   */
  private static extractTasks(text: string, context: any): DevelopmentTask[] {
    const tasks: DevelopmentTask[] = []
    
    // Database tasks
    const databaseTasks = this.extractDatabaseTasks(text)
    tasks.push(...databaseTasks)

    // API tasks
    const apiTasks = this.extractAPITasks(text)
    tasks.push(...apiTasks)

    // Component tasks
    const componentTasks = this.extractComponentTasks(text)
    tasks.push(...componentTasks)

    // Integration tasks
    const integrationTasks = this.extractIntegrationTasks(text)
    tasks.push(...integrationTasks)

    // Testing tasks
    const testingTasks = this.extractTestingTasks(text)
    tasks.push(...testingTasks)

    // Deployment tasks
    const deploymentTasks = this.extractDeploymentTasks(text)
    tasks.push(...deploymentTasks)

    // Add context and metadata to all tasks
    return tasks.map(task => ({
      ...task,
      workspace_id: context.workspace_id,
      session_id: context.session_id,
      metadata: {
        ...task.metadata,
        workflow_phase: context.workflow_phase,
        extraction_confidence: this.calculateTaskConfidence(task, text),
        pria_compliance_required: this.requiresPRIACompliance(task),
        risk_level: this.assessRiskLevel(task, text)
      }
    }))
  }

  /**
   * Extract database-related tasks
   */
  private static extractDatabaseTasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const dbPatterns = [
      /(?:database|schema|table|migration).*?(?:create|setup|design|implement)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:supabase|postgresql|rls|row level security)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:migration|alter table|create table)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    dbPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'Database Task'
          const estimatedHours = this.extractEstimatedHours(match, 'database')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'database',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['database', 'schema', 'migration', 'supabase']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'database_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract API-related tasks
   */
  private static extractAPITasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const apiPatterns = [
      /(?:api|endpoint|route|controller).*?(?:create|implement|build)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:rest|graphql|authentication|authorization)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:middleware|validation|error handling)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    apiPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'API Task'
          const estimatedHours = this.extractEstimatedHours(match, 'api')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'api',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['api', 'endpoint', 'middleware', 'auth']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'api_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract component-related tasks
   */
  private static extractComponentTasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const componentPatterns = [
      /(?:component|ui|interface).*?(?:create|build|implement)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:react|next\.?js|typescript).*?component[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:form|button|modal|layout|page)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    componentPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'Component Task'
          const estimatedHours = this.extractEstimatedHours(match, 'component')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'component',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['component', 'ui', 'react', 'frontend']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'component_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract integration-related tasks
   */
  private static extractIntegrationTasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const integrationPatterns = [
      /(?:integration|connect|sync|webhook)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:third.?party|external|service).*?integration[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:github|vercel|supabase).*?(?:setup|configure|integrate)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    integrationPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'Integration Task'
          const estimatedHours = this.extractEstimatedHours(match, 'integration')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'integration',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['integration', 'external', 'service']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'integration_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract testing-related tasks
   */
  private static extractTestingTasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const testingPatterns = [
      /(?:test|testing|spec).*?(?:write|create|implement)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:unit|integration|e2e|end.?to.?end).*?test[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:vitest|playwright|jest|cypress)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    testingPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'Testing Task'
          const estimatedHours = this.extractEstimatedHours(match, 'testing')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'testing',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['testing', 'unit', 'integration', 'e2e']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'testing_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract deployment-related tasks
   */
  private static extractDeploymentTasks(text: string): Partial<DevelopmentTask>[] {
    const tasks: Partial<DevelopmentTask>[] = []
    
    const deploymentPatterns = [
      /(?:deploy|deployment|ci\/cd|pipeline)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:vercel|docker|kubernetes|aws).*?(?:setup|configure|deploy)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:environment|production|staging).*?setup[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    deploymentPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTaskTitle(match) || 'Deployment Task'
          const estimatedHours = this.extractEstimatedHours(match, 'deployment')
          
          tasks.push({
            title,
            description: this.extractTaskDescription(match),
            type: 'deployment',
            priority: this.extractPriority(match),
            status: 'not_started',
            estimated_hours: estimatedHours,
            complexity: this.assessComplexity(match, estimatedHours),
            dependencies: this.extractDependencies(match),
            acceptance_criteria: this.extractAcceptanceCriteria(match),
            tags: this.extractTags(match, ['deployment', 'ci/cd', 'infrastructure']),
            technical_notes: this.extractTechnicalNotes(match),
            metadata: {
              extracted_from: 'deployment_planning'
            }
          })
        })
      }
    })

    return tasks
  }

  /**
   * Extract sprints from planning text
   */
  private static extractSprints(text: string, context: any): Sprint[] {
    const sprints: Sprint[] = []
    
    const sprintPatterns = [
      /sprint\s+(\d+)[\s\S]*?(?=sprint\s+\d+|\n#|$)/gi,
      /iteration\s+(\d+)[\s\S]*?(?=iteration\s+\d+|\n#|$)/gi,
      /phase\s+(\d+).*?sprint[\s\S]*?(?=phase\s+\d+|\n#|$)/gi
    ]

    sprintPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        const sprintNumber = parseInt(match[1])
        const sprintText = match[0]
        
        sprints.push({
          workspace_id: context.workspace_id,
          session_id: context.session_id,
          sprint_number: sprintNumber,
          name: this.extractSprintName(sprintText, sprintNumber),
          description: this.extractSprintDescription(sprintText),
          capacity_hours: this.extractSprintCapacity(sprintText),
          allocated_hours: 0,
          status: 'planned',
          goals: this.extractSprintGoals(sprintText),
          tasks: [],
          metadata: {}
        })
      })
    })

    return sprints
  }

  /**
   * Extract milestones from planning text
   */
  private static extractMilestones(text: string, context: any): Milestone[] {
    const milestones: Milestone[] = []
    
    const milestonePatterns = [
      /milestone[\s\S]*?(?=milestone|\n#|$)/gi,
      /deliverable[\s\S]*?(?=deliverable|\n#|$)/gi,
      /release[\s\S]*?(?=release|\n#|$)/gi
    ]

    milestonePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const name = this.extractMilestoneName(match)
          if (name) {
            milestones.push({
              workspace_id: context.workspace_id,
              session_id: context.session_id,
              name,
              description: this.extractMilestoneDescription(match),
              status: 'planned',
              deliverables: this.extractDeliverables(match),
              dependencies: [],
              tasks: [],
              quality_gates: this.extractQualityGates(match),
              metadata: {
                business_value: this.extractBusinessValue(match),
                risk_assessment: this.extractRiskAssessment(match)
              }
            })
          }
        })
      }
    })

    return milestones
  }

  // Helper methods for task extraction
  private static extractTaskTitle(text: string): string | null {
    const titlePatterns = [
      /^#+\s*(.+)$/m,
      /^[-*]\s*(.+)$/m,
      /^\d+\.\s*(.+)$/m,
      /^(.+):/m
    ]

    for (const pattern of titlePatterns) {
      const match = text.match(pattern)
      if (match && match[1].length > 5 && match[1].length < 100) {
        return match[1].trim()
      }
    }

    // Fallback: extract from beginning of text
    const firstLine = text.split('\n')[0]
    return firstLine.length > 5 && firstLine.length < 100 ? firstLine.trim() : null
  }

  private static extractTaskDescription(text: string): string {
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, 3).join('. ').trim() + (sentences.length > 3 ? '.' : '')
  }

  private static extractEstimatedHours(text: string, taskType: string): number {
    // Look for explicit time estimates
    const timePatterns = [
      /(\d+)\s*(?:hours?|hrs?)/i,
      /(\d+)\s*(?:days?)\s*(?:\((\d+)\s*hours?\))?/i,
      /(\d+)-(\d+)\s*(?:hours?|hrs?)/i
    ]

    for (const pattern of timePatterns) {
      const match = text.match(pattern)
      if (match) {
        if (match[2]) { // Day with hours conversion
          return parseInt(match[1]) * 8 // 8 hours per day
        } else if (match[3]) { // Range - take average
          return (parseInt(match[1]) + parseInt(match[3])) / 2
        } else {
          return parseInt(match[1])
        }
      }
    }

    // Default estimates by task type
    const defaultEstimates = {
      database: 4,
      api: 6,
      component: 3,
      integration: 8,
      testing: 2,
      deployment: 4,
      documentation: 2
    }

    return defaultEstimates[taskType] || 4
  }

  private static extractPriority(text: string): 'critical' | 'high' | 'medium' | 'low' {
    const priorityKeywords = {
      critical: /critical|urgent|blocker|must.?have/i,
      high: /high|important|should.?have/i,
      low: /low|nice.?to.?have|optional/i
    }

    for (const [priority, pattern] of Object.entries(priorityKeywords)) {
      if (pattern.test(text)) {
        return priority as 'critical' | 'high' | 'medium' | 'low'
      }
    }

    return 'medium'
  }

  private static assessComplexity(text: string, estimatedHours: number): 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic' {
    if (estimatedHours <= 1) return 'trivial'
    if (estimatedHours <= 4) return 'simple'
    if (estimatedHours <= 12) return 'moderate'
    if (estimatedHours <= 24) return 'complex'
    return 'epic'
  }

  private static extractDependencies(text: string): string[] {
    const dependencies = []
    const depPatterns = [
      /depends?\s+on\s+([^.]+)/gi,
      /requires?\s+([^.]+)/gi,
      /after\s+([^.]+)/gi,
      /blocked\s+by\s+([^.]+)/gi
    ]

    depPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 2) {
          dependencies.push(match[1].trim())
        }
      })
    })

    return [...new Set(dependencies)]
  }

  private static extractAcceptanceCriteria(text: string): string[] {
    const criteria = []
    const criteriaPatterns = [
      /(?:acceptance criteria|definition of done|requirements?)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:should|must|will)\s+([^.]+)/gi
    ]

    criteriaPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const lines = match.split('\n').filter(line => 
            line.trim().length > 10 && 
            (line.includes('should') || line.includes('must') || line.includes('will'))
          )
          criteria.push(...lines.map(line => line.trim()))
        })
      }
    })

    return [...new Set(criteria)].slice(0, 5) // Limit to 5 criteria
  }

  private static extractTags(text: string, defaultTags: string[]): string[] {
    const tags = [...defaultTags]
    
    // Extract technology tags
    const techTags = ['react', 'nextjs', 'typescript', 'supabase', 'tailwind', 'vitest', 'playwright']
    techTags.forEach(tech => {
      if (new RegExp(tech, 'i').test(text)) {
        tags.push(tech)
      }
    })

    return [...new Set(tags)]
  }

  private static extractTechnicalNotes(text: string): string {
    const notePatterns = [
      /(?:note|important|warning|caveat)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:implementation|technical).*?(?:detail|note)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    const notes = []
    notePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        notes.push(...matches)
      }
    })

    return notes.join('\n\n').substring(0, 500) // Limit length
  }

  // Sprint extraction helpers
  private static extractSprintName(text: string, sprintNumber: number): string {
    const nameMatch = text.match(/(?:sprint|iteration)\s+\d+[\s:]*([^.\n]+)/i)
    return nameMatch ? nameMatch[1].trim() : `Sprint ${sprintNumber}`
  }

  private static extractSprintDescription(text: string): string {
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, 2).join('. ').trim()
  }

  private static extractSprintCapacity(text: string): number {
    const capacityMatch = text.match(/capacity[\s:]*(\d+)\s*(?:hours?|hrs?)/i)
    return capacityMatch ? parseInt(capacityMatch[1]) : 40 // Default 40 hours
  }

  private static extractSprintGoals(text: string): string[] {
    const goals = []
    const goalPatterns = [
      /goal[\s:]*([^.\n]+)/gi,
      /objective[\s:]*([^.\n]+)/gi,
      /deliver[\s:]*([^.\n]+)/gi
    ]

    goalPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 5) {
          goals.push(match[1].trim())
        }
      })
    })

    return [...new Set(goals)].slice(0, 3) // Limit to 3 goals
  }

  // Milestone extraction helpers
  private static extractMilestoneName(text: string): string | null {
    const namePatterns = [
      /milestone[\s:]*([^.\n]+)/i,
      /deliverable[\s:]*([^.\n]+)/i,
      /release[\s:]*([^.\n]+)/i
    ]

    for (const pattern of namePatterns) {
      const match = text.match(pattern)
      if (match && match[1].trim().length > 3) {
        return match[1].trim()
      }
    }

    return null
  }

  private static extractMilestoneDescription(text: string): string {
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, 2).join('. ').trim()
  }

  private static extractDeliverables(text: string): string[] {
    const deliverables = []
    const deliverablePatterns = [
      /deliverable[\s:]*([^.\n]+)/gi,
      /output[\s:]*([^.\n]+)/gi,
      /artifact[\s:]*([^.\n]+)/gi
    ]

    deliverablePatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 5) {
          deliverables.push(match[1].trim())
        }
      })
    })

    return [...new Set(deliverables)]
  }

  private static extractQualityGates(text: string): string[] {
    const gates = []
    const gatePatterns = [
      /quality.?gate[\s:]*([^.\n]+)/gi,
      /definition.?of.?done[\s:]*([^.\n]+)/gi,
      /completion.?criteria[\s:]*([^.\n]+)/gi
    ]

    gatePatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 5) {
          gates.push(match[1].trim())
        }
      })
    })

    return [...new Set(gates)]
  }

  private static extractBusinessValue(text: string): string {
    const valueMatch = text.match(/(?:business.?value|value|benefit)[\s:]*([^.\n]+)/i)
    return valueMatch ? valueMatch[1].trim() : ''
  }

  private static extractRiskAssessment(text: string): string {
    const riskMatch = text.match(/(?:risk|challenge|concern)[\s:]*([^.\n]+)/i)
    return riskMatch ? riskMatch[1].trim() : ''
  }

  // Analysis methods
  private static analyzeDependencies(tasks: DevelopmentTask[]): void {
    // Create a simple dependency map
    const taskMap = new Map<string, DevelopmentTask>()
    tasks.forEach(task => {
      if (task.title) {
        taskMap.set(task.title.toLowerCase(), task)
      }
    })

    // Link dependencies by matching titles
    tasks.forEach(task => {
      const linkedDeps = []
      task.dependencies.forEach(dep => {
        const depTask = taskMap.get(dep.toLowerCase())
        if (depTask && depTask.title) {
          linkedDeps.push(depTask.title)
        } else {
          linkedDeps.push(dep) // Keep as external dependency
        }
      })
      task.dependencies = linkedDeps
    })
  }

  private static identifyCriticalPath(tasks: DevelopmentTask[], milestones: Milestone[]): void {
    // Simple critical path identification based on dependencies and duration
    tasks.forEach(task => {
      const hasBlockingDependencies = task.dependencies.length > 0
      const isLongRunning = task.estimated_hours > 16
      const isHighPriority = task.priority === 'critical' || task.priority === 'high'
      
      if (hasBlockingDependencies && (isLongRunning || isHighPriority)) {
        task.metadata.critical_path = true
      }
    })
  }

  // Assessment methods
  private static calculateTaskConfidence(task: DevelopmentTask, text: string): number {
    let confidence = 0.5 // Base confidence
    
    // Increase confidence for detailed tasks
    if (task.description.length > 50) confidence += 0.2
    if (task.acceptance_criteria.length > 0) confidence += 0.2
    if (task.estimated_hours > 0) confidence += 0.1
    
    // Increase confidence for specific technical terms
    const technicalTerms = ['api', 'component', 'database', 'test', 'deploy']
    if (technicalTerms.some(term => task.description.toLowerCase().includes(term))) {
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  private static requiresPRIACompliance(task: DevelopmentTask): boolean {
    const priaRequiredTypes = ['database', 'api', 'component']
    const priaKeywords = ['workspace', 'tenant', 'auth', 'rls', 'security']
    
    return priaRequiredTypes.includes(task.type) || 
           priaKeywords.some(keyword => task.description.toLowerCase().includes(keyword))
  }

  private static assessRiskLevel(task: DevelopmentTask, text: string): 'low' | 'medium' | 'high' {
    const highRiskIndicators = [
      /complex/i, /difficult/i, /challenging/i, /unknown/i, /research/i, /spike/i
    ]
    
    const mediumRiskIndicators = [
      /integration/i, /external/i, /dependency/i, /migration/i
    ]

    if (highRiskIndicators.some(pattern => pattern.test(text))) return 'high'
    if (mediumRiskIndicators.some(pattern => pattern.test(text))) return 'medium'
    if (task.estimated_hours > 20) return 'high'
    if (task.estimated_hours > 8) return 'medium'
    
    return 'low'
  }
}