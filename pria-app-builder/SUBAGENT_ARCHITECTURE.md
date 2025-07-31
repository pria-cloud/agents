# PRIA Subagent Architecture Plan

## Overview

This document outlines the implementation plan for Claude Code subagents in the PRIA App Builder system. Subagents will transform PRIA from a single-agent system into a multi-agent development team with specialized expertise for each phase of the 7-phase workflow.

## Current Challenges Solved by Subagents

### 1. Context Pollution
- **Problem**: Single Claude context degrades as conversations grow across all 7 phases
- **Solution**: Each phase operates in isolated subagent context with specialized focus

### 2. Expertise Dilution
- **Problem**: One Claude tries to be expert in requirements, architecture, coding, testing, deployment
- **Solution**: Specialized subagents with domain-specific knowledge and tools

### 3. Sequential Bottlenecks
- **Problem**: Linear phase progression prevents beneficial parallel work
- **Solution**: Concurrent phase activities with cross-phase coordination

### 4. Context Loss Between Phases
- **Problem**: Moving between phases loses nuanced phase-specific context
- **Solution**: Clean handoffs with preserved subagent context and artifacts

## Subagent Architecture Design

### Core Phase-Specific Subagents

```typescript
const PHASE_SUBAGENTS = {
  1: 'requirements-analyst',    // Conversational discovery specialist
  2: 'system-architect',       // PRIA-compliant architecture expert  
  3: 'project-planner',        // Task breakdown & sprint planning
  4: 'code-generator',         // PRIA-compliant code generation
  5: 'qa-engineer',           // Testing automation & quality assurance
  6: 'security-auditor',      // Security review & compliance validation
  7: 'devops-engineer'        // Deployment & monitoring setup
}
```

### Utility Specialist Subagents

```typescript
const UTILITY_SUBAGENTS = {
  'component-researcher': 'Research best practices for specific UI components',
  'database-specialist': 'Complex schema design & RLS policy generation', 
  'integration-expert': 'Third-party service integration & API design',
  'documentation-writer': 'Technical documentation & API docs',
  'bug-investigator': 'Error analysis & debugging specialist'
}
```

## Implementation Phases

### Phase 1: Core Subagent Foundation (HIGH PRIORITY)

#### 1.1 Create Subagent Definitions
- `requirements-analyst` - Clean requirements discovery without implementation noise
- `system-architect` - PRIA-compliant architecture and database design
- `code-generator` - Production-ready Next.js/Supabase code generation

#### 1.2 Enhanced Workflow Manager
- Extend `WorkflowManager` with subagent delegation
- Phase-specific subagent routing
- Context preservation across subagent invocations

#### 1.3 Database Schema Extensions
- `subagent_contexts` table for context preservation
- `subagent_artifacts` table for cross-phase references
- RLS policies for workspace isolation

### Phase 2: Cross-Phase Coordination (MEDIUM PRIORITY)

#### 2.1 Inter-Subagent Communication
- Reference mechanisms (@requirements-analyst, @system-architect)
- Artifact sharing between subagents
- Event-driven context updates

#### 2.2 Parallel Processing
- Concurrent phase activities
- Dependency-aware scheduling
- Resource coordination

#### 2.3 Enhanced Quality Assurance
- `qa-engineer` subagent integration
- `security-auditor` compliance validation
- Automated quality gates

### Phase 3: Advanced Capabilities (FUTURE ENHANCEMENT)

#### 3.1 Specialized Research Subagents
- `component-researcher` for dependency selection
- `integration-expert` for third-party services
- `documentation-writer` for comprehensive docs

#### 3.2 Advanced Orchestration
- Dynamic subagent selection
- Load balancing and performance optimization
- Advanced error handling and recovery

## Subagent Definitions

### 1. Requirements Analyst

```markdown
---
name: requirements-analyst
description: Specialized in conversational requirements discovery with iterative refinement support
tools: [read-file, write-file, list-files, web-search]
---

You are a senior business analyst specializing in requirements gathering for enterprise applications. 
Your context is ONLY focused on Phase 1 requirements discovery and refinement.

## Core Responsibilities
- Conversational requirements elicitation
- Stakeholder needs analysis  
- Acceptance criteria definition
- Requirement lifecycle management
- Business rule identification

## PRIA Context
- Multi-tenant SaaS applications
- Next.js + Supabase architecture
- Workspace-isolated data models
- Security-first design principles

## Tools & Capabilities
- Requirements extraction and structuring
- Industry research for best practices
- Requirement validation and verification
- Traceability matrix creation

IMPORTANT: You maintain dedicated context for requirements evolution without pollution from 
implementation details, testing concerns, or deployment issues.

Your responses should focus on:
1. Clear, testable requirements
2. Business value articulation
3. Edge case identification
4. Integration points
5. Security and compliance needs
```

### 2. System Architect

```markdown
---
name: system-architect
description: PRIA-compliant system architecture design specialist with multi-tenant expertise
tools: [read-file, write-file, list-files, run-command]
---

You are a senior software architect ONLY focused on Phase 2 - Architecture & Technical Design.
You excel at evolvable, multi-tenant architectures with Supabase and Next.js.

## Core Responsibilities
- System architecture design
- Database schema optimization
- Security architecture planning
- Scalability and performance design
- PRIA compliance validation

## Specialized Knowledge
- Multi-tenant SaaS patterns
- Supabase Row-Level Security (RLS)
- Next.js 15 App Router architecture
- TypeScript strict patterns
- API design and versioning

## Architecture Principles
- Security by design
- Workspace isolation
- Horizontal scalability  
- Evolvable schemas
- Performance optimization

## Deliverables
- Technical specifications
- Database schemas with RLS
- API contract definitions
- Security architecture docs
- Component interaction diagrams

IMPORTANT: Focus exclusively on architectural concerns. Reference requirements from 
@requirements-analyst but avoid implementation specifics that belong to @code-generator.
```

### 3. Code Generator

```markdown
---
name: code-generator
description: Production-ready PRIA-compliant code generation specialist
tools: [read-file, write-file, edit-file, list-files, run-command]
---

You are a senior full-stack developer specializing in production-ready Next.js applications 
with Supabase. Your context is ONLY focused on Phase 4 - Development & Implementation.

## Core Responsibilities
- Production-ready code generation
- PRIA compliance enforcement
- TypeScript strict implementation
- Component library integration
- Database integration patterns

## Technical Stack Expertise
- Next.js 15 with App Router
- React 19 with TypeScript strict
- Supabase client/server patterns
- shadcn/ui component library
- Tailwind CSS styling

## Code Quality Standards
- TypeScript strict mode compliance
- Comprehensive error handling
- Workspace tenancy enforcement
- Security best practices
- Performance optimization

## PRIA Compliance Requirements
- All database queries MUST include workspace_id filtering
- Server actions MUST validate authentication
- Components MUST handle loading/error/empty states
- Forms MUST include proper validation
- Security patterns MUST be followed

## Context Sources
- Requirements from @requirements-analyst
- Architecture from @system-architect  
- Implementation plan from @project-planner

IMPORTANT: Generate complete, production-ready code with no placeholders or TODOs. 
Focus on implementation excellence while maintaining PRIA architectural compliance.
```

## Database Schema Extensions

### Subagent Contexts Table

```sql
-- Store subagent context and artifacts
CREATE TABLE subagent_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  agent_name TEXT NOT NULL,
  phase_number INTEGER,
  context_data JSONB NOT NULL,
  artifacts JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace isolation
ALTER TABLE subagent_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON subagent_contexts
FOR ALL USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);

-- Indexes for performance
CREATE INDEX idx_subagent_contexts_session_agent ON subagent_contexts(session_id, agent_name);
CREATE INDEX idx_subagent_contexts_workspace_phase ON subagent_contexts(workspace_id, phase_number);
```

### Subagent Artifacts Table

```sql
-- Store cross-phase artifacts and references
CREATE TABLE subagent_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  session_id UUID NOT NULL REFERENCES sessions(id),
  source_agent TEXT NOT NULL,
  target_agent TEXT,
  artifact_type TEXT NOT NULL, -- 'requirement', 'specification', 'task', 'code'
  artifact_data JSONB NOT NULL,
  reference_key TEXT, -- For @agent-name references
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace isolation
ALTER TABLE subagent_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON subagent_artifacts
FOR ALL USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);

-- Indexes
CREATE INDEX idx_subagent_artifacts_session ON subagent_artifacts(session_id);
CREATE INDEX idx_subagent_artifacts_reference ON subagent_artifacts(reference_key);
```

## Implementation Strategy

### API Integration

```typescript
// Enhanced streaming API with subagent delegation
export async function POST(request: NextRequest) {
  const { sessionId, message, options = {} } = await request.json()
  
  // Get current workflow state
  const workflowManager = new SubagentWorkflowManager(sessionId)
  const currentPhase = await workflowManager.getCurrentPhase()
  
  // Delegate to phase-specific subagent
  const subagentName = PHASE_SUBAGENTS[currentPhase.number]
  const phaseContext = await workflowManager.getPhaseContext(currentPhase.number)
  
  // Execute subagent with preserved context
  const subagentResponse = await executeSubagent(subagentName, {
    systemPrompt: currentPhase.systemPrompt,
    userMessage: message,
    context: phaseContext,
    artifacts: await getReferencedArtifacts(sessionId, message)
  })
  
  // Stream response and update context
  return streamSubagentResponse(subagentResponse, {
    onComplete: async (result) => {
      await workflowManager.updateSubagentContext(subagentName, result.context)
      await workflowManager.extractAndStoreArtifacts(result.response)
    }
  })
}
```

### Subagent Workflow Manager

```typescript
class SubagentWorkflowManager extends WorkflowManager {
  private subagentContexts: Map<string, any> = new Map()

  async executeWithSubagent(
    agentName: string, 
    prompt: string, 
    options: SubagentOptions = {}
  ): Promise<SubagentResult> {
    
    // Load preserved context for this subagent
    const context = await this.loadSubagentContext(agentName)
    
    // Prepare cross-phase references
    const artifacts = await this.resolveArtifactReferences(prompt)
    
    // Execute subagent
    const result = await this.inviteSubagent(agentName, {
      prompt: this.enhancePromptWithContext(prompt, context, artifacts),
      tools: this.getSubagentTools(agentName),
      options
    })
    
    // Preserve context for future invocations
    await this.saveSubagentContext(agentName, result.context)
    
    // Extract and store new artifacts
    await this.extractArtifacts(result.response, agentName)
    
    return result
  }

  private async resolveArtifactReferences(prompt: string): Promise<Artifact[]> {
    const references = this.extractReferences(prompt) // @requirements-analyst, etc.
    const artifacts = []
    
    for (const ref of references) {
      const agentArtifacts = await supabase
        .from('subagent_artifacts')
        .select('*')
        .eq('session_id', this.sessionId)
        .eq('source_agent', ref.agentName)
        .eq('workspace_id', this.workspaceId)
      
      artifacts.push(...agentArtifacts.data || [])
    }
    
    return artifacts
  }
}
```

## Expected Benefits

### Immediate Improvements (Phase 1)
- **🎯 Better Requirements**: Clean discovery without implementation noise
- **🏛️ Superior Architecture**: PRIA-compliant, scalable designs  
- **⚡ Faster Code Generation**: Focused implementation context

### Advanced Capabilities (Phase 2-3)
- **🔄 Parallel Processing**: Multiple phases advance simultaneously
- **🔍 Specialized Research**: Optimal libraries and patterns
- **🛡️ Enhanced Security**: Dedicated compliance validation
- **📚 Better Documentation**: Comprehensive project documentation

### Performance Metrics
- **Context Efficiency**: 3-5x reduction in context pollution
- **Quality Improvement**: 2-3x better phase-specific outputs
- **Development Speed**: 40-60% faster overall workflow completion
- **Error Reduction**: 50-70% fewer implementation mistakes

## Success Criteria

### Phase 1 Success Metrics
- [ ] Requirements quality improvement (measured by acceptance criteria completeness)
- [ ] Architecture specification completeness (PRIA compliance score)
- [ ] Code generation quality (TypeScript strict compliance, error handling)
- [ ] Context preservation effectiveness (subagent context reuse)

### Phase 2 Success Metrics  
- [ ] Cross-phase coordination effectiveness (artifact reference accuracy)
- [ ] Parallel processing capability (concurrent phase advancement)
- [ ] Quality assurance integration (automated testing coverage)

### Phase 3 Success Metrics
- [ ] End-to-end workflow completion time reduction
- [ ] User satisfaction improvement
- [ ] System scalability for complex projects
- [ ] Enterprise adoption readiness

## Risk Mitigation

### Technical Risks
- **Token Consumption**: Monitor and optimize subagent usage patterns
- **Coordination Complexity**: Implement robust error handling and recovery
- **Context Synchronization**: Version-controlled artifacts with change tracking

### Implementation Risks  
- **User Experience**: Gradual rollout with fallback to single-agent mode
- **Performance**: Load testing and optimization for subagent coordination
- **Reliability**: Comprehensive testing of subagent handoffs and context preservation

## Conclusion

The subagent architecture will transform PRIA App Builder into a true multi-agent development platform, providing specialized expertise for each phase while maintaining the user-friendly, iterative approach that makes PRIA valuable for enterprise application development.

This implementation plan provides a clear roadmap for evolving PRIA from a single-agent system to a sophisticated multi-agent development team orchestrated by the main Claude instance acting as a technical lead.