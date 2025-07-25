/**
 * A2A Agent Registration for Claude Code E2B
 * Registers Claude Code E2B as a service agent within the PRIA ecosystem
 */

import { createClient } from '@supabase/supabase-js'

interface AgentCapability {
  name: string
  description: string
  input_schema: object
  output_schema: object
}

interface AgentRegistration {
  agent_name: string
  agent_type: 'service' | 'workflow' | 'data'
  capabilities: AgentCapability[]
  endpoint_url: string
  health_check_url: string
  schema_version: string
  metadata: {
    description: string
    version: string
    supported_modes: string[]
    compliance_level: string
  }
}

export class ClaudeCodeE2BAgent {
  private supabase: any
  private agentConfig: AgentRegistration

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    this.agentConfig = {
      agent_name: 'claude-code-e2b',
      agent_type: 'service',
      capabilities: [
        {
          name: 'app-generation',
          description: 'Generate complete Next.js applications following PRIA guidelines',
          input_schema: {
            type: 'object',
            properties: {
              requirements: { type: 'string' },
              mode: { type: 'string', enum: ['business', 'developer'] },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['requirements', 'mode', 'workspace_id', 'user_id']
          },
          output_schema: {
            type: 'object',
            properties: {
              session_id: { type: 'string' },
              e2b_sandbox_url: { type: 'string' },
              status: { type: 'string' },
              progress: { type: 'object' }
            }
          }
        },
        {
          name: 'code-editing',
          description: 'Interactive code editing and refinement',
          input_schema: {
            type: 'object',
            properties: {
              session_id: { type: 'string' },
              file_path: { type: 'string' },
              changes: { type: 'string' },
              workspace_id: { type: 'string' }
            },
            required: ['session_id', 'workspace_id']
          },
          output_schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              updated_files: { type: 'array' },
              validation_results: { type: 'object' }
            }
          }
        },
        {
          name: 'requirement-analysis',
          description: 'Conversational requirement gathering and specification generation',
          input_schema: {
            type: 'object',
            properties: {
              user_input: { type: 'string' },
              context: { type: 'object' },
              mode: { type: 'string', enum: ['business', 'developer'] },
              workspace_id: { type: 'string' }
            },
            required: ['user_input', 'workspace_id']
          },
          output_schema: {
            type: 'object',
            properties: {
              clarifying_questions: { type: 'array' },
              extracted_requirements: { type: 'object' },
              confidence_score: { type: 'number' },
              next_steps: { type: 'array' }
            }
          }
        },
        {
          name: 'compliance-validation',
          description: 'Validate generated code against PRIA architectural standards',
          input_schema: {
            type: 'object',
            properties: {
              files: { type: 'array' },
              validation_rules: { type: 'array' },
              workspace_id: { type: 'string' }
            },
            required: ['files', 'workspace_id']
          },
          output_schema: {
            type: 'object',
            properties: {
              is_compliant: { type: 'boolean' },
              violations: { type: 'array' },
              compliance_score: { type: 'number' },
              recommendations: { type: 'array' }
            }
          }
        },
        {
          name: 'testing-automation',
          description: 'Automated testing and quality assurance',
          input_schema: {
            type: 'object',
            properties: {
              session_id: { type: 'string' },
              test_types: { type: 'array' },
              workspace_id: { type: 'string' }
            },
            required: ['session_id', 'workspace_id']
          },
          output_schema: {
            type: 'object',
            properties: {
              test_results: { type: 'object' },
              coverage_report: { type: 'object' },
              quality_metrics: { type: 'object' }
            }
          }
        }
      ],
      endpoint_url: 'https://claude-code-e2b.agents.pria.ai',
      health_check_url: 'https://claude-code-e2b.agents.pria.ai/health',
      schema_version: '1.0.0',
      metadata: {
        description: 'AI-powered application development agent using Claude Code in E2B sandboxes',
        version: '1.0.0',
        supported_modes: ['business', 'developer'],
        compliance_level: 'enterprise'
      }
    }
  }

  /**
   * Register this agent with the PRIA A2A system
   */
  async register(): Promise<{ success: boolean; agent_id?: string; error?: string }> {
    try {
      // Check if agent is already registered
      const { data: existing } = await this.supabase
        .from('agents')
        .select('id, status')
        .eq('agent_name', this.agentConfig.agent_name)
        .single()

      if (existing) {
        // Update existing registration
        const { data, error } = await this.supabase
          .from('agents')
          .update({
            capabilities: this.agentConfig.capabilities,
            endpoint_url: this.agentConfig.endpoint_url,
            health_check_url: this.agentConfig.health_check_url,
            schema_version: this.agentConfig.schema_version,
            metadata: this.agentConfig.metadata,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) {
          throw error
        }

        return { success: true, agent_id: data.id }
      }

      // Create new registration
      const { data, error } = await this.supabase
        .from('agents')
        .insert({
          agent_name: this.agentConfig.agent_name,
          agent_type: this.agentConfig.agent_type,
          capabilities: this.agentConfig.capabilities,
          endpoint_url: this.agentConfig.endpoint_url,
          health_check_url: this.agentConfig.health_check_url,
          schema_version: this.agentConfig.schema_version,
          metadata: this.agentConfig.metadata,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      return { success: true, agent_id: data.id }

    } catch (error) {
      console.error('Agent registration failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: object }> {
    try {
      // Check database connectivity
      const { error: dbError } = await this.supabase
        .from('agents')
        .select('id')
        .eq('agent_name', this.agentConfig.agent_name)
        .single()

      if (dbError) {
        throw new Error(`Database connectivity failed: ${dbError.message}`)
      }

      // Check E2B service availability (placeholder - would check actual E2B API)
      const e2bHealthy = true // TODO: Implement actual E2B health check

      return {
        healthy: e2bHealthy,
        details: {
          database: 'connected',
          e2b_service: e2bHealthy ? 'available' : 'unavailable',
          capabilities: this.agentConfig.capabilities.length,
          version: this.agentConfig.metadata.version,
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  /**
   * Handle incoming A2A requests
   */
  async handleRequest(capability: string, input: any): Promise<any> {
    const capabilityHandler = this.getCapabilityHandler(capability)
    
    if (!capabilityHandler) {
      throw new Error(`Unsupported capability: ${capability}`)
    }

    // Validate workspace access
    if (!input.workspace_id) {
      throw new Error('Workspace ID is required')
    }

    return await capabilityHandler(input)
  }

  private getCapabilityHandler(capability: string) {
    const handlers = {
      'app-generation': this.handleAppGeneration.bind(this),
      'code-editing': this.handleCodeEditing.bind(this),
      'requirement-analysis': this.handleRequirementAnalysis.bind(this),
      'compliance-validation': this.handleComplianceValidation.bind(this),
      'testing-automation': this.handleTestingAutomation.bind(this)
    }

    return handlers[capability as keyof typeof handlers]
  }

  private async handleAppGeneration(input: any) {
    // Create new Claude session
    const { data: session, error } = await this.supabase
      .from('claude_sessions')
      .insert({
        workspace_id: input.workspace_id,
        user_id: input.user_id,
        mode: input.mode,
        status: 'discovering',
        requirements: { initial_input: input.requirements }
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // TODO: Initialize E2B sandbox
    // TODO: Start app generation process

    return {
      session_id: session.id,
      e2b_sandbox_url: null, // Will be populated when sandbox is ready
      status: 'discovering',
      progress: {
        phase: 'requirement_analysis',
        percentage: 0
      }
    }
  }

  private async handleCodeEditing(input: any) {
    // TODO: Implement code editing logic
    return {
      success: true,
      updated_files: [],
      validation_results: {}
    }
  }

  private async handleRequirementAnalysis(input: any) {
    // TODO: Implement requirement analysis logic
    return {
      clarifying_questions: [],
      extracted_requirements: {},
      confidence_score: 0.8,
      next_steps: []
    }
  }

  private async handleComplianceValidation(input: any) {
    // TODO: Implement compliance validation logic
    return {
      is_compliant: true,
      violations: [],
      compliance_score: 95,
      recommendations: []
    }
  }

  private async handleTestingAutomation(input: any) {
    // TODO: Implement testing automation logic
    return {
      test_results: {},
      coverage_report: {},
      quality_metrics: {}
    }
  }
}

// Export singleton instance
export const claudeCodeAgent = new ClaudeCodeE2BAgent()