/**
 * Sprint Planner - Intelligent sprint planning with capacity management and milestone tracking
 * Integrates with dependency analysis for optimal sprint composition
 */

import { DependencyAnalyzer, DependencyAnalysis } from './dependency-analyzer'

export interface SprintCapacity {
  sprint_number: number
  total_hours: number
  available_hours: number
  team_members: number
  velocity_factor: number // 0.6-1.0 based on team experience
  buffer_percentage: number // 10-20% for unexpected work
}

export interface Sprint {
  id: string
  name: string
  sprint_number: number
  start_date: string
  end_date: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  capacity: SprintCapacity
  tasks: string[] // Task IDs assigned to this sprint
  goals: string[]
  retrospective_notes?: string
  velocity: {
    planned_hours: number
    completed_hours: number
    planned_tasks: number
    completed_tasks: number
  }
  metadata: {
    team_composition?: string[]
    focus_areas?: string[]
    risks?: string[]
    dependencies_resolved?: boolean
  }
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  name: string
  description: string
  target_date: string
  status: 'planning' | 'in_progress' | 'completed' | 'delayed' | 'cancelled'
  completion_criteria: string[]
  dependent_sprints: number[]
  deliverables: string[]
  stakeholders: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  progress_percentage: number
  metadata: {
    business_value?: number
    customer_impact?: 'high' | 'medium' | 'low'
    technical_debt_reduction?: number
    dependencies?: string[]
  }
  created_at: string
  updated_at: string
}

export interface SprintPlan {
  sprints: Sprint[]
  milestones: Milestone[]
  total_duration_weeks: number
  release_timeline: {
    phase: string
    sprint_range: [number, number]
    deliverables: string[]
    milestone_ids: string[]
  }[]
  capacity_analysis: {
    total_team_hours: number
    planned_work_hours: number
    buffer_hours: number
    utilization_percentage: number
    overallocation_risk: 'low' | 'medium' | 'high'
  }
  recommendations: {
    type: 'capacity' | 'dependency' | 'milestone' | 'risk'
    message: string
    sprint_affected?: number
    priority: 'high' | 'medium' | 'low'
  }[]
}

export interface TaskAssignment {
  task_id: string
  sprint_number: number
  assigned_hours: number
  assignment_reason: string
  confidence: number
  dependencies_met: boolean
  prerequisites: string[]
}

export class SprintPlanner {
  
  /**
   * Generate optimized sprint plan from tasks and dependencies
   */
  static generateSprintPlan(
    tasks: any[],
    dependencies: any[],
    constraints: {
      team_size: number
      sprint_length_weeks: number
      hours_per_week_per_person: number
      start_date: string
      target_milestones: Partial<Milestone>[]
      velocity_factor?: number
    }
  ): SprintPlan {
    
    // Analyze dependencies first
    const dependencyAnalysis = DependencyAnalyzer.analyzeDependencies(tasks, dependencies)
    
    // Calculate team capacity
    const sprintCapacity = this.calculateSprintCapacity(constraints)
    
    // Assign tasks to sprints using dependency-aware algorithm
    const taskAssignments = this.assignTasksToSprints(
      tasks,
      dependencyAnalysis,
      sprintCapacity,
      constraints
    )
    
    // Generate sprints with assigned tasks
    const sprints = this.generateSprints(taskAssignments, constraints, sprintCapacity)
    
    // Generate milestones based on sprint completion and business value
    const milestones = this.generateMilestones(
      sprints,
      constraints.target_milestones,
      dependencyAnalysis
    )
    
    // Create release timeline
    const releaseTimeline = this.createReleaseTimeline(sprints, milestones)
    
    // Analyze capacity and generate recommendations
    const capacityAnalysis = this.analyzeCapacity(sprints, sprintCapacity)
    const recommendations = this.generateRecommendations(
      sprints,
      milestones,
      dependencyAnalysis,
      capacityAnalysis
    )
    
    return {
      sprints,
      milestones,
      total_duration_weeks: sprints.length * constraints.sprint_length_weeks,
      release_timeline: releaseTimeline,
      capacity_analysis: capacityAnalysis,
      recommendations
    }
  }
  
  /**
   * Calculate sprint capacity based on team constraints
   */
  private static calculateSprintCapacity(constraints: {
    team_size: number
    sprint_length_weeks: number
    hours_per_week_per_person: number
    velocity_factor?: number
  }): SprintCapacity {
    
    const velocityFactor = constraints.velocity_factor || 0.8 // Default 80% velocity
    const bufferPercentage = 15 // 15% buffer for unexpected work
    
    const totalHours = constraints.team_size * 
                      constraints.sprint_length_weeks * 
                      constraints.hours_per_week_per_person
    
    const effectiveHours = totalHours * velocityFactor
    const availableHours = effectiveHours * (1 - bufferPercentage / 100)
    
    return {
      sprint_number: 1, // Will be set per sprint
      total_hours: totalHours,
      available_hours: availableHours,
      team_members: constraints.team_size,
      velocity_factor: velocityFactor,
      buffer_percentage: bufferPercentage
    }
  }
  
  /**
   * Assign tasks to sprints using dependency-aware scheduling
   */
  private static assignTasksToSprints(
    tasks: any[],
    dependencyAnalysis: DependencyAnalysis,
    sprintCapacity: SprintCapacity,
    constraints: any
  ): TaskAssignment[] {
    
    const assignments: TaskAssignment[] = []
    const completedTasks = new Set<string>()
    let currentSprint = 1
    let currentSprintHours = 0
    
    // Sort tasks by critical path, then priority, then dependencies
    const sortedTasks = this.prioritizeTasksForSprints(tasks, dependencyAnalysis)
    
    for (const task of sortedTasks) {
      // Check if all dependencies are completed
      const dependenciesMet = task.dependencies.every((depId: string) => 
        completedTasks.has(depId)
      )
      
      if (!dependenciesMet) {
        // Find the earliest sprint where dependencies will be met
        const earliestSprint = this.findEarliestViableSprint(
          task,
          assignments,
          currentSprint
        )
        
        // Skip to that sprint if needed
        if (earliestSprint > currentSprint) {
          currentSprint = earliestSprint
          currentSprintHours = this.getSprintHours(assignments, currentSprint)
        }
      }
      
      // Check if task fits in current sprint
      if (currentSprintHours + task.estimated_hours > sprintCapacity.available_hours) {
        // Move to next sprint
        currentSprint++
        currentSprintHours = 0
      }
      
      // Assign task to current sprint
      const assignment: TaskAssignment = {
        task_id: task.id,
        sprint_number: currentSprint,
        assigned_hours: task.estimated_hours,
        assignment_reason: this.getAssignmentReason(task, dependencyAnalysis),
        confidence: this.calculateAssignmentConfidence(task, dependencyAnalysis),
        dependencies_met: dependenciesMet,
        prerequisites: task.dependencies
      }
      
      assignments.push(assignment)
      completedTasks.add(task.id)
      currentSprintHours += task.estimated_hours
    }
    
    return assignments
  }
  
  /**
   * Prioritize tasks for sprint assignment
   */
  private static prioritizeTasksForSprints(
    tasks: any[],
    dependencyAnalysis: DependencyAnalysis
  ): any[] {
    
    const criticalTaskIds = new Set(
      dependencyAnalysis.critical_path.tasks.map(t => t.task_id)
    )
    
    return tasks.sort((a, b) => {
      // Critical path tasks first
      const aCritical = criticalTaskIds.has(a.id)
      const bCritical = criticalTaskIds.has(b.id)
      if (aCritical && !bCritical) return -1
      if (!aCritical && bCritical) return 1
      
      // Then by priority
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // Then by number of dependents (tasks that depend on this one)
      const depDiff = b.dependents?.length || 0 - a.dependents?.length || 0
      if (depDiff !== 0) return depDiff
      
      // Finally by estimated hours (smaller tasks first for early completion)
      return a.estimated_hours - b.estimated_hours
    })
  }
  
  /**
   * Find the earliest sprint where task dependencies will be met
   */
  private static findEarliestViableSprint(
    task: any,
    assignments: TaskAssignment[],
    currentSprint: number
  ): number {
    
    if (task.dependencies.length === 0) {
      return currentSprint
    }
    
    let latestDependencySprint = 0
    
    for (const depId of task.dependencies) {
      const depAssignment = assignments.find(a => a.task_id === depId)
      if (depAssignment) {
        latestDependencySprint = Math.max(latestDependencySprint, depAssignment.sprint_number)
      }
    }
    
    // Task can start in the sprint after all dependencies are completed
    return Math.max(currentSprint, latestDependencySprint + 1)
  }
  
  /**
   * Get total hours assigned to a specific sprint
   */
  private static getSprintHours(assignments: TaskAssignment[], sprintNumber: number): number {
    return assignments
      .filter(a => a.sprint_number === sprintNumber)
      .reduce((sum, a) => sum + a.assigned_hours, 0)
  }
  
  /**
   * Generate sprint objects with assigned tasks
   */
  private static generateSprints(
    assignments: TaskAssignment[],
    constraints: any,
    baseCapacity: SprintCapacity
  ): Sprint[] {
    
    const maxSprint = Math.max(...assignments.map(a => a.sprint_number))
    const sprints: Sprint[] = []
    
    for (let sprintNum = 1; sprintNum <= maxSprint; sprintNum++) {
      const sprintAssignments = assignments.filter(a => a.sprint_number === sprintNum)
      const sprintTasks = sprintAssignments.map(a => a.task_id)
      
      const plannedHours = sprintAssignments.reduce((sum, a) => sum + a.assigned_hours, 0)
      
      const startDate = new Date(constraints.start_date)
      startDate.setDate(startDate.getDate() + (sprintNum - 1) * constraints.sprint_length_weeks * 7)
      
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + constraints.sprint_length_weeks * 7 - 1)
      
      const sprint: Sprint = {
        id: `sprint-${sprintNum}`,
        name: `Sprint ${sprintNum}`,
        sprint_number: sprintNum,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'planning',
        capacity: {
          ...baseCapacity,
          sprint_number: sprintNum
        },
        tasks: sprintTasks,
        goals: this.generateSprintGoals(sprintAssignments, sprintNum),
        velocity: {
          planned_hours: plannedHours,
          completed_hours: 0,
          planned_tasks: sprintTasks.length,
          completed_tasks: 0
        },
        metadata: {
          focus_areas: this.identifySprintFocusAreas(sprintAssignments),
          risks: this.identifySprintRisks(sprintAssignments),
          dependencies_resolved: sprintAssignments.every(a => a.dependencies_met)
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      sprints.push(sprint)
    }
    
    return sprints
  }
  
  /**
   * Generate milestone objects based on sprint completion
   */
  private static generateMilestones(
    sprints: Sprint[],
    targetMilestones: Partial<Milestone>[],
    dependencyAnalysis: DependencyAnalysis
  ): Milestone[] {
    
    const milestones: Milestone[] = []
    
    // Auto-generate milestones based on sprint completion
    const majorSprintIntervals = Math.ceil(sprints.length / 3) // 3 major milestones
    
    for (let i = 1; i <= 3; i++) {
      const sprintIndex = Math.min(i * majorSprintIntervals - 1, sprints.length - 1)
      const sprint = sprints[sprintIndex]
      
      if (sprint) {
        const milestone: Milestone = {
          id: `milestone-${i}`,
          name: i === 1 ? 'Foundation Complete' : 
                i === 2 ? 'Core Features Complete' : 'Release Ready',
          description: this.generateMilestoneDescription(i, sprint),
          target_date: sprint.end_date,
          status: 'planning',
          completion_criteria: this.generateMilestoneCompletion(i, sprints.slice(0, sprintIndex + 1)),
          dependent_sprints: sprints.slice(0, sprintIndex + 1).map(s => s.sprint_number),
          deliverables: this.generateMilestoneDeliverables(i, sprints.slice(0, sprintIndex + 1)),
          stakeholders: ['Product Owner', 'Development Team', 'QA Team'],
          priority: i === 3 ? 'critical' : i === 2 ? 'high' : 'medium',
          progress_percentage: 0,
          metadata: {
            business_value: (4 - i) * 25, // Earlier milestones have higher business value
            customer_impact: i === 3 ? 'high' : i === 2 ? 'medium' : 'low',
            technical_debt_reduction: i * 10 // Later milestones reduce more tech debt
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        milestones.push(milestone)
      }
    }
    
    // Add custom target milestones
    targetMilestones.forEach((customMilestone, index) => {
      const milestone: Milestone = {
        id: `custom-milestone-${index + 1}`,
        name: customMilestone.name || `Custom Milestone ${index + 1}`,
        description: customMilestone.description || '',
        target_date: customMilestone.target_date || sprints[sprints.length - 1]?.end_date || '',
        status: 'planning',
        completion_criteria: customMilestone.completion_criteria || [],
        dependent_sprints: customMilestone.dependent_sprints || [],
        deliverables: customMilestone.deliverables || [],
        stakeholders: customMilestone.stakeholders || [],
        priority: customMilestone.priority || 'medium',
        progress_percentage: 0,
        metadata: customMilestone.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      milestones.push(milestone)
    })
    
    return milestones
  }
  
  /**
   * Create release timeline from sprints and milestones
   */
  private static createReleaseTimeline(sprints: Sprint[], milestones: Milestone[]) {
    const phases = [
      {
        phase: 'Foundation',
        sprint_range: [1, Math.ceil(sprints.length / 3)] as [number, number],
        deliverables: ['Database Schema', 'Authentication', 'Core APIs'],
        milestone_ids: milestones.filter(m => m.name.includes('Foundation')).map(m => m.id)
      },
      {
        phase: 'Core Development',
        sprint_range: [Math.ceil(sprints.length / 3) + 1, Math.ceil(sprints.length * 2 / 3)] as [number, number],
        deliverables: ['UI Components', 'Business Logic', 'Integrations'],
        milestone_ids: milestones.filter(m => m.name.includes('Core')).map(m => m.id)
      },
      {
        phase: 'Polish & Release',
        sprint_range: [Math.ceil(sprints.length * 2 / 3) + 1, sprints.length] as [number, number],
        deliverables: ['Testing', 'Performance Optimization', 'Documentation'],
        milestone_ids: milestones.filter(m => m.name.includes('Release')).map(m => m.id)
      }
    ]
    
    return phases
  }
  
  /**
   * Analyze capacity utilization and risks
   */
  private static analyzeCapacity(sprints: Sprint[], baseCapacity: SprintCapacity) {
    const totalTeamHours = sprints.length * baseCapacity.total_hours
    const plannedWorkHours = sprints.reduce((sum, s) => sum + s.velocity.planned_hours, 0)
    const bufferHours = totalTeamHours - plannedWorkHours
    const utilizationPercentage = (plannedWorkHours / totalTeamHours) * 100
    
    let overallocationRisk: 'low' | 'medium' | 'high' = 'low'
    if (utilizationPercentage > 90) overallocationRisk = 'high'
    else if (utilizationPercentage > 80) overallocationRisk = 'medium'
    
    return {
      total_team_hours: totalTeamHours,
      planned_work_hours: plannedWorkHours,
      buffer_hours: bufferHours,
      utilization_percentage: Math.round(utilizationPercentage),
      overallocation_risk: overallocationRisk
    }
  }
  
  /**
   * Generate planning recommendations
   */
  private static generateRecommendations(
    sprints: Sprint[],
    milestones: Milestone[],
    dependencyAnalysis: DependencyAnalysis,
    capacityAnalysis: any
  ) {
    const recommendations: any[] = []
    
    // Capacity recommendations
    if (capacityAnalysis.overallocation_risk === 'high') {
      recommendations.push({
        type: 'capacity',
        message: `Team utilization at ${capacityAnalysis.utilization_percentage}% - consider adding buffer or reducing scope`,
        priority: 'high'
      })
    }
    
    // Dependency recommendations
    if (dependencyAnalysis.critical_path.bottlenecks.length > 0) {
      recommendations.push({
        type: 'dependency',
        message: `${dependencyAnalysis.critical_path.bottlenecks.length} bottlenecks identified on critical path`,
        priority: 'high'
      })
    }
    
    // Sprint balance recommendations
    const sprintHours = sprints.map(s => s.velocity.planned_hours)
    const maxHours = Math.max(...sprintHours)
    const minHours = Math.min(...sprintHours)
    
    if (maxHours > minHours * 1.5) {
      recommendations.push({
        type: 'capacity',
        message: 'Uneven sprint workload distribution - consider rebalancing tasks',
        priority: 'medium'
      })
    }
    
    return recommendations
  }
  
  // Helper methods for generating sprint and milestone content
  private static getAssignmentReason(task: any, analysis: DependencyAnalysis): string {
    const isCritical = analysis.critical_path.tasks.some(t => t.task_id === task.id)
    if (isCritical) return 'Critical path task'
    if (task.priority === 'critical') return 'High priority task'
    if (task.dependencies.length === 0) return 'No dependencies - can start immediately'
    return 'Dependency-based scheduling'
  }
  
  private static calculateAssignmentConfidence(task: any, analysis: DependencyAnalysis): number {
    let confidence = 0.8 // Base confidence
    
    if (task.complexity === 'trivial') confidence += 0.1
    else if (task.complexity === 'epic') confidence -= 0.2
    
    if (task.dependencies.length === 0) confidence += 0.1
    else if (task.dependencies.length > 3) confidence -= 0.1
    
    return Math.max(0.3, Math.min(1.0, confidence))
  }
  
  private static generateSprintGoals(assignments: TaskAssignment[], sprintNum: number): string[] {
    if (sprintNum === 1) return ['Establish project foundation', 'Set up development environment']
    if (sprintNum <= 3) return ['Implement core functionality', 'Establish development workflow']
    return ['Complete remaining features', 'Prepare for testing and deployment']
  }
  
  private static identifySprintFocusAreas(assignments: TaskAssignment[]): string[] {
    // This would analyze task types to identify focus areas
    return ['Development', 'Integration']
  }
  
  private static identifySprintRisks(assignments: TaskAssignment[]): string[] {
    const risks: string[] = []
    
    const hasHighRiskTasks = assignments.some(a => !a.dependencies_met)
    if (hasHighRiskTasks) risks.push('Unresolved dependencies')
    
    const totalHours = assignments.reduce((sum, a) => sum + a.assigned_hours, 0)
    if (totalHours > 80) risks.push('High workload - may need scope reduction')
    
    return risks
  }
  
  private static generateMilestoneDescription(phase: number, sprint: Sprint): string {
    const descriptions = [
      'Basic project infrastructure and core systems are operational',
      'All major features implemented and integrated',
      'Product is tested, polished, and ready for release'
    ]
    return descriptions[phase - 1] || 'Milestone achievement'
  }
  
  private static generateMilestoneCompletion(phase: number, sprints: Sprint[]): string[] {
    const criteria = [
      ['Database schema implemented', 'Authentication system working', 'Core APIs functional'],
      ['All UI components completed', 'Business logic implemented', 'Integration tests passing'],
      ['All tests passing', 'Performance targets met', 'Documentation complete']
    ]
    return criteria[phase - 1] || []
  }
  
  private static generateMilestoneDeliverables(phase: number, sprints: Sprint[]): string[] {
    const deliverables = [
      ['Database', 'Authentication', 'API Framework'],
      ['User Interface', 'Core Features', 'Integrations'],
      ['Complete Application', 'Documentation', 'Deployment Package']
    ]
    return deliverables[phase - 1] || []
  }
}