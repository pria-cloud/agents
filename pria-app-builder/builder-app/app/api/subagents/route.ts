import { NextRequest, NextResponse } from 'next/server'
import { SubagentRegistryManager } from '@/lib/subagents/subagent-registry'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const agentName = searchParams.get('agent')
    const phase = searchParams.get('phase')
    const capability = searchParams.get('capability')
    const specialization = searchParams.get('specialization')

    switch (action) {
      case 'list':
        // Get all available subagents
        const allAgents = SubagentRegistryManager.getAllSubagents()
        return NextResponse.json({
          success: true,
          agents: allAgents.map(agent => ({
            name: agent.name,
            description: agent.description,
            phase: agent.phase,
            capabilities: agent.capabilities,
            tools: agent.tools,
            outputFormats: agent.outputFormats
          }))
        })

      case 'detail':
        // Get detailed information about a specific agent
        if (!agentName) {
          return NextResponse.json({ error: 'Agent name required for detail action' }, { status: 400 })
        }

        const agentConfig = SubagentRegistryManager.getSubagent(agentName)
        const agentCapabilities = SubagentRegistryManager.getSubagentCapabilities(agentName)

        if (!agentConfig) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          agent: {
            config: agentConfig,
            capabilities: agentCapabilities,
            specializations: SubagentRegistryManager.getAgentSpecializations(agentName),
            producibleArtifacts: SubagentRegistryManager.getProducibleArtifacts(agentName),
            consumableArtifacts: SubagentRegistryManager.getConsumableArtifacts(agentName)
          }
        })

      case 'phase':
        // Get agent for a specific phase
        if (!phase) {
          return NextResponse.json({ error: 'Phase number required for phase action' }, { status: 400 })
        }

        const phaseNumber = parseInt(phase)
        const phaseAgent = SubagentRegistryManager.getPhaseAgent(phaseNumber)

        if (!phaseAgent) {
          return NextResponse.json({ error: 'No agent found for specified phase' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          agent: {
            name: phaseAgent.name,
            description: phaseAgent.description,
            phase: phaseAgent.phase,
            capabilities: phaseAgent.capabilities
          }
        })

      case 'capability':
        // Get agents by capability
        if (!capability) {
          return NextResponse.json({ error: 'Capability required for capability action' }, { status: 400 })
        }

        const capabilityAgents = SubagentRegistryManager.getSubagentsByCapability(capability)
        return NextResponse.json({
          success: true,
          agents: capabilityAgents.map(agent => ({
            name: agent.name,
            description: agent.description,
            phase: agent.phase
          }))
        })

      case 'specialization':
        // Get agents by specialization
        if (!specialization) {
          return NextResponse.json({ error: 'Specialization required for specialization action' }, { status: 400 })
        }

        const specializationAgents = SubagentRegistryManager.findAgentsBySpecialization(specialization)
        return NextResponse.json({
          success: true,
          agents: specializationAgents.map(agent => ({
            name: agent.name,
            description: agent.description,
            phase: agent.phase
          }))
        })

      case 'workflow':
        // Get workflow progression
        const workflowProgression = SubagentRegistryManager.getWorkflowProgression()
        return NextResponse.json({
          success: true,
          workflow: workflowProgression
        })

      case 'interactions':
        // Get agent interaction matrix
        const interactionMatrix = SubagentRegistryManager.getAgentInteractionMatrix()
        return NextResponse.json({
          success: true,
          interactions: interactionMatrix
        })

      case 'validate':
        // Validate agent configuration
        if (!agentName) {
          return NextResponse.json({ error: 'Agent name required for validate action' }, { status: 400 })
        }

        const configToValidate = SubagentRegistryManager.getSubagent(agentName)
        if (!configToValidate) {
          return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
        }

        const validationResult = SubagentRegistryManager.validateSubagentConfig(configToValidate)
        return NextResponse.json({
          success: true,
          validation: validationResult
        })

      case 'stats':
        // Get subagent statistics
        const stats = {
          total_agents: SubagentRegistryManager.getAllSubagents().length,
          agents_by_phase: {} as Record<number, string>,
          capabilities_distribution: {} as Record<string, number>,
          tools_distribution: {} as Record<string, number>,
          specializations_available: [] as string[]
        }

        // Calculate statistics  
        const agents = SubagentRegistryManager.getAllSubagents()
        
        // Agents by phase
        for (let phase = 1; phase <= 7; phase++) {
          const agent = SubagentRegistryManager.getPhaseAgent(phase)
          if (agent) {
            stats.agents_by_phase[phase] = agent.name
          }
        }

        // Capabilities distribution
        agents.forEach(agent => {
          agent.capabilities.forEach(capability => {
            stats.capabilities_distribution[capability] = (stats.capabilities_distribution[capability] || 0) + 1
          })
        })

        // Tools distribution
        agents.forEach(agent => {
          agent.tools.forEach(tool => {
            stats.tools_distribution[tool] = (stats.tools_distribution[tool] || 0) + 1
          })
        })

        // All available specializations
        const allSpecializations = new Set<string>()
        agents.forEach(agent => {
          const specializations = SubagentRegistryManager.getAgentSpecializations(agent.name)
          specializations.forEach(spec => allSpecializations.add(spec))
        })
        stats.specializations_available = Array.from(allSpecializations)

        return NextResponse.json({
          success: true,
          statistics: stats
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in subagents API:', error)
    return NextResponse.json(
      { error: 'Failed to process subagents request' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, agent1, agent2, artifactType } = body

    switch (action) {
      case 'validate_compatibility':
        // Validate artifact compatibility between agents
        if (!agent1 || !agent2 || !artifactType) {
          return NextResponse.json({ 
            error: 'agent1, agent2, and artifactType required for compatibility validation' 
          }, { status: 400 })
        }

        const isCompatible = SubagentRegistryManager.validateArtifactCompatibility(
          agent1, 
          agent2, 
          artifactType
        )

        const producibleArtifacts = SubagentRegistryManager.getProducibleArtifacts(agent1)
        const consumableArtifacts = SubagentRegistryManager.getConsumableArtifacts(agent2)

        return NextResponse.json({
          success: true,
          compatibility: {
            compatible: isCompatible,
            agent1_can_produce: producibleArtifacts.includes(artifactType),
            agent2_can_consume: consumableArtifacts.includes(artifactType),
            agent1_artifacts: producibleArtifacts,
            agent2_artifacts: consumableArtifacts
          }
        })

      case 'check_action':
        // Check if agent can perform specific action
        const { agentName, actionType } = body
        
        if (!agentName || !actionType) {
          return NextResponse.json({ 
            error: 'agentName and actionType required for action check' 
          }, { status: 400 })
        }

        const canPerform = SubagentRegistryManager.canPerformAction(agentName, actionType)
        const capabilities = SubagentRegistryManager.getSubagentCapabilities(agentName)

        return NextResponse.json({
          success: true,
          action_check: {
            agent: agentName,
            action: actionType,
            can_perform: canPerform,
            capabilities: capabilities
          }
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in subagents POST API:', error)
    return NextResponse.json(
      { error: 'Failed to process subagents request' },
      { status: 500 }
    )
  }
}