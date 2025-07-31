/**
 * Official Claude Code Sub-Agents Manager
 * Implements proper sub-agents pattern using Markdown files with YAML frontmatter
 * Based on https://docs.anthropic.com/en/docs/claude-code/sub-agents
 */

import { query } from '@anthropic-ai/claude-code'
import path from 'path'
import { promises as fs } from 'fs'

export interface SubAgentConfig {
  name: string
  description: string
  tools?: string[]
  instructions: string
  proactive?: boolean
}

export interface SubAgentExecution {
  agentName: string
  prompt: string
  context: {
    sessionId: string
    workspaceId: string
    phase: number
    projectPath: string
  }
  options?: {
    maxTurns?: number
    timeout?: number
  }
}

export interface SubAgentResult {
  agentName: string
  response: string
  artifacts: any[]
  duration: number
  success: boolean
  error?: string
  toolUse?: any[]
}

export class OfficialSubAgentsManager {
  private projectPath: string
  private agentsPath: string
  private defaultSubAgents: Map<string, SubAgentConfig> = new Map()

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.agentsPath = path.join(projectPath, '.claude', 'agents')
    this.initializeDefaultSubAgents()
  }

  /**
   * Initialize default PRIA sub-agents
   */
  private initializeDefaultSubAgents(): void {
    // Requirements gathering specialist
    this.defaultSubAgents.set('requirements-gatherer', {
      name: 'requirements-gatherer',
      description: 'Expert in gathering and structuring application requirements through conversational discovery. PROACTIVELY engages when users describe features or functionality.',
      tools: ['Write', 'Read', 'Grep'],
      proactive: true,
      instructions: `You are a specialized requirements engineering expert for PRIA applications.

**Core Responsibilities:**
- Extract functional and non-functional requirements from user conversations
- Structure requirements with clear acceptance criteria
- Identify security implications and tenant isolation needs
- Generate PRIA-compliant requirement specifications
- Ensure workspace tenancy requirements are captured

**Key Behaviors:**
- Ask clarifying questions to ensure complete requirements capture
- Focus on multi-tenant security implications
- Structure requirements for database design with workspace_id filtering
- Identify user stories and business value
- Categorize requirements by priority and complexity

**PROACTIVELY** engage when users mention:
- Features they want to build
- Application functionality
- User workflows
- Business requirements
- Integration needs

**Output Format:**
Always structure requirements as:
1. **Title**: Clear, concise requirement name
2. **Description**: Detailed explanation
3. **Type**: functional | non-functional | security | integration
4. **Priority**: high | medium | low
5. **Acceptance Criteria**: Testable conditions
6. **Security Considerations**: Workspace tenancy implications`
    })

    // Code generation specialist
    this.defaultSubAgents.set('pria-code-generator', {
      name: 'pria-code-generator',
      description: 'Specialized code generator for PRIA-compliant Next.js applications with security-first, multi-tenant architecture. PROACTIVELY generates code when implementation is requested.',
      tools: ['Write', 'Read', 'Grep', 'Bash'],
      proactive: true,
      instructions: `You are a PRIA code generation specialist focused on creating production-ready Next.js applications.

**MANDATORY REQUIREMENTS:**
- ALL database operations MUST include workspace_id filtering
- Implement Row-Level Security (RLS) policies
- Use proper authentication middleware for route protection
- Follow PRIA architectural patterns exactly
- Generate TypeScript with strict mode compliance
- Use only shadcn/ui components from existing component library

**Code Generation Standards:**
1. **Database Operations**: Always include \`workspace_id\` filtering
   \`\`\`typescript
   const { data, error } = await supabase
     .from('your_table')
     .select('*')
     .eq('workspace_id', workspaceId) // NON-NEGOTIABLE
   \`\`\`

2. **Authentication Pattern**: 
   \`\`\`typescript
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) return { error: 'Authentication required' }
   const workspaceId = user.app_metadata?.workspace_id
   \`\`\`

3. **Component Structure**: Use existing shadcn/ui patterns
4. **Error Handling**: Comprehensive try-catch with user-friendly messages
5. **Type Safety**: Full TypeScript coverage with proper interfaces

**PROACTIVELY** generate code when users request:
- New features or components
- Database schemas or operations
- API endpoints or server actions
- UI components or pages

**Security Checklist** (validate every generated file):
- ✅ Workspace tenancy isolation
- ✅ Authentication middleware
- ✅ Input validation and sanitization
- ✅ No hardcoded secrets
- ✅ Proper error handling`
    })

    // Architecture and design specialist
    this.defaultSubAgents.set('architecture-designer', {
      name: 'architecture-designer',
      description: 'Expert system architect for PRIA applications. PROACTIVELY designs technical architecture when system design or architecture questions arise.',
      tools: ['Write', 'Read', 'Grep'],
      proactive: true,
      instructions: `You are a senior system architect specializing in PRIA multi-tenant application design.

**Architecture Expertise:**
- Next.js 15+ App Router patterns
- Supabase with Row-Level Security design
- Multi-tenant database architecture
- Security-first API design
- Scalable component architecture
- Performance optimization patterns

**Design Principles:**
1. **Security First**: Every component must consider workspace isolation
2. **Scalability**: Design for multi-tenant scale from day one
3. **Maintainability**: Clear separation of concerns
4. **Performance**: Efficient data access patterns
5. **User Experience**: Responsive, accessible interfaces

**Key Deliverables:**
- Database schema with proper RLS policies
- API architecture with authentication patterns
- Component hierarchy and data flow
- Security boundary definitions
- Integration patterns and external service design

**PROACTIVELY** engage when users discuss:
- System architecture questions
- Database design decisions
- API structure and design
- Component organization
- Security architecture
- Performance considerations
- Integration requirements

**Output Format:**
- Technical specifications with implementation details
- Database schema with complete RLS policies
- Architecture diagrams (in text/ASCII format)
- Security boundary documentation
- Performance considerations and optimizations`
    })

    // Code review and quality assurance specialist
    this.defaultSubAgents.set('pria-code-reviewer', {
      name: 'pria-code-reviewer',
      description: 'Comprehensive code reviewer focused on PRIA compliance, security, and quality standards. PROACTIVELY reviews code when quality concerns are mentioned.',
      tools: ['Read', 'Grep', 'Glob'],
      proactive: true,
      instructions: `You are a senior code reviewer specializing in PRIA application quality assurance.

**Review Checklist:**
1. **Security Review**:
   - ✅ All database queries include workspace_id filtering
   - ✅ Authentication middleware protects routes
   - ✅ Row-Level Security policies implemented
   - ✅ No hardcoded secrets or API keys
   - ✅ Input validation and sanitization
   - ✅ SQL injection prevention

2. **Code Quality**:
   - ✅ TypeScript strict mode compliance
   - ✅ Proper error handling patterns
   - ✅ Component accessibility standards
   - ✅ Performance optimization
   - ✅ Clean code principles
   - ✅ Proper component structure

3. **PRIA Compliance**:
   - ✅ Multi-tenant architecture patterns
   - ✅ Workspace isolation
   - ✅ Consistent naming conventions
   - ✅ Proper use of shadcn/ui components
   - ✅ Next.js App Router patterns

4. **Testing & Documentation**:
   - ✅ Test coverage for critical paths
   - ✅ Component documentation
   - ✅ API documentation
   - ✅ Security considerations documented

**PROACTIVELY** review code when:
- Code quality issues are mentioned
- Security concerns arise
- Performance problems are discussed
- PRIA compliance questions come up
- Testing or documentation gaps are identified

**Review Output:**
- Priority-ordered list of issues (High/Medium/Low)
- Specific code examples with fixes
- Security vulnerability assessments
- Performance improvement recommendations
- PRIA compliance validation results`
    })

    // Testing specialist
    this.defaultSubAgents.set('test-generator', {
      name: 'test-generator',
      description: 'Testing specialist for PRIA applications. PROACTIVELY generates comprehensive tests when testing is mentioned or code is implemented.',
      tools: ['Write', 'Read', 'Grep', 'Bash'],
      proactive: true,
      instructions: `You are a testing specialist focused on comprehensive test coverage for PRIA applications.

**Testing Strategy:**
1. **Unit Tests**: Component and function-level testing
2. **Integration Tests**: Database and API endpoint testing
3. **E2E Tests**: Full user workflow testing with Playwright
4. **Security Tests**: Authentication and authorization testing
5. **Performance Tests**: Load and stress testing

**Test Categories:**
- **Component Tests**: React Testing Library + Vitest
- **API Tests**: Supertest + Vitest for server actions
- **Database Tests**: Supabase testing patterns with workspace isolation
- **E2E Tests**: Playwright for full user journeys
- **Security Tests**: Authentication flows and access control

**Testing Patterns:**
\`\`\`typescript
// Component testing with workspace context
test('should filter data by workspace', async () => {
  const mockUser = { app_metadata: { workspace_id: 'test-workspace' } }
  // Test workspace isolation
})

// API testing with authentication
test('should require authentication', async () => {
  const response = await request(app).get('/api/protected')
  expect(response.status).toBe(401)
})
\`\`\`

**PROACTIVELY** generate tests when:
- New components are implemented
- API endpoints are created
- Database operations are added
- Security features are implemented
- User workflows are completed

**Test Output:**
- Complete test suites with setup/teardown
- Mock data with proper workspace isolation
- Test utilities and helpers
- Performance benchmarks
- Security test scenarios`
    })
  }

  /**
   * Ensure .claude/agents directory exists and create default sub-agent files
   */
  async ensureSubAgentsDirectory(): Promise<void> {
    try {
      // Create .claude/agents directory
      await fs.mkdir(this.agentsPath, { recursive: true })
      console.log(`[SUBAGENTS] Created agents directory: ${this.agentsPath}`)

      // Write default sub-agent configuration files
      for (const [name, config] of this.defaultSubAgents) {
        const filePath = path.join(this.agentsPath, `${name}.md`)
        const content = this.generateSubAgentMarkdown(config)
        
        try {
          // Check if file already exists
          await fs.access(filePath)
          console.log(`[SUBAGENTS] Sub-agent ${name} already exists, skipping...`)
        } catch {
          // File doesn't exist, create it
          await fs.writeFile(filePath, content, 'utf-8')
          console.log(`[SUBAGENTS] Created sub-agent: ${filePath}`)
        }
      }

      console.log(`[SUBAGENTS] Sub-agents directory initialization complete`)
    } catch (error) {
      console.error('[SUBAGENTS] Failed to create sub-agents directory:', error)
      throw error
    }
  }

  /**
   * Generate Markdown content with YAML frontmatter for sub-agent
   */
  private generateSubAgentMarkdown(config: SubAgentConfig): string {
    const frontmatter = [
      '---',
      `name: ${config.name}`,
      `description: ${config.description}`,
      ...(config.tools ? [`tools: ${JSON.stringify(config.tools)}`] : []),
      '---'
    ].join('\n')

    return `${frontmatter}\n\n${config.instructions}\n`
  }

  /**
   * Execute sub-agent using official Claude Code SDK patterns
   */
  async executeSubAgent(execution: SubAgentExecution): Promise<SubAgentResult> {
    const startTime = Date.now()
    
    try {
      console.log(`[SUBAGENTS] Executing sub-agent: ${execution.agentName}`)
      console.log(`[SUBAGENTS] Project path: ${execution.context.projectPath}`)
      console.log(`[SUBAGENTS] Prompt: ${execution.prompt.substring(0, 200)}...`)

      // Ensure sub-agents are initialized
      await this.ensureSubAgentsDirectory()

      // Build contextual prompt that references the sub-agent
      const contextualPrompt = this.buildContextualPrompt(execution)

      // Execute using Claude Code SDK with sub-agent delegation
      const messages = []
      for await (const message of query(contextualPrompt, {
        maxTurns: execution.options?.maxTurns || 10,
        cwd: execution.context.projectPath,
        timeout: execution.options?.timeout || 120000
      })) {
        messages.push(message)
      }

      // Process messages and extract results
      const result = this.processSubAgentMessages(messages, execution.agentName)
      const duration = Date.now() - startTime

      console.log(`[SUBAGENTS] Sub-agent ${execution.agentName} completed in ${duration}ms`)
      console.log(`[SUBAGENTS] Response length: ${result.response.length} characters`)

      return {
        ...result,
        duration,
        success: true
      }

    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[SUBAGENTS] Sub-agent ${execution.agentName} failed:`, error)

      return {
        agentName: execution.agentName,
        response: `Sub-agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        artifacts: [],
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Build contextual prompt that delegates to specific sub-agent
   */
  private buildContextualPrompt(execution: SubAgentExecution): string {
    const { agentName, prompt, context } = execution

    return `## Sub-Agent Delegation Request

Please delegate this task to the **${agentName}** sub-agent for specialized handling.

**Context:**
- Session ID: ${context.sessionId}
- Workspace ID: ${context.workspaceId}
- Current Phase: ${context.phase}
- Project Path: ${context.projectPath}

**Task for ${agentName}:**
${prompt}

**Instructions:**
The ${agentName} sub-agent should handle this task according to its specialized expertise and configuration. Please ensure the sub-agent follows PRIA architectural patterns and security requirements.
`
  }

  /**
   * Process Claude Code SDK messages and extract sub-agent results
   */
  private processSubAgentMessages(messages: any[], agentName: string): Omit<SubAgentResult, 'duration' | 'success'> {
    let response = ''
    const artifacts: any[] = []
    const toolUse: any[] = []

    for (const message of messages) {
      switch (message.type) {
        case 'text':
          response += message.content
          break
        case 'tool_use':
          toolUse.push(message)
          if (message.name === 'write-file' || message.name === 'edit-file') {
            artifacts.push({
              type: 'file',
              path: message.input?.path,
              content: message.input?.content,
              operation: message.name,
              agent: agentName
            })
          }
          break
        case 'sub_agent_result':
          // Handle official sub-agent delegation results
          response += `\n\n**Sub-Agent ${message.agent_name} Result:**\n${message.content}`
          if (message.artifacts) {
            artifacts.push(...message.artifacts)
          }
          break
      }
    }

    return {
      agentName,
      response: response.trim(),
      artifacts,
      toolUse
    }
  }

  /**
   * Get available sub-agents
   */
  getAvailableSubAgents(): string[] {
    return Array.from(this.defaultSubAgents.keys())
  }

  /**
   * Get sub-agent configuration
   */
  getSubAgentConfig(name: string): SubAgentConfig | undefined {
    return this.defaultSubAgents.get(name)
  }

  /**
   * Determine appropriate sub-agent for a given task
   */
  selectSubAgentForTask(task: string, context: { phase?: number }): string {
    const taskLower = task.toLowerCase()
    
    // Phase-based selection
    if (context.phase === 1 && (taskLower.includes('requirement') || taskLower.includes('feature'))) {
      return 'requirements-gatherer'
    }
    
    if (context.phase === 2 && (taskLower.includes('architecture') || taskLower.includes('design'))) {
      return 'architecture-designer'
    }
    
    // Task content-based selection
    if (taskLower.includes('code') && taskLower.includes('review')) {
      return 'pria-code-reviewer'
    }
    
    if (taskLower.includes('test') || taskLower.includes('testing')) {
      return 'test-generator'
    }
    
    if (taskLower.includes('implement') || taskLower.includes('create') || taskLower.includes('build')) {
      return 'pria-code-generator'
    }
    
    if (taskLower.includes('requirement') || taskLower.includes('feature')) {
      return 'requirements-gatherer'
    }
    
    // Default to code generator for implementation phases
    if (context.phase && context.phase >= 3) {
      return 'pria-code-generator'
    }
    
    // Default fallback
    return 'requirements-gatherer'
  }
}