/**
 * Artifact Reference System - Advanced cross-phase artifact referencing and retrieval
 * Supports @agent-name syntax for intelligent artifact resolution and context building
 */

import createServerClient from '@/lib/supabase/server'

export interface ArtifactReference {
  agentName: string
  artifactType?: string
  query?: string
  phase?: number
  timeframe?: 'latest' | 'all' | 'recent'
  priority?: 'high' | 'medium' | 'low'
  relevanceScore?: number
}

export interface ArtifactMetadata {
  phase: number
  agent: string
  confidence?: number
  references?: string[]
  created_at: string
  updated_at: string
  version?: number
  tags?: string[]
  dependencies?: string[]
}

export interface ResolvedArtifact {
  id: string
  reference_key: string
  type: string
  content: any
  metadata: ArtifactMetadata
  relevance_score: number
  context_summary: string
  related_artifacts: string[]
}

export interface ArtifactContext {
  artifacts: ResolvedArtifact[]
  summary: string
  phase_coverage: number[]
  agent_coverage: string[]
  total_relevance: number
  context_quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export class ArtifactReferenceSystem {
  
  /**
   * Parse @agent-name references from text with enhanced pattern matching
   */
  static parseArtifactReferences(text: string): ArtifactReference[] {
    const references: ArtifactReference[] = []
    
    // Enhanced patterns for different reference formats
    const patterns = [
      // @agent-name:artifact-type
      /@([a-zA-Z0-9-]+):([a-zA-Z0-9-]+)(?:\s*\(([^)]+)\))?/g,
      // @agent-name.artifact-type
      /@([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)(?:\s*\[([^\]]+)\])?/g,
      // @agent-name with optional modifiers
      /@([a-zA-Z0-9-]+)(?:\s+(requirements?|specifications?|tasks?|code|docs?|tests?|validation|security))?(?:\s*\{([^}]+)\})?/g,
      // @agent-name#phase-number
      /@([a-zA-Z0-9-]+)#(\d+)(?:\s*\(([^)]+)\))?/g,
      // @agent-name@timeframe (latest, recent, all)
      /@([a-zA-Z0-9-]+)@(latest|recent|all)(?:\s*\[([^\]]+)\])?/g
    ]
    
    patterns.forEach((pattern, patternIndex) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const agentName = match[1]
        let artifactType: string | undefined
        let query: string | undefined
        let phase: number | undefined
        let timeframe: 'latest' | 'all' | 'recent' = 'latest'
        
        switch (patternIndex) {
          case 0: // @agent:type(query)
            artifactType = match[2]
            query = match[3]
            break
          case 1: // @agent.type[query]
            artifactType = match[2]
            query = match[3]
            break
          case 2: // @agent type{query}
            artifactType = match[2]
            query = match[3]
            break
          case 3: // @agent#phase(query)
            phase = parseInt(match[2])
            query = match[3]
            break
          case 4: // @agent@timeframe[query]
            timeframe = match[2] as 'latest' | 'all' | 'recent'
            query = match[3]
            break
        }
        
        // Avoid duplicates
        const existingRef = references.find(ref => 
          ref.agentName === agentName && 
          ref.artifactType === artifactType &&
          ref.phase === phase
        )
        
        if (!existingRef) {
          references.push({
            agentName,
            artifactType,
            query,
            phase,
            timeframe,
            priority: this.determinePriority(agentName, artifactType, query)
          })
        }
      }
    })
    
    return references
  }
  
  /**
   * Resolve artifact references to actual artifacts with intelligent filtering
   */
  static async resolveArtifactReferences(
    sessionId: string,
    workspaceId: string,
    references: ArtifactReference[],
    currentPhase?: number
  ): Promise<ArtifactContext> {
    
    if (references.length === 0) {
      return {
        artifacts: [],
        summary: 'No artifact references found',
        phase_coverage: [],
        agent_coverage: [],
        total_relevance: 0,
        context_quality: 'poor'
      }
    }
    
    try {
      const supabase = await createServerClient()
      const allArtifacts: ResolvedArtifact[] = []
      
      for (const reference of references) {
        const artifacts = await this.resolveReference(
          supabase,
          sessionId,
          workspaceId,
          reference,
          currentPhase
        )
        allArtifacts.push(...artifacts)
      }
      
      // Remove duplicates and sort by relevance
      const uniqueArtifacts = this.deduplicateArtifacts(allArtifacts)
      const sortedArtifacts = this.sortByRelevance(uniqueArtifacts)
      
      // Generate context summary
      const context = this.buildArtifactContext(sortedArtifacts, references)
      
      console.log(`[ARTIFACT SYSTEM] Resolved ${sortedArtifacts.length} artifacts from ${references.length} references`)
      
      return context
      
    } catch (error) {
      console.error('[ARTIFACT SYSTEM] Resolution failed:', error)
      return {
        artifacts: [],
        summary: `Failed to resolve artifact references: ${error instanceof Error ? error.message : 'Unknown error'}`,
        phase_coverage: [],
        agent_coverage: [],
        total_relevance: 0,
        context_quality: 'poor'
      }
    }
  }
  
  /**
   * Resolve a single artifact reference
   */
  private static async resolveReference(
    supabase: any,
    sessionId: string,
    workspaceId: string,
    reference: ArtifactReference,
    currentPhase?: number
  ): Promise<ResolvedArtifact[]> {
    
    let query = supabase
      .from('subagent_artifacts')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .eq('source_agent', reference.agentName)
    
    // Filter by artifact type if specified
    if (reference.artifactType) {
      query = query.eq('artifact_type', reference.artifactType)
    }
    
    // Filter by phase if specified
    if (reference.phase) {
      query = query.eq('metadata->>phase', reference.phase.toString())
    }
    
    // Apply timeframe filtering
    switch (reference.timeframe) {
      case 'latest':
        query = query.order('created_at', { ascending: false }).limit(5)
        break
      case 'recent':
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', oneWeekAgo).order('created_at', { ascending: false }).limit(10)
        break
      case 'all':
        query = query.order('created_at', { ascending: false }).limit(50)
        break
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(`[ARTIFACT SYSTEM] Query error for ${reference.agentName}:`, error)
      return []
    }
    
    if (!data || data.length === 0) {
      console.log(`[ARTIFACT SYSTEM] No artifacts found for ${reference.agentName}`)
      return []
    }
    
    // Convert to resolved artifacts with relevance scoring
    return data.map(artifact => {
      const relevanceScore = this.calculateRelevanceScore(
        artifact,
        reference,
        currentPhase
      )
      
      return {
        id: artifact.id,
        reference_key: artifact.reference_key,
        type: artifact.artifact_type,
        content: artifact.artifact_data,
        metadata: {
          phase: artifact.metadata?.phase || 0,
          agent: artifact.source_agent,
          confidence: artifact.metadata?.confidence,
          references: artifact.metadata?.references,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at,
          version: artifact.metadata?.version,
          tags: artifact.metadata?.tags,
          dependencies: artifact.metadata?.dependencies
        },
        relevance_score: relevanceScore,
        context_summary: this.generateContextSummary(artifact, reference),
        related_artifacts: artifact.metadata?.references || []
      }
    })
  }
  
  /**
   * Calculate relevance score for an artifact
   */
  private static calculateRelevanceScore(
    artifact: any,
    reference: ArtifactReference,
    currentPhase?: number
  ): number {
    let score = 0.5 // Base score
    
    // Boost score for exact artifact type match
    if (reference.artifactType === artifact.artifact_type) {
      score += 0.3
    }
    
    // Boost score for phase proximity
    if (currentPhase && artifact.metadata?.phase) {
      const phaseDiff = Math.abs(currentPhase - artifact.metadata.phase)
      score += Math.max(0, 0.2 - (phaseDiff * 0.05))
    }
    
    // Boost score for recent artifacts
    const daysSinceCreation = (Date.now() - new Date(artifact.created_at).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 0.1 - (daysSinceCreation * 0.01))
    
    // Boost score for high confidence artifacts
    if (artifact.metadata?.confidence) {
      score += artifact.metadata.confidence * 0.2
    }
    
    // Boost score for query match
    if (reference.query && artifact.artifact_data) {
      const contentString = JSON.stringify(artifact.artifact_data).toLowerCase()
      const queryWords = reference.query.toLowerCase().split(/\s+/)
      const matchCount = queryWords.filter(word => contentString.includes(word)).length
      score += (matchCount / queryWords.length) * 0.2
    }
    
    return Math.min(1.0, Math.max(0.0, score))
  }
  
  /**
   * Generate context summary for an artifact
   */
  private static generateContextSummary(artifact: any, reference: ArtifactReference): string {
    const agentName = artifact.source_agent
    const artifactType = artifact.artifact_type
    const phase = artifact.metadata?.phase || 'unknown'
    
    let summary = `${agentName} ${artifactType} from phase ${phase}`
    
    if (artifact.artifact_data) {
      // Try to extract meaningful summary from content
      if (typeof artifact.artifact_data === 'object') {
        if (artifact.artifact_data.title) {
          summary += `: ${artifact.artifact_data.title}`
        } else if (artifact.artifact_data.name) {
          summary += `: ${artifact.artifact_data.name}`
        } else if (artifact.artifact_data.description) {
          summary += `: ${artifact.artifact_data.description.substring(0, 100)}...`
        }
      } else if (typeof artifact.artifact_data === 'string') {
        summary += `: ${artifact.artifact_data.substring(0, 100)}...`
      }
    }
    
    return summary
  }
  
  /**
   * Remove duplicate artifacts
   */
  private static deduplicateArtifacts(artifacts: ResolvedArtifact[]): ResolvedArtifact[] {
    const seen = new Set<string>()
    const unique: ResolvedArtifact[] = []
    
    for (const artifact of artifacts) {
      const key = `${artifact.metadata.agent}-${artifact.type}-${artifact.reference_key}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(artifact)
      }
    }
    
    return unique
  }
  
  /**
   * Sort artifacts by relevance score
   */
  private static sortByRelevance(artifacts: ResolvedArtifact[]): ResolvedArtifact[] {
    return artifacts.sort((a, b) => b.relevance_score - a.relevance_score)
  }
  
  /**
   * Build comprehensive artifact context
   */
  private static buildArtifactContext(
    artifacts: ResolvedArtifact[],
    references: ArtifactReference[]
  ): ArtifactContext {
    
    const phaseCoverage = [...new Set(artifacts.map(a => a.metadata.phase))]
    const agentCoverage = [...new Set(artifacts.map(a => a.metadata.agent))]
    const totalRelevance = artifacts.reduce((sum, a) => sum + a.relevance_score, 0)
    
    // Generate summary
    let summary = `Resolved ${artifacts.length} artifacts from ${agentCoverage.length} agents across ${phaseCoverage.length} phases.`
    
    if (artifacts.length > 0) {
      const topArtifact = artifacts[0]
      summary += ` Most relevant: ${topArtifact.context_summary}`
    }
    
    // Determine context quality
    let contextQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor'
    const avgRelevance = artifacts.length > 0 ? totalRelevance / artifacts.length : 0
    
    if (avgRelevance > 0.8 && artifacts.length >= references.length) {
      contextQuality = 'excellent'
    } else if (avgRelevance > 0.6 && artifacts.length > 0) {
      contextQuality = 'good'  
    } else if (artifacts.length > 0) {
      contextQuality = 'fair'
    }
    
    return {
      artifacts,
      summary,
      phase_coverage: phaseCoverage,
      agent_coverage: agentCoverage,
      total_relevance: totalRelevance,
      context_quality: contextQuality
    }
  }
  
  /**
   * Determine priority based on agent and type
   */
  private static determinePriority(
    agentName: string,
    artifactType?: string,
    query?: string
  ): 'high' | 'medium' | 'low' {
    
    // High priority agents and types
    const highPriorityAgents = ['requirements-analyst', 'system-architect', 'security-auditor']
    const highPriorityTypes = ['requirement', 'specification', 'security', 'validation']
    
    if (highPriorityAgents.includes(agentName) || 
        (artifactType && highPriorityTypes.includes(artifactType))) {
      return 'high'
    }
    
    // Critical queries get high priority
    if (query && (query.includes('critical') || query.includes('security') || query.includes('error'))) {
      return 'high'
    }
    
    // Development and planning are medium priority
    const mediumPriorityAgents = ['code-generator', 'project-planner', 'qa-engineer']
    if (mediumPriorityAgents.includes(agentName)) {
      return 'medium'
    }
    
    return 'low'
  }
  
  /**
   * Format artifacts for Claude prompt injection
   */
  static formatArtifactsForPrompt(context: ArtifactContext): string {
    if (context.artifacts.length === 0) {
      return '## Referenced Artifacts\nNo artifacts found for the specified references.\n\n'
    }
    
    let formatted = '## Referenced Artifacts\n'
    formatted += `${context.summary}\n\n`
    
    // Group artifacts by agent
    const artifactsByAgent = new Map<string, ResolvedArtifact[]>()
    context.artifacts.forEach(artifact => {
      const agent = artifact.metadata.agent
      if (!artifactsByAgent.has(agent)) {
        artifactsByAgent.set(agent, [])
      }
      artifactsByAgent.get(agent)!.push(artifact)
    })
    
    // Format each agent's artifacts
    for (const [agent, artifacts] of artifactsByAgent) {
      formatted += `### From @${agent}:\n`
      
      artifacts.forEach((artifact, index) => {
        formatted += `${index + 1}. **${artifact.type}** (Phase ${artifact.metadata.phase}, Relevance: ${(artifact.relevance_score * 100).toFixed(0)}%)\n`
        formatted += `   ${artifact.context_summary}\n`
        
        // Include content preview
        if (artifact.content) {
          const contentPreview = typeof artifact.content === 'string' 
            ? artifact.content.substring(0, 200)
            : JSON.stringify(artifact.content, null, 2).substring(0, 200)
          formatted += `   Content: ${contentPreview}${contentPreview.length >= 200 ? '...' : ''}\n`
        }
        
        formatted += '\n'
      })
    }
    
    return formatted
  }
  
  /**
   * Get artifact statistics for a session
   */
  static async getArtifactStatistics(sessionId: string, workspaceId: string) {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('subagent_artifacts')
        .select('source_agent, artifact_type, metadata, created_at')
        .eq('session_id', sessionId)
        .eq('workspace_id', workspaceId)
      
      if (error) {
        console.error('[ARTIFACT SYSTEM] Statistics query failed:', error)
        return null
      }
      
      const stats = {
        total_artifacts: data?.length || 0,
        by_agent: {} as Record<string, number>,
        by_type: {} as Record<string, number>,
        by_phase: {} as Record<number, number>,
        recent_activity: data?.filter(a => {
          const daysSince = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)
          return daysSince <= 7
        }).length || 0
      }
      
      data?.forEach(artifact => {
        // Count by agent
        stats.by_agent[artifact.source_agent] = (stats.by_agent[artifact.source_agent] || 0) + 1
        
        // Count by type
        stats.by_type[artifact.artifact_type] = (stats.by_type[artifact.artifact_type] || 0) + 1
        
        // Count by phase
        const phase = artifact.metadata?.phase || 0
        stats.by_phase[phase] = (stats.by_phase[phase] || 0) + 1
      })
      
      return stats
      
    } catch (error) {
      console.error('[ARTIFACT SYSTEM] Statistics error:', error)
      return null
    }
  }
}