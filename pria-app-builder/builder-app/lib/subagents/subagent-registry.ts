/**
 * Subagent Registry - Central management and configuration for all PRIA subagents
 * Provides unified access to specialized agents across the 7-phase workflow
 */

import { SubagentConfig, SubagentCapabilities, SubagentRegistry, PhaseAgentMapping } from './types'
import { QA_ENGINEER_SUBAGENT, QA_ENGINEER_CAPABILITIES } from './qa-engineer-subagent'
import { SECURITY_AUDITOR_SUBAGENT, SECURITY_AUDITOR_CAPABILITIES } from './security-auditor-subagent'
import { COMPONENT_RESEARCHER_SUBAGENT, COMPONENT_RESEARCHER_CAPABILITIES } from './component-researcher-subagent'
import { INTEGRATION_EXPERT_SUBAGENT, INTEGRATION_EXPERT_CAPABILITIES } from './integration-expert-subagent'

// Core subagent configurations
const REQUIREMENTS_ANALYST_SUBAGENT: SubagentConfig = {
  name: 'requirements-analyst',
  description: 'Specialized requirements analyst focused on comprehensive requirements gathering and user story creation',
  phase: 1,
  capabilities: [
    'requirements_elicitation',
    'user_story_creation',
    'acceptance_criteria_definition',
    'stakeholder_analysis',
    'requirements_validation',
    'requirements_traceability'
  ],
  tools: ['write-file', 'read-file', 'artifact-reference', 'stakeholder-interview'],
  systemPrompt: `You are a specialized Requirements Analyst subagent within the PRIA App Builder system. Your role is to gather, analyze, and document comprehensive requirements for application development.

Focus on:
- Eliciting detailed functional and non-functional requirements
- Creating comprehensive user stories with acceptance criteria
- Ensuring requirements traceability and validation
- Identifying stakeholder needs and constraints
- Establishing quality gates for requirement completion

Generate artifacts in structured formats that can be referenced by other phases using @requirements-analyst syntax.`,
  contextPrompts: {
    phase_entry: 'You are entering Phase 1 (Requirements Gathering). Focus on comprehensive discovery and documentation of all application requirements.',
    cross_phase_collaboration: 'Your requirements will be referenced by @system-architect for technical design and @project-planner for implementation planning.'
  },
  validationRules: [
    'All requirements must include acceptance criteria',
    'User stories must follow standard format (As a... I want... So that...)',
    'Requirements must be testable and measurable'
  ],
  outputFormats: ['requirement', 'user_story', 'acceptance_criteria']
}

const SYSTEM_ARCHITECT_SUBAGENT: SubagentConfig = {
  name: 'system-architect',
  description: 'Specialized system architect focused on technical design and architecture decisions',
  phase: 2,
  capabilities: [
    'system_design',
    'architecture_planning',
    'technology_selection',
    'api_design',
    'database_design',
    'security_architecture'
  ],
  tools: ['write-file', 'read-file', 'artifact-reference', 'architecture-modeling'],
  systemPrompt: `You are a specialized System Architect subagent within the PRIA App Builder system. Your role is to create comprehensive technical specifications and architecture designs.

Focus on:
- Designing scalable and maintainable system architecture
- Creating detailed API specifications
- Planning database schema with PRIA compliance (workspace isolation, RLS)
- Making technology stack decisions
- Ensuring security and performance considerations

Reference @requirements-analyst artifacts to understand functional needs and generate technical specifications for @code-generator implementation.`,
  contextPrompts: {
    phase_entry: 'You are entering Phase 2 (Architecture & Technical Design). Create comprehensive technical specifications based on gathered requirements.',
    cross_phase_collaboration: 'Reference @requirements-analyst requirements and generate specifications for @code-generator implementation.'
  },
  validationRules: [
    'All database designs must include workspace_id for multi-tenancy',
    'API specifications must include authentication and authorization',
    'Architecture must follow PRIA compliance requirements'
  ],
  outputFormats: ['specification', 'architecture', 'api_spec', 'design_decision']
}

const PROJECT_PLANNER_SUBAGENT: SubagentConfig = {
  name: 'project-planner',
  description: 'Specialized project planner focused on implementation planning and task management',
  phase: 3,
  capabilities: [
    'task_breakdown',
    'sprint_planning',
    'dependency_mapping',
    'milestone_planning',
    'resource_allocation',
    'timeline_estimation'
  ],
  tools: ['write-file', 'read-file', 'artifact-reference', 'project-planning'],
  systemPrompt: `You are a specialized Project Planner subagent within the PRIA App Builder system. Your role is to create comprehensive implementation plans and task breakdowns.

Focus on:
- Breaking down requirements and specifications into actionable tasks
- Creating sprint plans with proper dependency mapping
- Estimating effort and timeline for implementation
- Identifying critical path and potential blockers
- Planning testing and validation activities

Reference @requirements-analyst and @system-architect artifacts to create detailed implementation roadmaps for @code-generator execution.`,
  contextPrompts: {
    phase_entry: 'You are entering Phase 3 (Implementation Planning). Create detailed task breakdowns and sprint plans.',
    cross_phase_collaboration: 'Reference @requirements-analyst and @system-architect to plan implementation tasks for @code-generator.'
  },
  validationRules: [
    'All tasks must include effort estimates and dependencies',
    'Sprint plans must align with project timeline',
    'Critical path must be identified and documented'
  ],
  outputFormats: ['task', 'sprint', 'milestone', 'dependency_map']
}

const CODE_GENERATOR_SUBAGENT: SubagentConfig = {
  name: 'code-generator',
  description: 'Specialized code generator focused on PRIA-compliant application development',
  phase: 4,
  capabilities: [
    'code_generation',
    'component_development',
    'api_implementation',
    'database_integration',
    'pria_compliance',
    'testing_preparation'
  ],
  tools: ['write-file', 'read-file', 'artifact-reference', 'code-generation', 'pria-validation'],
  systemPrompt: `You are a specialized Code Generator subagent within the PRIA App Builder system. Your role is to generate production-ready, PRIA-compliant application code.

Focus on:
- Generating complete Next.js applications with PRIA compliance
- Implementing proper workspace isolation and authentication
- Creating reusable components and API endpoints
- Ensuring database queries include workspace_id filtering
- Following security best practices and coding standards

Reference @requirements-analyst, @system-architect, and @project-planner artifacts to implement comprehensive applications for @qa-engineer testing.`,
  contextPrompts: {
    phase_entry: 'You are entering Phase 4 (Development & Implementation). Generate production-ready, PRIA-compliant code.',
    cross_phase_collaboration: 'Reference previous phase artifacts and generate code for @qa-engineer testing validation.'
  },
  validationRules: [
    'All database queries must include workspace_id filtering',
    'Authentication must be implemented using Supabase Auth',
    'Components must be production-ready with error handling'
  ],
  outputFormats: ['component', 'api', 'util', 'type', 'documentation']
}

// Registry of all available subagents
export const SUBAGENT_REGISTRY: SubagentRegistry = {
  'requirements-analyst': REQUIREMENTS_ANALYST_SUBAGENT,
  'system-architect': SYSTEM_ARCHITECT_SUBAGENT,
  'project-planner': PROJECT_PLANNER_SUBAGENT,
  'code-generator': CODE_GENERATOR_SUBAGENT,
  'qa-engineer': QA_ENGINEER_SUBAGENT,
  'security-auditor': SECURITY_AUDITOR_SUBAGENT,
  'component-researcher': COMPONENT_RESEARCHER_SUBAGENT,
  'integration-expert': INTEGRATION_EXPERT_SUBAGENT
}

// Capabilities registry
export const SUBAGENT_CAPABILITIES_REGISTRY: Record<string, SubagentCapabilities> = {
  'qa-engineer': QA_ENGINEER_CAPABILITIES,
  'security-auditor': SECURITY_AUDITOR_CAPABILITIES,
  'component-researcher': COMPONENT_RESEARCHER_CAPABILITIES,
  'integration-expert': INTEGRATION_EXPERT_CAPABILITIES
}

// Phase to agent mapping
export const PHASE_AGENT_MAPPING: PhaseAgentMapping = {
  1: 'requirements-analyst',
  2: 'system-architect',
  3: 'project-planner',
  4: 'code-generator',
  5: 'qa-engineer',
  6: 'security-auditor',
  7: 'devops-engineer' // To be implemented
}

/**
 * SubagentRegistryManager - Manages subagent lifecycle and coordination
 */
export class SubagentRegistryManager {
  
  /**
   * Get subagent configuration by name
   */
  static getSubagent(name: string): SubagentConfig | null {
    return SUBAGENT_REGISTRY[name] || null
  }
  
  /**
   * Get subagent for a specific phase
   */
  static getPhaseAgent(phase: number): SubagentConfig | null {
    const agentName = PHASE_AGENT_MAPPING[phase]
    return agentName ? this.getSubagent(agentName) : null
  }
  
  /**
   * Get all available subagents
   */
  static getAllSubagents(): SubagentConfig[] {
    return Object.values(SUBAGENT_REGISTRY)
  }
  
  /**
   * Get subagents by capability
   */
  static getSubagentsByCapability(capability: string): SubagentConfig[] {
    return Object.values(SUBAGENT_REGISTRY).filter(agent => 
      agent.capabilities.includes(capability)
    )
  }
  
  /**
   * Get subagent capabilities
   */
  static getSubagentCapabilities(name: string): SubagentCapabilities | null {
    return SUBAGENT_CAPABILITIES_REGISTRY[name] || null
  }
  
  /**
   * Validate subagent can perform specific action
   */
  static canPerformAction(agentName: string, action: string): boolean {
    const capabilities = this.getSubagentCapabilities(agentName)
    if (!capabilities) return false
    
    switch (action) {
      case 'generate_code':
        return capabilities.canGenerateCode
      case 'execute_tests':
        return capabilities.canExecuteTests
      case 'analyze_artifacts':
        return capabilities.canAnalyzeArtifacts
      default:
        return false
    }
  }
  
  /**
   * Get agents that can reference a specific phase
   */
  static getAgentsForPhaseReference(phase: number): SubagentConfig[] {
    return Object.values(SUBAGENT_REGISTRY).filter(agent => {
      const capabilities = this.getSubagentCapabilities(agent.name)
      return capabilities?.canReferencePhases.includes(phase) || false
    })
  }
  
  /**
   * Get artifact types an agent can produce
   */
  static getProducibleArtifacts(agentName: string): string[] {
    const capabilities = this.getSubagentCapabilities(agentName)
    return capabilities?.canProduceArtifacts || []
  }
  
  /**
   * Get artifact types an agent can consume
   */
  static getConsumableArtifacts(agentName: string): string[] {
    const capabilities = this.getSubagentCapabilities(agentName)
    return capabilities?.canConsumeArtifacts || []
  }
  
  /**
   * Validate artifact compatibility between agents
   */
  static validateArtifactCompatibility(
    producerAgent: string, 
    consumerAgent: string, 
    artifactType: string
  ): boolean {
    const canProduce = this.getProducibleArtifacts(producerAgent).includes(artifactType)
    const canConsume = this.getConsumableArtifacts(consumerAgent).includes(artifactType)
    return canProduce && canConsume
  }
  
  /**
   * Get specializations for an agent
   */
  static getAgentSpecializations(agentName: string): string[] {
    const capabilities = this.getSubagentCapabilities(agentName)
    return capabilities?.specializations || []
  }
  
  /**
   * Find agents by specialization
   */
  static findAgentsBySpecialization(specialization: string): SubagentConfig[] {
    return Object.values(SUBAGENT_REGISTRY).filter(agent => {
      const capabilities = this.getSubagentCapabilities(agent.name)
      return capabilities?.specializations.includes(specialization) || false
    })
  }
  
  /**
   * Get workflow progression for agent collaboration
   */
  static getWorkflowProgression(): { phase: number; agent: string; description: string }[] {
    return [
      { phase: 1, agent: 'requirements-analyst', description: 'Requirements gathering and user story creation' },
      { phase: 2, agent: 'system-architect', description: 'Technical specifications and architecture design' },
      { phase: 3, agent: 'project-planner', description: 'Implementation planning and task breakdown' },
      { phase: 4, agent: 'code-generator', description: 'PRIA-compliant code generation and development' },
      { phase: 5, agent: 'qa-engineer', description: 'Comprehensive testing and quality assurance' },
      { phase: 6, agent: 'security-auditor', description: 'Security validation and compliance verification' },
      { phase: 7, agent: 'devops-engineer', description: 'Deployment and infrastructure management' }
    ]
  }
  
  /**
   * Validate subagent configuration
   */
  static validateSubagentConfig(config: SubagentConfig): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Required fields validation
    if (!config.name) errors.push('Subagent name is required')
    if (!config.description) errors.push('Subagent description is required')
    if (!config.phase || config.phase < 1 || config.phase > 7) {
      errors.push('Subagent phase must be between 1 and 7')
    }
    if (!config.systemPrompt) errors.push('System prompt is required')
    
    // Capabilities validation
    if (!config.capabilities || config.capabilities.length === 0) {
      warnings.push('Subagent should have at least one capability')
    }
    
    // Tools validation
    if (!config.tools || config.tools.length === 0) {
      warnings.push('Subagent should have at least one tool')
    }
    
    // Output formats validation
    if (!config.outputFormats || config.outputFormats.length === 0) {
      warnings.push('Subagent should specify output formats')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
  
  /**
   * Get agent interaction matrix
   */
  static getAgentInteractionMatrix(): Record<string, string[]> {
    const matrix: Record<string, string[]> = {}
    
    Object.values(SUBAGENT_REGISTRY).forEach(agent => {
      const capabilities = this.getSubagentCapabilities(agent.name)
      if (capabilities) {
        matrix[agent.name] = capabilities.canReferencePhases.map(phase => 
          PHASE_AGENT_MAPPING[phase]
        ).filter(Boolean)
      }
    })
    
    return matrix
  }
}