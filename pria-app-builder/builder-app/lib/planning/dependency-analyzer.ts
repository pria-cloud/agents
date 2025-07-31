/**
 * Dependency Analyzer - Analyzes task dependencies and determines critical path
 * Provides dependency mapping, cycle detection, and critical path calculation
 */

export interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  dependency_type: 'blocks' | 'suggests' | 'enhances' | 'requires'
  created_at: string
  metadata?: {
    strength?: number // 0.1-1.0 indicating how strong the dependency is
    reason?: string
    risk_level?: 'low' | 'medium' | 'high'
  }
}

export interface DependencyNode {
  task_id: string
  title: string
  estimated_hours: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: string
  dependencies: string[] // IDs of tasks this task depends on
  dependents: string[] // IDs of tasks that depend on this task
  metadata: {
    earliest_start?: number // Days from project start
    latest_start?: number // Days from project start (to maintain critical path)
    earliest_finish?: number
    latest_finish?: number
    slack?: number // How much delay is allowed without affecting critical path
    on_critical_path?: boolean
    complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'
    risk_level?: 'low' | 'medium' | 'high'
  }
}

export interface CriticalPath {
  tasks: DependencyNode[]
  total_duration: number // In hours
  total_days: number // Assuming 8-hour work days
  bottlenecks: {
    task_id: string
    reason: string
    impact_hours: number
  }[]
  risk_factors: {
    description: string
    probability: number // 0-1
    impact_hours: number
  }[]
}

export interface DependencyAnalysis {
  dependency_graph: DependencyNode[]
  critical_path: CriticalPath
  parallel_tracks: {
    track_name: string
    tasks: string[]
    duration_hours: number
  }[]
  cycle_detection: {
    has_cycles: boolean
    cycles?: string[][] // Arrays of task IDs forming cycles
  }
  optimization_suggestions: {
    type: 'parallelize' | 'reorder' | 'split' | 'merge' | 'outsource'
    tasks: string[]
    expected_time_savings: number
    confidence: number
  }[]
}

export class DependencyAnalyzer {
  
  /**
   * Analyze task dependencies and calculate critical path
   */
  static analyzeDependencies(
    tasks: any[],
    dependencies: TaskDependency[]
  ): DependencyAnalysis {
    
    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(tasks, dependencies)
    
    // Detect cycles (must be done before critical path calculation)
    const cycleDetection = this.detectCycles(dependencyGraph)
    
    if (cycleDetection.has_cycles) {
      throw new Error(`Dependency cycles detected: ${cycleDetection.cycles?.map(cycle => cycle.join(' -> ')).join(', ')}`)
    }
    
    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(dependencyGraph)
    
    // Find parallel execution tracks
    const parallelTracks = this.identifyParallelTracks(dependencyGraph, criticalPath)
    
    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions(
      dependencyGraph, 
      criticalPath, 
      parallelTracks
    )
    
    return {
      dependency_graph: dependencyGraph,
      critical_path: criticalPath,
      parallel_tracks: parallelTracks,
      cycle_detection: cycleDetection,
      optimization_suggestions: optimizationSuggestions
    }
  }
  
  /**
   * Build dependency graph from tasks and dependencies
   */
  private static buildDependencyGraph(
    tasks: any[],
    dependencies: TaskDependency[]
  ): DependencyNode[] {
    
    const graph: DependencyNode[] = tasks.map(task => ({
      task_id: task.id,
      title: task.title,
      estimated_hours: task.estimated_hours || 8,
      priority: task.priority || 'medium',
      status: task.status || 'not_started',
      dependencies: [],
      dependents: [],
      metadata: {
        complexity: task.complexity || 'moderate',
        risk_level: task.metadata?.risk_level || 'medium'
      }
    }))
    
    // Build dependency relationships
    dependencies.forEach(dep => {
      const task = graph.find(t => t.task_id === dep.task_id)
      const dependsOn = graph.find(t => t.task_id === dep.depends_on_task_id)
      
      if (task && dependsOn) {
        // Only add if it's a blocking dependency
        if (dep.dependency_type === 'blocks' || dep.dependency_type === 'requires') {
          task.dependencies.push(dep.depends_on_task_id)
          dependsOn.dependents.push(dep.task_id)
        }
      }
    })
    
    return graph
  }
  
  /**
   * Detect dependency cycles using DFS
   */
  private static detectCycles(graph: DependencyNode[]): {
    has_cycles: boolean
    cycles?: string[][]
  } {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []
    
    const dfs = (taskId: string, path: string[]): boolean => {
      if (recursionStack.has(taskId)) {
        // Found a cycle - extract the cycle from the path
        const cycleStart = path.indexOf(taskId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), taskId])
        }
        return true
      }
      
      if (visited.has(taskId)) {
        return false
      }
      
      visited.add(taskId)
      recursionStack.add(taskId)
      path.push(taskId)
      
      const task = graph.find(t => t.task_id === taskId)
      if (task) {
        for (const depId of task.dependencies) {
          if (dfs(depId, [...path])) {
            return true
          }
        }
      }
      
      recursionStack.delete(taskId)
      return false
    }
    
    // Check each unvisited node
    for (const task of graph) {
      if (!visited.has(task.task_id)) {
        dfs(task.task_id, [])
      }
    }
    
    return {
      has_cycles: cycles.length > 0,
      cycles: cycles.length > 0 ? cycles : undefined
    }
  }
  
  /**
   * Calculate critical path using CPM algorithm
   */
  private static calculateCriticalPath(graph: DependencyNode[]): CriticalPath {
    
    // Forward pass - calculate earliest start/finish times
    this.calculateEarliestTimes(graph)
    
    // Backward pass - calculate latest start/finish times
    this.calculateLatestTimes(graph)
    
    // Calculate slack and identify critical path
    this.calculateSlackAndCriticalPath(graph)
    
    // Find the critical path tasks
    const criticalTasks = graph.filter(task => task.metadata.on_critical_path)
    const totalDuration = Math.max(...graph.map(task => task.metadata.earliest_finish || 0))
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(graph, criticalTasks)
    
    // Assess risk factors
    const riskFactors = this.assessRiskFactors(criticalTasks)
    
    return {
      tasks: criticalTasks.sort((a, b) => (a.metadata.earliest_start || 0) - (b.metadata.earliest_start || 0)),
      total_duration: totalDuration,
      total_days: Math.ceil(totalDuration / 8), // Assuming 8-hour work days
      bottlenecks,
      risk_factors: riskFactors
    }
  }
  
  /**
   * Forward pass of CPM algorithm
   */
  private static calculateEarliestTimes(graph: DependencyNode[]): void {
    const processed = new Set<string>()
    
    const processTask = (task: DependencyNode): void => {
      if (processed.has(task.task_id)) return
      
      // Process all dependencies first
      for (const depId of task.dependencies) {
        const depTask = graph.find(t => t.task_id === depId)
        if (depTask && !processed.has(depId)) {
          processTask(depTask)
        }
      }
      
      // Calculate earliest start time
      let earliestStart = 0
      for (const depId of task.dependencies) {
        const depTask = graph.find(t => t.task_id === depId)
        if (depTask) {
          earliestStart = Math.max(earliestStart, depTask.metadata.earliest_finish || 0)
        }
      }
      
      task.metadata.earliest_start = earliestStart
      task.metadata.earliest_finish = earliestStart + task.estimated_hours
      
      processed.add(task.task_id)
    }
    
    // Process all tasks
    for (const task of graph) {
      processTask(task)
    }
  }
  
  /**
   * Backward pass of CPM algorithm
   */
  private static calculateLatestTimes(graph: DependencyNode[]): void {
    const processed = new Set<string>()
    const projectFinish = Math.max(...graph.map(task => task.metadata.earliest_finish || 0))
    
    const processTask = (task: DependencyNode): void => {
      if (processed.has(task.task_id)) return
      
      // Process all dependents first
      for (const depId of task.dependents) {
        const depTask = graph.find(t => t.task_id === depId)
        if (depTask && !processed.has(depId)) {
          processTask(depTask)
        }
      }
      
      // Calculate latest finish time
      let latestFinish = projectFinish
      if (task.dependents.length > 0) {
        latestFinish = Math.min(
          ...task.dependents.map(depId => {
            const depTask = graph.find(t => t.task_id === depId)
            return depTask?.metadata.latest_start || projectFinish
          })
        )
      }
      
      task.metadata.latest_finish = latestFinish
      task.metadata.latest_start = latestFinish - task.estimated_hours
      
      processed.add(task.task_id)
    }
    
    // Process all tasks in reverse order
    const sortedTasks = [...graph].sort((a, b) => (b.metadata.earliest_finish || 0) - (a.metadata.earliest_finish || 0))
    for (const task of sortedTasks) {
      processTask(task)
    }
  }
  
  /**
   * Calculate slack and identify critical path tasks
   */
  private static calculateSlackAndCriticalPath(graph: DependencyNode[]): void {
    for (const task of graph) {
      const earliestStart = task.metadata.earliest_start || 0
      const latestStart = task.metadata.latest_start || 0
      
      task.metadata.slack = latestStart - earliestStart
      task.metadata.on_critical_path = task.metadata.slack === 0
    }
  }
  
  /**
   * Identify parallel execution tracks
   */
  private static identifyParallelTracks(
    graph: DependencyNode[],
    criticalPath: CriticalPath
  ): { track_name: string; tasks: string[]; duration_hours: number }[] {
    
    const tracks: { track_name: string; tasks: string[]; duration_hours: number }[] = []
    const processedTasks = new Set<string>()
    
    // Critical path is always track 1
    tracks.push({
      track_name: 'Critical Path',
      tasks: criticalPath.tasks.map(t => t.task_id),
      duration_hours: criticalPath.total_duration
    })
    
    criticalPath.tasks.forEach(t => processedTasks.add(t.task_id))
    
    // Find other parallel tracks
    let trackNumber = 2
    for (const task of graph) {
      if (!processedTasks.has(task.task_id)) {
        const track = this.findParallelTrack(task, graph, processedTasks)
        if (track.length > 0) {
          const duration = track.reduce((sum, t) => sum + t.estimated_hours, 0)
          tracks.push({
            track_name: `Parallel Track ${trackNumber}`,
            tasks: track.map(t => t.task_id),
            duration_hours: duration
          })
          
          track.forEach(t => processedTasks.add(t.task_id))
          trackNumber++
        }
      }
    }
    
    return tracks
  }
  
  /**
   * Find a parallel execution track starting from a task
   */
  private static findParallelTrack(
    startTask: DependencyNode,
    graph: DependencyNode[],
    excludeIds: Set<string>
  ): DependencyNode[] {
    
    const track: DependencyNode[] = []
    const visited = new Set<string>()
    
    const addToTrack = (task: DependencyNode): void => {
      if (visited.has(task.task_id) || excludeIds.has(task.task_id)) return
      
      visited.add(task.task_id)
      track.push(task)
      
      // Add dependent tasks that can be done in sequence
      for (const depId of task.dependents) {
        const depTask = graph.find(t => t.task_id === depId)
        if (depTask && !excludeIds.has(depId)) {
          // Check if all dependencies of the dependent task are satisfied by this track
          const canAddToTrack = depTask.dependencies.every(depDepId => 
            track.some(t => t.task_id === depDepId) || excludeIds.has(depDepId)
          )
          
          if (canAddToTrack) {
            addToTrack(depTask)
          }
        }
      }
    }
    
    addToTrack(startTask)
    return track
  }
  
  /**
   * Identify bottlenecks in the critical path
   */
  private static identifyBottlenecks(
    graph: DependencyNode[],
    criticalTasks: DependencyNode[]
  ): { task_id: string; reason: string; impact_hours: number }[] {
    
    const bottlenecks: { task_id: string; reason: string; impact_hours: number }[] = []
    
    for (const task of criticalTasks) {
      // High-effort tasks on critical path
      if (task.estimated_hours > 40) {
        bottlenecks.push({
          task_id: task.task_id,
          reason: `High effort task (${task.estimated_hours} hours) on critical path`,
          impact_hours: task.estimated_hours
        })
      }
      
      // High-risk tasks
      if (task.metadata.risk_level === 'high') {
        bottlenecks.push({
          task_id: task.task_id,
          reason: 'High-risk task on critical path',
          impact_hours: task.estimated_hours * 0.5 // Assume 50% risk impact
        })
      }
      
      // Complex tasks
      if (task.metadata.complexity === 'epic' || task.metadata.complexity === 'complex') {
        bottlenecks.push({
          task_id: task.task_id,
          reason: `Complex task (${task.metadata.complexity}) may cause delays`,
          impact_hours: task.estimated_hours * 0.3 // Assume 30% complexity impact
        })
      }
      
      // Tasks with many dependents
      if (task.dependents.length > 3) {
        bottlenecks.push({
          task_id: task.task_id,
          reason: `Task blocks ${task.dependents.length} other tasks`,
          impact_hours: task.dependents.length * 4 // Assume 4 hours impact per dependent
        })
      }
    }
    
    return bottlenecks
  }
  
  /**
   * Assess risk factors for the critical path
   */
  private static assessRiskFactors(criticalTasks: DependencyNode[]): {
    description: string
    probability: number
    impact_hours: number
  }[] {
    
    const risks: { description: string; probability: number; impact_hours: number }[] = []
    
    // Technical complexity risks
    const complexTasks = criticalTasks.filter(t => 
      t.metadata.complexity === 'complex' || t.metadata.complexity === 'epic'
    )
    if (complexTasks.length > 0) {
      risks.push({
        description: `${complexTasks.length} complex tasks may require additional research and debugging`,
        probability: 0.7,
        impact_hours: complexTasks.reduce((sum, t) => sum + t.estimated_hours * 0.3, 0)
      })
    }
    
    // Integration risks
    const integrationTasks = criticalTasks.filter(t => 
      t.title.toLowerCase().includes('integration') || 
      t.title.toLowerCase().includes('api') ||
      t.title.toLowerCase().includes('database')
    )
    if (integrationTasks.length > 2) {
      risks.push({
        description: 'Multiple integration points may cause compatibility issues',
        probability: 0.4,
        impact_hours: integrationTasks.length * 8
      })
    }
    
    // Resource contention
    if (criticalTasks.length > 10) {
      risks.push({
        description: 'Long critical path may lead to resource burnout and quality issues',
        probability: 0.5,
        impact_hours: criticalTasks.length * 2
      })
    }
    
    // High-risk tasks
    const highRiskTasks = criticalTasks.filter(t => t.metadata.risk_level === 'high')
    if (highRiskTasks.length > 0) {
      risks.push({
        description: `${highRiskTasks.length} high-risk tasks on critical path`,
        probability: 0.6,
        impact_hours: highRiskTasks.reduce((sum, t) => sum + t.estimated_hours * 0.5, 0)
      })
    }
    
    return risks
  }
  
  /**
   * Generate optimization suggestions
   */
  private static generateOptimizationSuggestions(
    graph: DependencyNode[],
    criticalPath: CriticalPath,
    parallelTracks: { track_name: string; tasks: string[]; duration_hours: number }[]
  ): {
    type: 'parallelize' | 'reorder' | 'split' | 'merge' | 'outsource'
    tasks: string[]
    expected_time_savings: number
    confidence: number
  }[] {
    
    const suggestions: {
      type: 'parallelize' | 'reorder' | 'split' | 'merge' | 'outsource'
      tasks: string[]
      expected_time_savings: number
      confidence: number
    }[] = []
    
    // Look for tasks that can be parallelized
    for (const task of criticalPath.tasks) {
      // Check if task can be split into parallel subtasks
      if (task.estimated_hours > 20 && task.metadata.complexity !== 'trivial') {
        suggestions.push({
          type: 'split',
          tasks: [task.task_id],
          expected_time_savings: task.estimated_hours * 0.3,
          confidence: 0.7
        })
      }
      
      // Check for tasks that can be outsourced
      if (task.title.toLowerCase().includes('design') || 
          task.title.toLowerCase().includes('documentation') ||
          task.title.toLowerCase().includes('testing')) {
        suggestions.push({
          type: 'outsource',
          tasks: [task.task_id],
          expected_time_savings: task.estimated_hours * 0.4,
          confidence: 0.6
        })
      }
    }
    
    // Look for sequential tasks that can be parallelized
    for (let i = 0; i < criticalPath.tasks.length - 1; i++) {
      const currentTask = criticalPath.tasks[i]
      const nextTask = criticalPath.tasks[i + 1]
      
      // Check if next task has minimal dependency on current task
      if (nextTask.dependencies.length === 1 && 
          nextTask.dependencies[0] === currentTask.task_id &&
          !nextTask.title.toLowerCase().includes('deploy') &&
          !nextTask.title.toLowerCase().includes('integration')) {
        
        suggestions.push({
          type: 'parallelize',
          tasks: [currentTask.task_id, nextTask.task_id],
          expected_time_savings: Math.min(currentTask.estimated_hours, nextTask.estimated_hours) * 0.8,
          confidence: 0.5
        })
      }
    }
    
    // Look for small tasks that can be merged
    const smallTasks = criticalPath.tasks.filter(t => t.estimated_hours <= 4)
    if (smallTasks.length >= 2) {
      // Group by similar type
      const similarTasks = smallTasks.filter((task, index) => {
        if (index === 0) return false
        const prevTask = smallTasks[index - 1]
        return task.title.split(' ')[0] === prevTask.title.split(' ')[0] // Similar first word
      })
      
      if (similarTasks.length > 0) {
        suggestions.push({
          type: 'merge',
          tasks: similarTasks.map(t => t.task_id),
          expected_time_savings: similarTasks.length * 2, // Save 2 hours per merge
          confidence: 0.8
        })
      }
    }
    
    return suggestions.sort((a, b) => b.expected_time_savings - a.expected_time_savings)
  }
  
  /**
   * Create task dependencies from natural language analysis
   */
  static inferDependencies(tasks: any[]): TaskDependency[] {
    const dependencies: TaskDependency[] = []
    
    for (const task of tasks) {
      for (const otherTask of tasks) {
        if (task.id === otherTask.id) continue
        
        const dependency = this.analyzeDependencyRelationship(task, otherTask)
        if (dependency) {
          dependencies.push({
            id: `dep-${task.id}-${otherTask.id}`,
            task_id: task.id,
            depends_on_task_id: otherTask.id,
            dependency_type: dependency.type,
            created_at: new Date().toISOString(),
            metadata: {
              strength: dependency.strength,
              reason: dependency.reason,
              risk_level: dependency.risk_level
            }
          })
        }
      }
    }
    
    return dependencies
  }
  
  /**
   * Analyze dependency relationship between two tasks
   */
  private static analyzeDependencyRelationship(
    task: any,
    potentialDependency: any
  ): {
    type: 'blocks' | 'suggests' | 'enhances' | 'requires'
    strength: number
    reason: string
    risk_level: 'low' | 'medium' | 'high'
  } | null {
    
    const taskTitle = task.title.toLowerCase()
    const depTitle = potentialDependency.title.toLowerCase()
    const taskDesc = (task.description || '').toLowerCase()
    const depDesc = (potentialDependency.description || '').toLowerCase()
    
    // Strong blocking dependencies
    if (taskTitle.includes('deploy') && depTitle.includes('test')) {
      return {
        type: 'blocks',
        strength: 0.9,
        reason: 'Deployment should happen after testing',
        risk_level: 'high'
      }
    }
    
    if (taskTitle.includes('integration') && depTitle.includes('api')) {
      return {
        type: 'blocks',
        strength: 0.8,
        reason: 'Integration requires API implementation',
        risk_level: 'medium'
      }
    }
    
    if (taskTitle.includes('ui') && depTitle.includes('design')) {
      return {
        type: 'requires',
        strength: 0.7,
        reason: 'UI implementation requires design specifications',
        risk_level: 'medium'
      }
    }
    
    if (taskTitle.includes('database') && depTitle.includes('schema')) {
      return {
        type: 'blocks',
        strength: 0.9,
        reason: 'Database operations require schema definition',
        risk_level: 'high'
      }
    }
    
    // Check for technology stack dependencies
    if (taskTitle.includes('frontend') && depTitle.includes('backend')) {
      return {
        type: 'suggests',
        strength: 0.5,
        reason: 'Frontend development benefits from backend API availability',
        risk_level: 'low'
      }
    }
    
    // Sequential workflow dependencies
    if (task.type === 'testing' && potentialDependency.type === 'implementation') {
      return {
        type: 'blocks',
        strength: 0.8,
        reason: 'Testing requires implementation to be complete',
        risk_level: 'medium'
      }
    }
    
    if (task.type === 'documentation' && potentialDependency.type === 'implementation') {
      return {
        type: 'suggests',
        strength: 0.4,
        reason: 'Documentation is easier with implementation reference',
        risk_level: 'low'
      }
    }
    
    // Priority-based dependencies
    if (task.priority === 'critical' && potentialDependency.priority === 'high' &&
        task.type === potentialDependency.type) {
      return {
        type: 'suggests',
        strength: 0.3,
        reason: 'Higher priority tasks in same category should be done first',
        risk_level: 'low'
      }
    }
    
    return null
  }
}