/**
 * SubagentWorkflowManager - Enhanced workflow management with Claude Code subagent delegation
 * Extends the base WorkflowManager with phase-specific subagent capabilities
 */

import { WorkflowManager } from './workflow-manager'
import createServerClient from '@/lib/supabase/server'
import { ArtifactReferenceSystem } from './artifact-reference-system'
import { ParallelProcessor, ParallelTask } from './parallel-processor'
import { OfficialSubAgentsManager, SubAgentExecution, SubAgentResult } from '../claude-sdk/official-subagents-manager'

// Subagent configuration types
interface SubagentConfig {
  name: string
  description: string
  tools: string[]
  systemPrompt: string
  capabilities: string[]
}

interface SubagentOptions {
  tools?: string[]
  maxTurns?: number
  timeout?: number
  preserveContext?: boolean
}

interface SubagentResult {
  response: string
  context: any
  artifacts: SubagentArtifact[]
  duration: number
  tokensUsed?: number
  success: boolean
  error?: string
}

interface SubagentArtifact {
  type: 'requirement' | 'specification' | 'task' | 'code' | 'documentation' | 'test'
  content: any
  metadata: {
    phase: number
    agent: string
    confidence?: number
    references?: string[]
  }
}

interface ArtifactReference {
  agentName: string
  artifactType: string
  query?: string
}

// Use centralized phase to subagent mapping from registry

export class SubagentWorkflowManager extends WorkflowManager {
  private subagentContexts: Map<string, any> = new Map()
  private artifacts: Map<string, SubagentArtifact[]> = new Map()
  private parallelProcessor: ParallelProcessor
  private officialSubAgents: OfficialSubAgentsManager
  private projectPath: string

  constructor(sessionId: string, projectPath?: string) {
    super(sessionId)
    this.parallelProcessor = new ParallelProcessor(this)
    this.projectPath = projectPath || `/tmp/pria-session-${sessionId}`
    this.officialSubAgents = new OfficialSubAgentsManager(this.projectPath)
  }

  /**
   * Execute current workflow phase using appropriate subagent (streaming version)
   */
  async* executeWithSubagentStream(
    userPrompt: string,
    options: SubagentOptions = {}
  ): AsyncGenerator<{
    type: 'text' | 'tool_use' | 'artifact' | 'error' | 'complete' | 'phase_info'
    content: any
  }> {
    try {
      const currentPhase = await this.getCurrentPhase()
      if (!currentPhase) {
        yield { type: 'error', content: 'No active workflow phase found' }
        return
      }

      const agentName = this.getPhaseAgent(currentPhase.number)
      const phasePrompt = await this.getCurrentPhasePrompt()
      
      // Send phase information
      yield {
        type: 'phase_info',
        content: {
          phase: currentPhase.number,
          phaseName: currentPhase.name,
          agentName,
          subagentRole: agentName
        }
      }
      
      console.log(`[SUBAGENT STREAM] Executing Phase ${currentPhase.number} with agent: ${agentName}`)
      
      // Load preserved context and artifacts
      const context = await this.loadSubagentContext(agentName)
      const artifacts = await this.resolveArtifactReferences(userPrompt)
      
      // Use official sub-agents manager to determine the appropriate agent
      const selectedAgent = this.officialSubAgents.selectSubAgentForTask(userPrompt, {
        phase: currentPhase.number
      })
      
      console.log(`[SUBAGENT STREAM] Selected agent: ${selectedAgent} for phase ${currentPhase.number}`)
      
      // Build enhanced prompt with phase context
      const enhancedPrompt = `${phasePrompt}\n\n---\n\nUser Request: ${userPrompt}`
      
      // Get workspace ID for context
      const workspaceId = await this.getWorkspaceId()
      
      // Create execution context for official sub-agent
      const execution: SubAgentExecution = {
        agentName: selectedAgent,
        prompt: enhancedPrompt,
        context: {
          sessionId: this.sessionId,
          workspaceId: workspaceId || 'unknown',
          phase: currentPhase.number,
          projectPath: this.projectPath
        },
        options: {
          maxTurns: options.maxTurns || 10,
          timeout: options.timeout || 120000
        }
      }
      
      // Execute using official sub-agents (note: streaming is handled differently in official approach)
      const result = await this.officialSubAgents.executeSubAgent(execution)
      
      // Yield the complete result (official sub-agents don't stream in the same way)
      yield {
        type: 'text',
        content: result.response
      }
      
      if (result.artifacts.length > 0) {
        for (const artifact of result.artifacts) {
          yield {
            type: 'artifact',
            content: artifact
          }
        }
      }
      
      // Store artifacts
      if (result.artifacts.length > 0) {
        await this.storeSubagentArtifacts(selectedAgent, result.artifacts)
      }
      
      // Save subagent context
      await this.saveSubagentContext(selectedAgent, {
        lastExecuted: new Date().toISOString(),
        sessionId: this.sessionId,
        agentName: selectedAgent,
        phase: currentPhase.number,
        lastResponse: result.response
      })
      
      yield {
        type: 'complete',
        content: {
          agentName: selectedAgent,
          phase: currentPhase.number,
          artifacts: result.artifacts,
          duration: result.duration,
          success: result.success
        }
      }
      
    } catch (error) {
      console.error(`[SUBAGENT STREAM] Execution failed:`, error)
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get workspace ID for the current session
   */
  private async getWorkspaceId(): Promise<string | null> {
    try {
      const supabase = await createServerClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()
      
      return session?.workspace_id || null
    } catch (error) {
      console.error('[SUBAGENT] Failed to get workspace ID:', error)
      return null
    }
  }

  /**
   * Execute current workflow phase using appropriate subagent
   */
  async executeWithSubagent(
    userPrompt: string,
    options: SubagentOptions = {}
  ): Promise<SubagentResult> {
    
    try {
      const currentPhase = await this.getCurrentPhase()
      if (!currentPhase) {
        throw new Error('No active workflow phase found')
      }

      const phasePrompt = await this.getCurrentPhasePrompt()
      
      // Use official sub-agents manager to select appropriate agent
      const selectedAgent = this.officialSubAgents.selectSubAgentForTask(userPrompt, {
        phase: currentPhase.number
      })
      
      console.log(`[SUBAGENT] Executing Phase ${currentPhase.number} with official agent: ${selectedAgent}`)
      
      // Build enhanced prompt with phase context
      const enhancedPrompt = `${phasePrompt}\n\n---\n\nUser Request: ${userPrompt}`
      
      // Get workspace ID for context
      const workspaceId = await this.getWorkspaceId()
      
      // Create execution context for official sub-agent
      const execution: SubAgentExecution = {
        agentName: selectedAgent,
        prompt: enhancedPrompt,
        context: {
          sessionId: this.sessionId,
          workspaceId: workspaceId || 'unknown',
          phase: currentPhase.number,
          projectPath: this.projectPath
        },
        options: {
          maxTurns: options.maxTurns || 10,
          timeout: options.timeout || 120000
        }
      }
      
      // Execute using official sub-agents
      const result = await this.officialSubAgents.executeSubAgent(execution)
      
      // Convert official result to SubagentResult format
      const convertedResult: SubagentResult = {
        response: result.response,
        context: {
          agentName: result.agentName,
          sessionId: this.sessionId,
          phase: currentPhase.number,
          lastExecuted: new Date().toISOString()
        },
        artifacts: result.artifacts.map(artifact => ({
          type: artifact.type || 'code',
          content: artifact.content || artifact,
          metadata: {
            phase: currentPhase.number,
            agent: result.agentName,
            confidence: 0.9
          }
        })),
        duration: result.duration,
        success: result.success,
        error: result.error
      }
      
      // Store artifacts and context
      if (convertedResult.artifacts.length > 0) {
        await this.storeSubagentArtifacts(selectedAgent, convertedResult.artifacts)
      }
      
      await this.saveSubagentContext(selectedAgent, convertedResult.context)
      
      return convertedResult
      
    } catch (error) {
      console.error('[SUBAGENT] Execution failed:', error)
      return {
        response: `Subagent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: {},
        artifacts: [],
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get the appropriate subagent for a workflow phase
   */
  public getPhaseAgent(phaseNumber: number): string {
    const phaseAgentMap: Record<number, string> = {
      1: 'requirements-analyst',    // Requirements Gathering
      2: 'architecture-designer',  // Architecture & Technical Design
      3: 'implementation-planner', // Implementation Planning
      4: 'code-generator',         // Development & Implementation
      5: 'test-specialist',        // Testing & Quality Assurance
      6: 'security-auditor',       // Final Validation & Code Review
      7: 'deployment-specialist'   // Deployment & Monitoring
    }
    
    const agent = phaseAgentMap[phaseNumber]
    if (!agent) {
      console.warn(`[SUBAGENT] No specific agent for phase ${phaseNumber}, using code-generator`)
      return 'code-generator'
    }
    
    console.log(`[SUBAGENT] Phase ${phaseNumber} mapped to agent: ${agent}`)
    return agent
  }

  /**
   * Load preserved context for a specific subagent
   */
  private async loadSubagentContext(agentName: string): Promise<any> {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('subagent_contexts')
        .select('context_data, artifacts, version')
        .eq('session_id', this.sessionId)
        .eq('agent_name', agentName)
        .order('version', { ascending: false })
        .limit(1)
        .single()
      
      if (error) {
        console.log(`[SUBAGENT] No existing context for ${agentName}, starting fresh`)
        return {}
      }
      
      console.log(`[SUBAGENT] Loaded context for ${agentName} (version ${data.version})`)
      return data.context_data || {}
      
    } catch (error) {
      console.warn(`[SUBAGENT] Failed to load context for ${agentName}:`, error)
      return {}
    }
  }

  /**
   * Save subagent context for future invocations
   */
  private async saveSubagentContext(agentName: string, context: any, artifacts: SubagentArtifact[] = []): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      // Get workspace_id from session
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()
      
      if (!session) {
        throw new Error('Session not found')
      }
      
      // Get current version for this agent
      const { data: currentContext } = await supabase
        .from('subagent_contexts')
        .select('version')
        .eq('session_id', this.sessionId)
        .eq('agent_name', agentName)
        .order('version', { ascending: false })
        .limit(1)
        .single()
      
      const nextVersion = (currentContext?.version || 0) + 1
      
      // Save new context version
      const { error } = await supabase
        .from('subagent_contexts')
        .insert({
          workspace_id: session.workspace_id,
          session_id: this.sessionId,
          agent_name: agentName,
          phase_number: (await this.getCurrentPhase())?.number,
          context_data: context,
          artifacts: artifacts,
          version: nextVersion
        })
      
      if (error) {
        console.error(`[SUBAGENT] Failed to save context for ${agentName}:`, error)
      } else {
        console.log(`[SUBAGENT] Saved context for ${agentName} (version ${nextVersion})`)
      }
      
    } catch (error) {
      console.error(`[SUBAGENT] Context save error for ${agentName}:`, error)
    }
  }

  /**
   * Resolve artifact references in prompt (@agent-name syntax) using enhanced system
   */
  private async resolveArtifactReferences(prompt: string): Promise<SubagentArtifact[]> {
    try {
      // Parse references using enhanced system
      const references = ArtifactReferenceSystem.parseArtifactReferences(prompt)
      
      if (references.length === 0) {
        return []
      }
      
      console.log(`[SUBAGENT] Resolving ${references.length} enhanced artifact references:`, references.map(r => `${r.agentName}${r.artifactType ? ':' + r.artifactType : ''}${r.phase ? '#' + r.phase : ''}`))
      
      // Get workspace_id for resolution
      const supabase = await createServerClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()
      
      if (!session?.workspace_id) {
        console.error('[SUBAGENT] No workspace found for session')
        return []
      }
      
      // Get current phase for relevance scoring
      const currentPhase = await this.getCurrentPhase()
      
      // Resolve using enhanced system
      const artifactContext = await ArtifactReferenceSystem.resolveArtifactReferences(
        this.sessionId,
        session.workspace_id,
        references,
        currentPhase?.number
      )
      
      console.log(`[SUBAGENT] Enhanced resolution completed: ${artifactContext.artifacts.length} artifacts, quality: ${artifactContext.context_quality}`)
      console.log(`[SUBAGENT] Context summary: ${artifactContext.summary}`)
      
      // Convert to legacy format for compatibility
      return artifactContext.artifacts.map(artifact => ({
        type: artifact.type as any,
        content: artifact.content,
        metadata: artifact.metadata
      }))
      
    } catch (error) {
      console.error('[SUBAGENT] Enhanced artifact resolution failed:', error)
      return []
    }
  }

  /**
   * Extract @agent-name references from prompt text
   */
  private extractArtifactReferences(prompt: string): ArtifactReference[] {
    const references: ArtifactReference[] = []
    
    // Match @agent-name patterns
    const pattern = /@([a-zA-Z0-9-]+)(?:\s+(requirements?|specifications?|tasks?|code|docs?))?/g
    let match
    
    while ((match = pattern.exec(prompt)) !== null) {
      const agentName = match[1]
      const artifactType = match[2] || 'any'
      
      references.push({
        agentName,
        artifactType
      })
    }
    
    return references
  }

  /**
   * Build enhanced prompt with context and artifact references using enhanced formatting
   */
  private async buildEnhancedPrompt(
    userPrompt: string,
    phasePrompt: string,
    context: any,
    artifacts: SubagentArtifact[]
  ): Promise<string> {
    
    let enhancedPrompt = phasePrompt + '\n\n'
    
    // Add preserved context if available
    if (context && Object.keys(context).length > 0) {
      enhancedPrompt += '## Previous Context\n'
      enhancedPrompt += `You have previously worked on this session. Here's your preserved context:\n`
      enhancedPrompt += '```json\n' + JSON.stringify(context, null, 2) + '\n```\n\n'
    }
    
    // Add artifact references using enhanced formatting
    if (artifacts.length > 0) {
      try {
        // Parse the original prompt to get references for enhanced formatting
        const references = ArtifactReferenceSystem.parseArtifactReferences(userPrompt)
        
        // Get workspace for context resolution
        const supabase = await createServerClient()
        const { data: session } = await supabase
          .from('sessions')
          .select('workspace_id')
          .eq('id', this.sessionId)
          .single()
        
        if (session?.workspace_id) {
          const currentPhase = await this.getCurrentPhase()
          
          // Get full artifact context for enhanced formatting
          const artifactContext = await ArtifactReferenceSystem.resolveArtifactReferences(
            this.sessionId,
            session.workspace_id,
            references,
            currentPhase?.number
          )
          
          // Use enhanced formatting
          enhancedPrompt += ArtifactReferenceSystem.formatArtifactsForPrompt(artifactContext)
        } else {
          // Fallback to legacy formatting
          enhancedPrompt += this.legacyFormatArtifacts(artifacts)
        }
      } catch (error) {
        console.error('[SUBAGENT] Enhanced formatting failed, using legacy:', error)
        enhancedPrompt += this.legacyFormatArtifacts(artifacts)
      }
    }
    
    // Add current user request
    enhancedPrompt += '---\n\n'
    enhancedPrompt += '## Current User Request\n'
    enhancedPrompt += userPrompt
    
    return enhancedPrompt
  }
  
  /**
   * Legacy artifact formatting for fallback
   */
  private legacyFormatArtifacts(artifacts: SubagentArtifact[]): string {
    let formatted = '## Referenced Artifacts\n'
    formatted += 'The following artifacts from other subagents are available for reference:\n\n'
    
    const artifactsByAgent = new Map<string, SubagentArtifact[]>()
    artifacts.forEach(artifact => {
      const agent = artifact.metadata.agent
      if (!artifactsByAgent.has(agent)) {
        artifactsByAgent.set(agent, [])
      }
      artifactsByAgent.get(agent)!.push(artifact)
    })
    
    for (const [agent, agentArtifacts] of artifactsByAgent) {
      formatted += `### From @${agent}:\n`
      agentArtifacts.forEach((artifact, index) => {
        formatted += `${index + 1}. **${artifact.type}**: ${JSON.stringify(artifact.content, null, 2)}\n`
      })
      formatted += '\n'
    }
    
    return formatted
  }

  /**
   * Execute subagent with enhanced configuration and validation
   */
  private async executeSubagent(agentName: string, prompt: string, options: SubagentOptions): Promise<SubagentResult> {
    const startTime = Date.now()
    
    try {
      // Get subagent configuration from registry
      const subagentConfig = SubagentRegistryManager.getSubagent(agentName)
      const subagentCapabilities = SubagentRegistryManager.getSubagentCapabilities(agentName)
      
      if (!subagentConfig) {
        throw new Error(`Subagent configuration not found for: ${agentName}`)
      }
      
      console.log(`[SUBAGENT] Executing ${agentName} (Phase ${subagentConfig.phase}) with specialized capabilities:`)
      console.log(`[SUBAGENT] - Capabilities: ${subagentConfig.capabilities.join(', ')}`)
      console.log(`[SUBAGENT] - Tools: ${subagentConfig.tools.join(', ')}`)
      
      if (subagentCapabilities) {
        console.log(`[SUBAGENT] - Can generate code: ${subagentCapabilities.canGenerateCode}`)
        console.log(`[SUBAGENT] - Can execute tests: ${subagentCapabilities.canExecuteTests}`)
        console.log(`[SUBAGENT] - Specializations: ${subagentCapabilities.specializations.join(', ')}`)
      }
      
      // Build enhanced prompt with subagent-specific context
      const enhancedPrompt = this.buildSubagentPrompt(subagentConfig, prompt)
      
      // Execute using real Claude Code SDK
      const claudeContext = await this.buildClaudeContext(context, artifacts)
      const executionResult = await this.claudeExecutor.executeQuery(
        enhancedPrompt,
        claudeContext,
        {
          maxTurns: options.maxTurns || 10,
          timeout: options.timeout || 120000,
          tools: subagentConfig.tools,
          subagentRole: agentName
        }
      )
      
      // Store artifacts from execution
      if (executionResult.artifacts.length > 0) {
        await this.storeSubagentArtifacts(agentName, executionResult.artifacts)
      }
      
      const response = executionResult.response
      
      return {
        response,
        context: {
          ...executionResult.context,
          agentName,
          agentPhase: subagentConfig.phase,
          agentCapabilities: subagentConfig.capabilities,
          executionOptions: options,
          tokensUsed: executionResult.tokensUsed,
          filesModified: executionResult.filesModified
        },
        artifacts: executionResult.artifacts,
        duration: executionResult.duration,
        success: executionResult.success,
        error: executionResult.error
      }
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[SUBAGENT] Execution failed for ${agentName}:`, error)
      
      return {
        response: `Subagent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: {},
        artifacts: [],
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Build subagent-specific prompt with configuration context
   */
  private buildSubagentPrompt(config: SubagentConfig, userPrompt: string): string {
    let prompt = config.systemPrompt + '\n\n'
    
    // Add phase entry context if available
    if (config.contextPrompts.phase_entry) {
      prompt += '## Phase Context\n'
      prompt += config.contextPrompts.phase_entry + '\n\n'
    }
    
    // Add cross-phase collaboration context
    if (config.contextPrompts.cross_phase_collaboration) {
      prompt += '## Cross-Phase Collaboration\n'
      prompt += config.contextPrompts.cross_phase_collaboration + '\n\n'
    }
    
    // Add specialized context based on agent type
    if (config.name === 'qa-engineer' && config.contextPrompts.quality_focus) {
      prompt += '## Quality Focus\n'
      prompt += config.contextPrompts.quality_focus + '\n\n'
    }
    
    if (config.name === 'security-auditor' && config.contextPrompts.security_standards) {
      prompt += '## Security Standards\n'
      prompt += config.contextPrompts.security_standards + '\n\n'
    }
    
    // Add validation rules
    if (config.validationRules.length > 0) {
      prompt += '## Validation Rules\n'
      config.validationRules.forEach((rule, index) => {
        prompt += `${index + 1}. ${rule}\n`
      })
      prompt += '\n'
    }
    
    // Add user request
    prompt += '---\n\n'
    prompt += '## Current Request\n'
    prompt += userPrompt
    
    return prompt
  }
  
  /**
   * Build Claude execution context from workflow state
   */
  private async buildClaudeContext(
    context: any,
    artifacts: SubagentArtifact[]
  ): Promise<ClaudeCodeContext> {
    const supabase = await createServerClient()
    
    // Get workspace ID
    const { data: session } = await supabase
      .from('sessions')
      .select('workspace_id')
      .eq('id', this.sessionId)
      .single()
    
    const workspaceId = session?.workspace_id
    if (!workspaceId) {
      throw new Error('Workspace ID not found for session')
    }
    
    // Get current phase
    const currentPhase = await this.getCurrentPhase()
    
    // Load requirements
    const { data: requirements } = await supabase
      .from('requirements')
      .select('*')
      .eq('session_id', this.sessionId)
      .eq('workspace_id', workspaceId)
    
    // Load specifications
    const { data: specifications } = await supabase
      .from('technical_specs')
      .select('*')
      .eq('session_id', this.sessionId)
      .eq('workspace_id', workspaceId)
    
    return {
      sessionId: this.sessionId,
      workspaceId,
      phase: currentPhase?.number || 1,
      previousContext: context,
      requirements: requirements || [],
      specifications: specifications || [],
      artifacts
    }
  }
  
  /**
   * Store artifacts generated by subagent execution
   */
  private async storeSubagentArtifacts(
    agentName: string,
    artifacts: SubagentArtifact[]
  ): Promise<void> {
    try {
      const supabase = await createServerClient()
      
      // Get workspace ID
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()
      
      const workspaceId = session?.workspace_id
      if (!workspaceId) {
        throw new Error('Workspace ID not found for session')
      }
      
      // Store artifacts in database
      const artifactRecords = artifacts.map(artifact => ({
        session_id: this.sessionId,
        workspace_id: workspaceId,
        agent_name: agentName,
        artifact_type: artifact.type,
        content: artifact.content,
        metadata: artifact.metadata,
        created_at: new Date().toISOString()
      }))
      
      const { error } = await supabase
        .from('subagent_artifacts')
        .insert(artifactRecords)
      
      if (error) {
        console.error('[SUBAGENT] Failed to store artifacts:', error)
      } else {
        console.log(`[SUBAGENT] Stored ${artifacts.length} artifacts for ${agentName}`)
      }
      
      // Update local artifacts cache
      if (!this.artifacts.has(agentName)) {
        this.artifacts.set(agentName, [])
      }
      this.artifacts.get(agentName)!.push(...artifacts)
      
    } catch (error) {
      console.error('[SUBAGENT] Error storing artifacts:', error)
    }
  }
  
  /**
   * Generate enhanced subagent response simulation (DEPRECATED - keeping for fallback)
   */
  private generateSubagentResponse(config: SubagentConfig, prompt: string, options: SubagentOptions): string {
    const capabilities = SubagentRegistryManager.getSubagentCapabilities(config.name)
    
    let response = `[ENHANCED SUBAGENT SIMULATION] Agent ${config.name} (Phase ${config.phase}) processing request with specialized expertise.\n\n`
    
    response += `## Agent Configuration\n`
    response += `- **Description**: ${config.description}\n`
    response += `- **Phase**: ${config.phase}\n`
    response += `- **Capabilities**: ${config.capabilities.join(', ')}\n`
    response += `- **Tools**: ${config.tools.join(', ')}\n`
    
    if (capabilities) {
      response += `- **Can Generate Code**: ${capabilities.canGenerateCode}\n`
      response += `- **Can Execute Tests**: ${capabilities.canExecuteTests}\n`
      response += `- **Can Analyze Artifacts**: ${capabilities.canAnalyzeArtifacts}\n`
      response += `- **Specializations**: ${capabilities.specializations.join(', ')}\n`
      response += `- **Artifact Production**: ${capabilities.canProduceArtifacts.join(', ')}\n`
      response += `- **Artifact Consumption**: ${capabilities.canConsumeArtifacts.join(', ')}\n`
    }
    
    response += `\n## Execution Context\n`
    response += `- **Prompt Length**: ${prompt.length} characters\n`
    response += `- **Execution Options**: ${JSON.stringify(options, null, 2)}\n`
    response += `- **Output Formats**: ${config.outputFormats.join(', ')}\n`
    
    response += `\n## Specialized Processing\n`
    response += `This ${config.name} subagent would provide:\n`
    
    switch (config.name) {
      case 'qa-engineer':
        response += `- Comprehensive test strategy development\n`
        response += `- Automated test suite generation (unit, integration, e2e)\n`
        response += `- Quality metrics and coverage analysis\n`
        response += `- Performance and accessibility testing\n`
        response += `- PRIA compliance validation\n`
        break
        
      case 'security-auditor':
        response += `- Comprehensive security vulnerability assessment\n`
        response += `- OWASP Top 10 and CWE analysis\n`
        response += `- PRIA compliance verification (workspace isolation, RLS)\n`
        response += `- Threat modeling and risk assessment\n`
        response += `- Security recommendations and remediation plans\n`
        break
        
      default:
        response += `- Specialized processing for ${config.phase} phase activities\n`
        response += `- Domain-specific expertise and validation\n`
        response += `- Structured artifact generation\n`
        break
    }
    
    response += `\n## Enhanced Features\n`
    response += `- Access to preserved context from previous interactions\n`
    response += `- Ability to reference artifacts from other subagents using @agent-name syntax\n`
    response += `- Validation against phase-specific rules and requirements\n`
    response += `- Generation of structured artifacts for downstream consumption\n`
    response += `- Quality assurance and compliance checking\n`
    
    response += `\n---\n\n`
    response += `**Note**: This is an enhanced simulation showing the planned subagent capabilities. When fully integrated with Claude Code SDK, this agent will provide specialized, high-quality outputs for ${config.phase} phase activities.`
    
    return response
  }

  /**
   * Post-process subagent results
   */
  private async postProcessSubagentResult(
    agentName: string,
    phaseNumber: number,
    result: SubagentResult
  ): Promise<void> {
    
    try {
      // Save subagent context for future use
      await this.saveSubagentContext(agentName, result.context, result.artifacts)
      
      // Extract and store artifacts
      await this.extractAndStoreArtifacts(agentName, phaseNumber, result.response)
      
      // Update workflow progress if significant work was done
      if (result.success && result.response.length > 100) {
        const currentPhase = await this.getCurrentPhase()
        if (currentPhase) {
          const incrementAmount = Math.min(15, 100 - (currentPhase.progress || 0))
          await this.updatePhaseProgress((currentPhase.progress || 0) + incrementAmount)
        }
      }
      
      console.log(`[SUBAGENT] Post-processed results for ${agentName}`)
      
    } catch (error) {
      console.error(`[SUBAGENT] Post-processing failed for ${agentName}:`, error)
    }
  }

  /**
   * Extract artifacts from subagent response and store them
   */
  private async extractAndStoreArtifacts(
    agentName: string,
    phaseNumber: number,
    response: string
  ): Promise<void> {
    
    try {
      // Use existing extraction logic based on phase
      let extractedData: any[] = []
      
      if (phaseNumber === 1) {
        // Requirements extraction
        const { RequirementsExtractor } = await import('@/lib/requirements/requirements-extractor')
        extractedData = RequirementsExtractor.extractFromText(response, {
          workflow_phase: phaseNumber,
          session_id: this.sessionId
        })
        
        if (extractedData.length > 0) {
          await this.storeArtifacts(agentName, 'requirement', extractedData)
        }
        
      } else if (phaseNumber === 2) {
        // Technical specifications extraction
        const { TechnicalSpecsExtractor } = await import('@/lib/technical-specs/tech-specs-extractor')
        extractedData = TechnicalSpecsExtractor.extractFromText(response, {
          workflow_phase: phaseNumber,
          session_id: this.sessionId
        })
        
        if (extractedData.length > 0) {
          await this.storeArtifacts(agentName, 'specification', extractedData)
        }
        
      } else if (phaseNumber === 3) {
        // Task extraction
        const { TaskExtractor } = await import('@/lib/tasks/task-extractor')
        const extractedPlan = TaskExtractor.extractFromText(response, {
          workflow_phase: phaseNumber,
          session_id: this.sessionId
        })
        
        if (extractedPlan.tasks.length > 0 || extractedPlan.sprints.length > 0 || extractedPlan.milestones.length > 0) {
          await this.storeArtifacts(agentName, 'task', extractedPlan)
        }
        
      } else if (phaseNumber === 4) {
        // Code generation and development artifacts
        const generatedFiles = this.extractGeneratedFiles(response)
        
        if (generatedFiles.length > 0) {
          // Process code generation with PRIA compliance checking
          const { IterativeDevelopmentManager } = await import('@/lib/development/iterative-development-manager')
          
          // Get workspace_id from session for development manager
          const supabase = await createServerClient()
          const { data: session } = await supabase
            .from('sessions')
            .select('workspace_id')
            .eq('id', this.sessionId)
            .single()
          
          if (session?.workspace_id) {
            const devManager = new IterativeDevelopmentManager(this.sessionId, session.workspace_id)
            
            // Initialize development session if not exists
            let devSession = await devManager.getDevelopmentSession()
            if (!devSession) {
              devSession = await devManager.initializeDevelopmentSession()
            }
            
            // Start a new iteration for this code generation
            const iteration = await devManager.startDevelopmentIteration(
              'subagent-generated',
              `Code generation by ${agentName}`,
              'Subagent generated code requiring compliance validation'
            )
            
            // Process the generated files with compliance checking
            const processResult = await devManager.processCodeGeneration(
              iteration.id,
              generatedFiles
            )
            
            // Store development artifacts
            await this.storeArtifacts(agentName, 'code', {
              files: generatedFiles,
              compliance_report: processResult.compliance_report,
              iteration_id: iteration.id,
              critical_issues: processResult.critical_issues,
              recommendations: processResult.recommendations
            })
            
            console.log(`[SUBAGENT] Phase 4 processed ${generatedFiles.length} files with compliance score: ${processResult.compliance_report.score}`)
          }
        }
        
      } else if (phaseNumber === 5) {
        // Testing phase - test generation and execution
        const testingSuggestions = this.extractTestingSuggestions(response)
        
        if (testingSuggestions.length > 0) {
          // Process testing recommendations with TestGenerator
          const { TestGenerator } = await import('@/lib/testing/test-generator')
          
          // Get project files and requirements for test generation
          const supabase = await createServerClient()
          const { data: session } = await supabase
            .from('sessions')
            .select('workspace_id')
            .eq('id', this.sessionId)
            .single()
            
          if (session?.workspace_id) {
            // Get generated files for test context
            const { data: generatedFiles } = await supabase
              .from('generated_files')
              .select('*')
              .eq('session_id', this.sessionId)
              .eq('workspace_id', session.workspace_id)
            
            // Get requirements for test context
            const { data: requirements } = await supabase
              .from('requirements')
              .select('*')
              .eq('session_id', this.sessionId)
              .eq('workspace_id', session.workspace_id)
            
            // Generate test configuration based on agent recommendations
            const testConfig = {
              include_unit_tests: true,
              include_integration_tests: true,
              include_e2e_tests: true,
              test_frameworks: ['vitest', 'playwright'],
              coverage_threshold: 80,
              mock_external_dependencies: true,
              generate_test_data: true,
              include_error_cases: true,
              include_edge_cases: true,
              pria_compliance_tests: true
            }
            
            // Generate test suites based on agent's analysis
            try {
              const testSuites = await TestGenerator.generateTestSuites(
                generatedFiles || [],
                requirements || [],
                testConfig
              )
              
              // Store testing artifacts
              await this.storeArtifacts(agentName, 'test', {
                test_suites: testSuites,
                test_config: testConfig,
                recommendations: testingSuggestions,
                coverage_target: testConfig.coverage_threshold,
                frameworks: testConfig.test_frameworks
              })
              
              console.log(`[SUBAGENT] Phase 5 generated ${testSuites.length} test suites with ${testSuites.reduce((sum, s) => sum + s.test_cases.length, 0)} total test cases`)
              
            } catch (testGenError) {
              console.error(`[SUBAGENT] Phase 5 test generation failed:`, testGenError)
              // Store error information as artifact
              await this.storeArtifacts(agentName, 'test', {
                error: testGenError instanceof Error ? testGenError.message : 'Unknown test generation error',
                recommendations: testingSuggestions,
                status: 'failed'
              })
            }
          }
        }
        
      } else if (phaseNumber === 6) {
        // Validation phase - security audit, code review, and deployment readiness
        const validationRecommendations = this.extractValidationRecommendations(response)
        
        if (validationRecommendations.length > 0 || response.includes('security') || response.includes('audit') || response.includes('deploy')) {
          // Process validation recommendations with comprehensive audit systems
          const supabase = await createServerClient()
          const { data: session } = await supabase
            .from('sessions')
            .select('workspace_id')
            .eq('id', this.sessionId)
            .single()
            
          if (session?.workspace_id) {
            try {
              // 1. Security Audit
              const { SecurityAuditor } = await import('@/lib/validation/security-auditor')
              const securityConfig = {
                include_static_analysis: true,
                include_dependency_scan: true,
                include_configuration_audit: true,
                include_pria_compliance: true,
                include_owasp_top10: true,
                include_cwe_scanning: true,
                severity_threshold: 'info' as const,
                scan_depth: 'comprehensive' as const,
                custom_rules: [],
                exclude_patterns: [],
                false_positive_tolerance: 'balanced' as const
              }
              
              const securityReport = await SecurityAuditor.performSecurityAudit(
                this.sessionId,
                session.workspace_id,
                securityConfig
              )
              
              // 2. Code Review
              const { CodeReviewer } = await import('@/lib/validation/code-reviewer')
              const codeReviewConfig = {
                include_complexity_analysis: true,
                include_maintainability_check: true,
                include_performance_analysis: true,
                include_best_practices_check: true,
                include_pria_compliance_check: true,
                include_documentation_check: true,
                severity_threshold: 'info' as const,
                analysis_depth: 'comprehensive' as const,
                custom_rules: [],
                exclude_patterns: []
              }
              
              const codeReviewReport = await CodeReviewer.performCodeReview(
                this.sessionId,
                session.workspace_id,
                codeReviewConfig
              )
              
              // 3. Deployment Readiness Check
              const { DeploymentReadinessChecker } = await import('@/lib/validation/deployment-readiness')
              const deploymentConfig = {
                target_environment: 'production' as const,
                skip_non_critical_checks: false,
                include_performance_validation: true,
                include_security_validation: true,
                include_compliance_validation: true,
                include_dependency_audit: true,
                custom_checks: [],
                deployment_strategy: 'blue_green' as const,
                rollback_strategy: 'automatic' as const,
                monitoring_requirements: ['APM', 'Error Tracking', 'Health Checks']
              }
              
              const deploymentReport = await DeploymentReadinessChecker.performReadinessCheck(
                this.sessionId,
                session.workspace_id,
                deploymentConfig,
                securityReport,
                codeReviewReport
              )
              
              // Store validation artifacts
              await this.storeArtifacts(agentName, 'validation', {
                security_audit: {
                  report_id: securityReport.id,
                  status: securityReport.status,
                  compliance_score: securityReport.compliance_status.compliance_score,
                  critical_issues: securityReport.summary.critical_issues,
                  high_issues: securityReport.summary.high_issues,
                  pria_compliant: securityReport.compliance_status.pria_compliant,
                  deployment_ready: securityReport.deployment_readiness.ready_for_deployment
                },
                code_review: {
                  report_id: codeReviewReport.id,
                  status: codeReviewReport.status,
                  quality_grade: codeReviewReport.overall_quality.grade,
                  maintainability_score: codeReviewReport.metrics.maintainability_index,
                  technical_debt_hours: codeReviewReport.metrics.debt_time_estimate_hours,
                  blocker_issues: codeReviewReport.summary.blocker_issues
                },
                deployment_readiness: {
                  report_id: deploymentReport.id,
                  status: deploymentReport.status,
                  readiness_score: deploymentReport.overall_readiness.readiness_score,
                  ready_for_deployment: deploymentReport.overall_readiness.ready_for_deployment,
                  deployment_risk: deploymentReport.overall_readiness.deployment_risk,
                  blocking_issues: deploymentReport.checks.filter(c => c.blocking && c.status === 'fail').length
                },
                overall_validation: {
                  all_audits_passed: securityReport.status === 'completed' && 
                                    codeReviewReport.status === 'completed' && 
                                    deploymentReport.status === 'completed',
                  deployment_approved: deploymentReport.overall_readiness.ready_for_deployment && 
                                      securityReport.deployment_readiness.ready_for_deployment,
                  final_score: Math.round((
                    securityReport.compliance_status.compliance_score +
                    codeReviewReport.metrics.maintainability_index +
                    deploymentReport.overall_readiness.readiness_score
                  ) / 3),
                  recommendations: validationRecommendations
                }
              })
              
              console.log(`[SUBAGENT] Phase 6 completed comprehensive validation:`)
              console.log(`  - Security: ${securityReport.compliance_status.compliance_score}% (${securityReport.summary.critical_issues} critical issues)`)
              console.log(`  - Code Quality: ${codeReviewReport.overall_quality.grade} (${codeReviewReport.summary.blocker_issues} blockers)`)
              console.log(`  - Deployment: ${deploymentReport.overall_readiness.readiness_score}% ready (${deploymentReport.overall_readiness.deployment_risk} risk)`)
              
            } catch (validationError) {
              console.error(`[SUBAGENT] Phase 6 validation failed:`, validationError)
              // Store error information as artifact
              await this.storeArtifacts(agentName, 'validation', {
                error: validationError instanceof Error ? validationError.message : 'Unknown validation error',
                recommendations: validationRecommendations,
                status: 'failed',
                validation_type: 'comprehensive'
              })
            }
          }
        }
      }
      
      console.log(`[SUBAGENT] Extracted ${extractedData.length} artifacts for ${agentName}`)
      
    } catch (error) {
      console.error(`[SUBAGENT] Artifact extraction failed for ${agentName}:`, error)
    }
  }

  /**
   * Extract generated files from subagent response
   */
  private extractGeneratedFiles(response: string): Array<{
    path: string
    content: string
    type: 'component' | 'api' | 'type' | 'util' | 'test' | 'documentation'
    created_at: string
    updated_at: string
  }> {
    const files: Array<{
      path: string
      content: string
      type: 'component' | 'api' | 'type' | 'util' | 'test' | 'documentation'
      created_at: string
      updated_at: string
    }> = []
    
    // Pattern to match code blocks with file paths
    const codeBlockPattern = /```(?:typescript|javascript|tsx|jsx|ts|js|sql|yaml|json|md|html|css)\s*(?:\/\/\s*)?(.+?)(?:\n|$)(.*?)```/gs
    
    let match
    while ((match = codeBlockPattern.exec(response)) !== null) {
      const filePath = match[1]?.trim()
      const content = match[2]?.trim()
      
      if (filePath && content && filePath.length > 0 && content.length > 10) {
        // Determine file type based on path
        let fileType: 'component' | 'api' | 'type' | 'util' | 'test' | 'documentation' = 'component'
        
        if (filePath.includes('/api/') || filePath.includes('route.ts') || filePath.includes('actions.ts')) {
          fileType = 'api'
        } else if (filePath.includes('.d.ts') || filePath.includes('types.ts') || filePath.includes('interfaces.ts')) {
          fileType = 'type'
        } else if (filePath.includes('lib/') || filePath.includes('utils/') || filePath.includes('helpers/')) {
          fileType = 'util'
        } else if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('test/')) {
          fileType = 'test'
        } else if (filePath.includes('.md') || filePath.includes('README') || filePath.includes('docs/')) {
          fileType = 'documentation'
        }
        
        files.push({
          path: filePath,
          content,
          type: fileType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }
    
    // Also try to extract files from structured formats
    const structuredPattern = /File:\s*([^\n]+)\n```(?:typescript|javascript|tsx|jsx|ts|js|sql|yaml|json|md|html|css)?\n(.*?)```/gs
    while ((match = structuredPattern.exec(response)) !== null) {
      const filePath = match[1]?.trim()
      const content = match[2]?.trim()
      
      if (filePath && content && !files.find(f => f.path === filePath)) {
        let fileType: 'component' | 'api' | 'type' | 'util' | 'test' | 'documentation' = 'component'
        
        if (filePath.includes('/api/') || filePath.includes('route.ts')) {
          fileType = 'api'
        } else if (filePath.includes('.d.ts') || filePath.includes('types.ts')) {
          fileType = 'type'
        } else if (filePath.includes('lib/') || filePath.includes('utils/')) {
          fileType = 'util'
        } else if (filePath.includes('.test.') || filePath.includes('.spec.')) {
          fileType = 'test'
        } else if (filePath.includes('.md') || filePath.includes('README')) {
          fileType = 'documentation'
        }
        
        files.push({
          path: filePath,
          content,
          type: fileType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }
    
    return files
  }

  /**
   * Extract validation recommendations from security auditor response
   */
  private extractValidationRecommendations(response: string): Array<{
    validation_type: 'security' | 'code_review' | 'deployment' | 'compliance' | 'performance'
    category: string
    description: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    action_required: boolean
    estimated_effort: string
  }> {
    const recommendations: Array<{
      validation_type: 'security' | 'code_review' | 'deployment' | 'compliance' | 'performance'
      category: string
      description: string
      priority: 'critical' | 'high' | 'medium' | 'low'
      action_required: boolean
      estimated_effort: string
    }> = []

    // Pattern to match validation recommendations
    const validationPatterns = [
      // Security validation recommendations
      /(?:security|secure|vulnerability|audit)[^.]*?(?:should|must|need|require)[^.]*?([^.]+)/gi,
      // Code review recommendations
      /(?:code quality|review|refactor|improve)[^.]*?(?:should|must|need|require)[^.]*?([^.]+)/gi,
      // Deployment readiness recommendations
      /(?:deploy|deployment|production|release)[^.]*?(?:should|must|need|require)[^.]*?([^.]+)/gi,
      // Compliance recommendations
      /(?:compliance|pria|standard|requirement)[^.]*?(?:should|must|need|require)[^.]*?([^.]+)/gi
    ]

    validationPatterns.forEach((pattern, index) => {
      let match
      while ((match = pattern.exec(response)) !== null) {
        const description = match[1]?.trim()
        if (description && description.length > 0) {
          const validationType = index === 0 ? 'security' : 
                                index === 1 ? 'code_review' : 
                                index === 2 ? 'deployment' : 'compliance'
          
          // Determine priority based on keywords
          let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
          if (description.toLowerCase().includes('critical') || description.toLowerCase().includes('must')) {
            priority = 'critical'
          } else if (description.toLowerCase().includes('important') || description.toLowerCase().includes('should')) {
            priority = 'high'
          } else if (description.toLowerCase().includes('consider') || description.toLowerCase().includes('could')) {
            priority = 'low'
          }
          
          recommendations.push({
            validation_type: validationType,
            category: validationType.replace('_', ' '),
            description: description,
            priority: priority,
            action_required: priority === 'critical' || priority === 'high',
            estimated_effort: priority === 'critical' ? '1-2 hours' : 
                             priority === 'high' ? '2-4 hours' : 
                             priority === 'medium' ? '4-8 hours' : '1-2 days'
          })
        }
      }
    })

    // Extract explicit validation suggestions
    const validationSuggestionPattern = /(?:validate|check|verify|ensure|confirm)\\s*:?\\s*([^.\\n]+)/gi
    let match
    while ((match = validationSuggestionPattern.exec(response)) !== null) {
      const suggestion = match[1]?.trim()
      if (suggestion && suggestion.length > 0) {
        recommendations.push({
          validation_type: 'compliance',
          category: 'General Validation',
          description: suggestion,
          priority: 'medium',
          action_required: true,
          estimated_effort: '2-4 hours'
        })
      }
    }

    return recommendations
  }

  /**
   * Extract testing suggestions and recommendations from QA engineer response
   */
  private extractTestingSuggestions(response: string): Array<{
    test_type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security'
    component: string
    description: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    framework: string
    test_cases: string[]
  }> {
    const suggestions: Array<{
      test_type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security'
      component: string
      description: string
      priority: 'critical' | 'high' | 'medium' | 'low'
      framework: string
      test_cases: string[]
    }> = []

    // Pattern to match testing recommendations
    const testingPatterns = [
      // Unit test recommendations
      /(?:unit test|test.*component|component.*test)[^.]*?(?:for|of)\s+([^\n]+)/gi,
      // Integration test recommendations  
      /(?:integration test|api test|endpoint test)[^.]*?(?:for|of)\s+([^\n]+)/gi,
      // E2E test recommendations
      /(?:e2e test|end.to.end|user journey|scenario)[^.]*?(?:for|of)\s+([^\n]+)/gi,
      // Security test recommendations
      /(?:security test|auth test|permission test)[^.]*?(?:for|of)\s+([^\n]+)/gi
    ]

    testingPatterns.forEach((pattern, index) => {
      let match
      while ((match = pattern.exec(response)) !== null) {
        const component = match[1]?.trim()
        if (component && component.length > 0) {
          const testType = index === 0 ? 'unit' : 
                          index === 1 ? 'integration' : 
                          index === 2 ? 'e2e' : 'security'
          
          suggestions.push({
            test_type: testType,
            component: component,
            description: `${testType} testing for ${component}`,
            priority: testType === 'security' ? 'critical' : 
                     testType === 'integration' ? 'high' : 'medium',
            framework: testType === 'e2e' ? 'playwright' : 'vitest',
            test_cases: []
          })
        }
      }
    })

    // Extract explicit test case suggestions
    const testCasePattern = /(?:test case|should test|verify that|ensure that)\s*:?\s*([^.\n]+)/gi
    let match
    while ((match = testCasePattern.exec(response)) !== null) {
      const testCase = match[1]?.trim()
      if (testCase && testCase.length > 0) {
        // Try to associate with the last suggestion or create a general one
        if (suggestions.length > 0) {
          suggestions[suggestions.length - 1].test_cases.push(testCase)
        } else {
          suggestions.push({
            test_type: 'unit',
            component: 'General',
            description: 'General test recommendation',
            priority: 'medium',
            framework: 'vitest',
            test_cases: [testCase]
          })
        }
      }
    }

    return suggestions
  }

  /**
   * Store artifacts in the database
   */
  private async storeArtifacts(
    agentName: string,
    artifactType: string,
    artifacts: any[]
  ): Promise<void> {
    
    try {
      const supabase = await createServerClient()
      
      // Get workspace_id from session
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()
      
      if (!session) {
        throw new Error('Session not found')
      }
      
      const currentPhase = await this.getCurrentPhase()
      const artifactRecords = artifacts.map(artifact => ({
        workspace_id: session.workspace_id,
        session_id: this.sessionId,
        source_agent: agentName,
        artifact_type: artifactType,
        artifact_data: artifact,
        reference_key: `${agentName}-${artifactType}-${Date.now()}`,
        metadata: {
          phase: currentPhase?.number,
          extraction_time: new Date().toISOString(),
          confidence: artifact.metadata?.confidence || 0.8
        }
      }))
      
      const { error } = await supabase
        .from('subagent_artifacts')
        .insert(artifactRecords)
      
      if (error) {
        console.error('[SUBAGENT] Failed to store artifacts:', error)
      } else {
        console.log(`[SUBAGENT] Stored ${artifactRecords.length} artifacts for ${agentName}`)
      }
      
    } catch (error) {
      console.error('[SUBAGENT] Artifact storage error:', error)
    }
  }

  /**
   * Get all artifacts for a specific agent
   */
  async getAgentArtifacts(agentName: string, artifactType?: string): Promise<SubagentArtifact[]> {
    try {
      const supabase = await createServerClient()
      
      let query = supabase
        .from('subagent_artifacts')
        .select('*')
        .eq('session_id', this.sessionId)
        .eq('source_agent', agentName)
        .order('created_at', { ascending: false })
      
      if (artifactType) {
        query = query.eq('artifact_type', artifactType)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error(`[SUBAGENT] Failed to get artifacts for ${agentName}:`, error)
        return []
      }
      
      return (data || []).map(record => ({
        type: record.artifact_type as any,
        content: record.artifact_data,
        metadata: {
          phase: record.metadata?.phase || 0,
          agent: record.source_agent,
          confidence: record.metadata?.confidence,
          references: record.metadata?.references
        }
      }))
      
    } catch (error) {
      console.error(`[SUBAGENT] Error getting artifacts for ${agentName}:`, error)
      return []
    }
  }

  /**
   * Get cross-phase artifact summary for coordination
   */
  async getArtifactSummary(): Promise<Record<string, number>> {
    try {
      const supabase = await createServerClient()
      
      const { data, error } = await supabase
        .from('subagent_artifacts')
        .select('source_agent, artifact_type')
        .eq('session_id', this.sessionId)
      
      if (error) {
        console.error('[SUBAGENT] Failed to get artifact summary:', error)
        return {}
      }
      
      const summary: Record<string, number> = {}
      data?.forEach(record => {
        const key = `${record.source_agent}:${record.artifact_type}`
        summary[key] = (summary[key] || 0) + 1
      })
      
      return summary
      
    } catch (error) {
      console.error('[SUBAGENT] Error getting artifact summary:', error)
      return {}
    }
  }

  // Parallel Processing Methods

  /**
   * Create and execute parallel batch for current phase
   */
  async executeParallelPhase(
    userPrompt: string,
    phaseNumber?: number,
    concurrencyConfig?: any
  ): Promise<string> {
    try {
      const currentPhase = await this.getCurrentPhase()
      const phase = phaseNumber || currentPhase?.number || 1

      console.log(`[PARALLEL] Creating parallel batch for phase ${phase}`)

      // Get workspace_id from session
      const supabase = await createServerClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()

      if (!session?.workspace_id) {
        throw new Error('Workspace ID not found')
      }

      // Create optimized task set for the phase
      const tasks = await this.parallelProcessor.createOptimizedTaskSet(
        this.sessionId,
        session.workspace_id,
        phase,
        userPrompt
      )

      // Create and execute parallel batch
      const batch = await this.parallelProcessor.createParallelBatch(
        this.sessionId,
        session.workspace_id,
        phase,
        tasks
      )

      // Start execution with default config
      const config = {
        maxConcurrentTasks: 3,
        timeoutMs: 300000,
        retryAttempts: 2,
        enableLoadBalancing: true,
        priorityBased: true,
        ...concurrencyConfig
      }

      // Execute in background
      this.parallelProcessor.executeParallelBatch(batch.id, config)
        .catch(error => {
          console.error(`[PARALLEL] Batch execution failed for ${batch.id}:`, error)
        })

      return `Started parallel processing batch ${batch.id} with ${tasks.length} tasks for phase ${phase}`

    } catch (error) {
      console.error('[PARALLEL] Failed to execute parallel phase:', error)
      return `Parallel processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  /**
   * Create cross-cutting concerns batch (security, quality monitoring)
   */
  async executeCrossCuttingTasks(userPrompt: string): Promise<string> {
    try {
      console.log('[PARALLEL] Creating cross-cutting tasks batch')

      // Get workspace_id from session
      const supabase = await createServerClient()
      const { data: session } = await supabase
        .from('sessions')
        .select('workspace_id')
        .eq('id', this.sessionId)
        .single()

      if (!session?.workspace_id) {
        throw new Error('Workspace ID not found')
      }

      // Create cross-cutting tasks
      const tasks = await this.parallelProcessor.createCrossCuttingTasks(
        this.sessionId,
        session.workspace_id,
        userPrompt
      )

      // Create and execute parallel batch
      const batch = await this.parallelProcessor.createParallelBatch(
        this.sessionId,
        session.workspace_id,
        0, // Cross-cutting phase
        tasks
      )

      // Execute with lower concurrency for background tasks
      const config = {
        maxConcurrentTasks: 2,
        timeoutMs: 600000, // 10 minutes for background tasks
        retryAttempts: 1,
        enableLoadBalancing: true,
        priorityBased: false
      }

      // Execute in background
      this.parallelProcessor.executeParallelBatch(batch.id, config)
        .catch(error => {
          console.error(`[PARALLEL] Cross-cutting batch execution failed for ${batch.id}:`, error)
        })

      return `Started cross-cutting tasks batch ${batch.id} with ${tasks.length} background tasks`

    } catch (error) {
      console.error('[PARALLEL] Failed to execute cross-cutting tasks:', error)
      return `Cross-cutting tasks failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  /**
   * Get parallel processor instance for external access
   */
  getParallelProcessor(): ParallelProcessor {
    return this.parallelProcessor
  }

  /**
   * Execute subagent with parallel processing awareness
   * This method can be called by ParallelProcessor for individual task execution
   */
  async executeSubagent(
    agentName: string,
    prompt: string,
    context: any,
    options?: SubagentOptions
  ): Promise<SubagentResult> {
    console.log(`[PARALLEL-SUBAGENT] Executing ${agentName} with parallel processing context`)

    try {
      // Get subagent configuration from registry
      const agentConfig = SubagentRegistryManager.getSubagent(agentName)
      if (!agentConfig) {
        throw new Error(`Subagent ${agentName} not found in registry`)
      }

      // Build enhanced prompt with parallel processing context
      const enhancedPrompt = await this.buildParallelProcessingPrompt(
        agentConfig,
        prompt,
        context
      )

      // Execute subagent using enhanced Claude Code SDK integration
      const startTime = Date.now()
      
      // Simulate Claude Code SDK execution with parallel processing awareness
      const result = await this.simulateClaudeCodeExecution(
        agentConfig,
        enhancedPrompt,
        {
          ...options,
          preserveContext: true,
          parallelAware: true
        }
      )
      
      const duration = Date.now() - startTime

      // Process and extract artifacts
      await this.postProcessSubagentResult(agentName, context.currentPhase, result)

      return {
        response: result.response,
        context: result.context,
        artifacts: result.artifacts,
        duration,
        success: true
      }

    } catch (error) {
      console.error(`[PARALLEL-SUBAGENT] Execution failed for ${agentName}:`, error)
      return {
        response: `Parallel subagent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: {},
        artifacts: [],
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Build enhanced prompt with parallel processing context
   */
  private async buildParallelProcessingPrompt(
    agentConfig: any,
    prompt: string,
    context: any
  ): Promise<string> {
    let enhancedPrompt = agentConfig.systemPrompt + '\n\n'

    // Add phase-specific context
    if (agentConfig.contextPrompts?.phase_entry) {
      enhancedPrompt += agentConfig.contextPrompts.phase_entry + '\n\n'
    }

    // Add parallel processing awareness
    enhancedPrompt += `PARALLEL PROCESSING CONTEXT:
- This task is being executed as part of a parallel processing batch
- Other subagents may be working concurrently on related tasks
- Coordinate with other agents using @agent-name artifact references
- Focus on your specific responsibilities while being aware of concurrent work
- Ensure thread-safe operations and avoid resource conflicts

`

    // Add artifact references if available
    if (context.artifactReferences && context.artifactReferences.length > 0) {
      const resolvedReferences = await ArtifactReferenceSystem.resolveArtifactReferences(
        this.sessionId,
        context.workspaceId,
        context.artifactReferences,
        context.currentPhase
      )

      if (resolvedReferences.resolved_artifacts.length > 0) {
        enhancedPrompt += 'AVAILABLE ARTIFACT CONTEXT:\n'
        resolvedReferences.resolved_artifacts.forEach(artifact => {
          enhancedPrompt += `- ${artifact.reference_key}: ${artifact.summary}\n`
        })
        enhancedPrompt += '\n'
      }
    }

    // Add cross-phase collaboration context
    if (agentConfig.contextPrompts?.cross_phase_collaboration) {
      enhancedPrompt += agentConfig.contextPrompts.cross_phase_collaboration + '\n\n'
    }

    // Add the actual user prompt
    enhancedPrompt += `USER REQUEST:\n${prompt}\n\n`

    // Add parallel processing guidelines
    enhancedPrompt += `PARALLEL PROCESSING GUIDELINES:
1. Work efficiently within your designated responsibilities
2. Reference artifacts from other agents using @agent-name:artifact-type syntax
3. Generate artifacts that can be consumed by dependent agents
4. Handle potential race conditions and resource conflicts gracefully
5. Provide clear status updates and error handling
6. Coordinate with concurrent agents when necessary

Please proceed with the task, keeping parallel processing context in mind.`

    return enhancedPrompt
  }

  /**
   * Simulate Claude Code SDK execution (to be replaced with actual SDK integration)
   */
  private async simulateClaudeCodeExecution(
    agentConfig: any,
    prompt: string,
    options: any
  ): Promise<any> {
    // This is a placeholder for the actual Claude Code SDK integration
    // In production, this would call the Claude Code SDK with the enhanced prompt
    
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)) // Simulate processing time

    const response = `[${agentConfig.name}] Parallel processing execution completed.

Processing user request with parallel processing awareness...

Generated artifacts and recommendations based on:
- Phase ${options.currentPhase || 'unknown'} requirements
- Parallel processing context
- Cross-agent coordination needs
- Available artifact references

Results have been optimized for concurrent execution and agent coordination.`

    return {
      response,
      context: { parallel_execution: true, agent: agentConfig.name },
      artifacts: [
        {
          type: 'parallel_result',
          content: { status: 'completed', agent: agentConfig.name },
          metadata: { phase: options.currentPhase, parallel: true }
        }
      ]
    }
  }
}