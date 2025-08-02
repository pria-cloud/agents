# PRIA Builder App Development Guidelines for Claude Code

This document defines the comprehensive technical architecture guidelines for developing and maintaining the PRIA App Builder system - a sophisticated split architecture that orchestrates enterprise application development through Claude Code SDK integration.

## 🏗️ Split Architecture Overview

### PRIA App Builder System Architecture
The PRIA App Builder implements a **sophisticated split architecture** with two distinct but integrated applications:

1. **Builder App** (THIS REPOSITORY)
   - **Role**: Orchestration platform, workflow management, and user interface
   - **Technology**: Next.js 15 with advanced Builder-specific components
   - **Responsibilities**:
     - Real-time conversational chat interface with workflow context
     - 7-phase structured development workflow management and coordination
     - Intelligent requirements extraction and complete lifecycle tracking
     - E2B sandbox management and Target App communication via APIs
     - Multi-tenant workspace isolation and session management
     - GitHub webhook processing for real-time code synchronization
     - Performance monitoring, error recovery, and deployment pipeline management

2. **Target Apps** (E2B Sandboxes with Custom Template)
   - **Role**: Isolated application development environments with Claude Code SDK
   - **Technology**: E2B sandboxes with PRIA custom template v2.0.0
   - **Responsibilities**:
     - Execute Claude Code SDK commands for production-ready code generation
     - Maintain TARGET_APP_SPECIFICATION.md for comprehensive project context
     - Generate PRIA-compliant applications following strict architectural guidelines
     - Provide completely isolated development environments per session
     - Support 8 specialized sub-agents for phase-specific development tasks

### Critical Architecture Principles

#### Builder App (Your Context) - ENHANCED ORCHESTRATOR ROLE
- **NEVER generate Target App code directly** - Builder App orchestrates, Target Apps generate with full file creation capabilities
- **Enhanced Claude Code Integration** - Real-time streaming with sub-agent visibility and thought process transparency
- **Sub-agent Orchestration Transparency** - Display which Claude Code specialist is handling each task with reasoning
- **Advanced UI/UX Components** - Split-screen interface with thought process streaming and sub-agent indicators
- **Real-time Progress Visualization** - Live updates showing Claude's decision-making and file creation process
- **Conversation Persistence** - 3-tier restoration strategy (resume/replay/fresh start) across E2B recreation
- **Comprehensive Session Management** - Track Claude session IDs, sub-agent activity, and thought processes

#### Enhanced Target App Communication Protocol
- **Advanced Claude Code Execution** - Full file creation permissions with `--dangerously-skip-permissions` flag
- **Sub-agent Detection System** - Intelligent keyword analysis to identify active Claude Code specialists
- **Streaming Thought Process** - Real-time emission of Claude's analysis, planning, and implementation steps
- **Enhanced Session Isolation** - Each session maintains independent Claude conversation context
- **Transparent Development Process** - Users see exactly which sub-agent is working and what they're thinking
- **Production-Ready Code Generation** - Claude Code can now create, modify, and manage actual project files

## 🔄 Enhanced Workflow Management System

### 7-Phase Development Workflow (Production-Ready)
The Builder App implements a comprehensive structured development process:

1. **Requirements Gathering** (Phase 1)
   - Conversational discovery with intelligent extraction
   - Automatic requirements categorization and validation
   - Stakeholder collaboration and approval workflows

2. **Architecture & Technical Design** (Phase 2)
   - System design with PRIA compliance validation
   - Database schema generation with RLS policies
   - Component architecture and API specification

3. **Implementation Planning** (Phase 3)
   - Task breakdown with dependency mapping
   - Sprint planning and resource estimation
   - Parallel processing coordination

4. **Development & Implementation** (Phase 4)
   - Production-ready code generation via Target App coordination
   - Real-time GitHub synchronization and webhook processing
   - Continuous integration and quality validation

5. **Testing & Quality Assurance** (Phase 5)
   - Comprehensive test suite generation and execution
   - Security auditing and compliance validation
   - Performance testing and optimization

6. **Final Validation & Code Review** (Phase 6)
   - Security audit and vulnerability assessment
   - Deployment readiness verification
   - Final compliance and quality gate validation

7. **Deployment & Monitoring** (Phase 7)
   - Production deployment with Vercel integration
   - Performance monitoring and error tracking setup
   - Operational readiness and maintenance planning

### Advanced Workflow Implementation

#### Enhanced Phase Management
```typescript
// Advanced workflow orchestration in Builder App
import { AdvancedWorkflowManager } from '@/lib/workflow/advanced-workflow-manager'
import { SubagentOrchestrator } from '@/lib/claude-sdk/subagent-orchestrator'

const workflowManager = new AdvancedWorkflowManager(sessionId, workspaceId)
const subagentOrchestrator = new SubagentOrchestrator()

// Get current phase with quality gates and validation rules
const phaseContext = await workflowManager.getCurrentPhaseContext()
const subagentPrompt = await subagentOrchestrator.generatePhaseSpecificPrompt(
  phaseContext.phase,
  phaseContext.subagent,
  { requirements: currentRequirements, artifacts: phaseArtifacts }
)

// Execute with Target App using enhanced Claude Code SDK integration
const claudeResponse = await targetAppClient.executeClaudeQuery(
  sessionId,
  subagentPrompt,
  {
    maxTurns: 10,
    contextPreservation: true,
    artifactReferencing: true,
    parallelProcessing: phaseContext.allowParallel
  }
)
```

#### Intelligent Requirements Management
```typescript
// Enhanced requirements extraction with AI-powered categorization
import { EnhancedRequirementsExtractor } from '@/lib/requirements/enhanced-requirements-extractor'
import { RequirementsValidator } from '@/lib/requirements/requirements-validator'

const extractor = new EnhancedRequirementsExtractor()
const validator = new RequirementsValidator()

const extractedRequirements = await extractor.extractFromConversation(
  claudeResponse,
  {
    workflow_phase: currentPhase.number,
    session_id: sessionId,
    workspace_id: workspaceId,
    context: {
      previous_requirements: existingRequirements,
      project_scope: projectMetadata,
      stakeholder_input: stakeholderFeedback
    }
  }
)

// Validate and categorize requirements
const validatedRequirements = await validator.validateAndCategorize(
  extractedRequirements,
  { compliance_rules: 'PRIA_STANDARDS', security_level: 'ENTERPRISE' }
)

// Save with comprehensive audit trail and workspace isolation
await supabase.from('requirements').insert({
  session_id: sessionId,
  workspace_id: workspaceId, // MANDATORY
  phase: currentPhase.number,
  extracted_at: new Date().toISOString(),
  validation_status: validatedRequirements.status,
  ...validatedRequirements.data
})
```

## 🎯 Builder App Advanced Capabilities

### Core Orchestration Responsibilities

#### 1. Advanced Workflow Orchestration
- Manage sophisticated 7-phase development process with parallel execution support
- Track progress with comprehensive quality gates and validation checkpoints
- Coordinate between phases ensuring all deliverables meet PRIA standards
- Support iterative, non-linear development patterns with context preservation
- Handle complex dependency management across multiple concurrent tasks

#### 2. Intelligent Requirements Engineering
- Extract requirements from Claude conversations using AI-powered analysis
- Maintain complete requirement lifecycle with audit trails and change tracking
- Provide collaborative requirements management with stakeholder validation
- Track requirement evolution, impact analysis, and traceability matrices
- Support requirement prioritization, risk assessment, and scope management

#### 3. Advanced E2B Sandbox Management
- Create and manage E2B sandboxes using PRIA custom template v2.0.0
- Ensure sandbox persistence across sessions with comprehensive state recovery
- Handle Target App initialization with pre-configured sub-agents and tools
- Coordinate Claude Code SDK execution via enhanced E2B API integration
- Implement sophisticated error recovery with multiple fallback strategies

#### 4. Comprehensive Session & Context Management
- Maintain strict workspace isolation with multi-tenant security architecture
- Preserve complete development context across sessions with full restoration
- Track detailed chat history with workflow metadata and artifact references
- Process GitHub webhooks for real-time code synchronization and conflict resolution
- Coordinate with Target App specification documents and cross-phase artifacts

#### 5. Production Deployment Pipeline Management
- Orchestrate complete Phase 7 deployment with Vercel integration
- Handle environment configuration, security validation, and performance optimization
- Implement deployment monitoring, rollback capabilities, and disaster recovery
- Coordinate with CI/CD pipelines and automated testing frameworks
- Provide deployment analytics, performance metrics, and operational insights

### Enhanced Builder App Technology Stack
- **Framework**: Next.js 15 with App Router and advanced Builder-specific components
- **UI Components**: shadcn/ui with custom PRIA-specific extensions
- **Database**: Supabase with comprehensive workspace isolation and advanced RLS policies
- **Real-time**: Supabase Realtime for collaborative features and live synchronization
- **E2B Integration**: Enhanced E2B SDK with custom template and advanced sandbox management
- **Workflow**: Sophisticated 7-phase workflow system with Context7 MCP integration
- **Claude SDK**: TypeScript `query()` function integration with sub-agent orchestration
- **GitHub Integration**: Advanced webhook processing with real-time synchronization
- **Monitoring**: Comprehensive performance monitoring and error recovery systems
- **Security**: AES-256-GCM encryption for sensitive data and comprehensive audit logging

## 🤖 Enhanced Claude Code SDK Integration with Sub-agent Transparency

### Production-Ready SDK Integration Architecture

The Builder App implements sophisticated Claude Code SDK integration with **full sub-agent visibility**, **real-time thought process streaming**, and **comprehensive conversation persistence** across sessions, E2B sandbox recreation, and user interruptions.

### 🎯 Sub-agent Orchestration & Transparency System

#### Enhanced Claude Code Execution
```typescript
// Modern Claude Code execution with full capabilities
export interface ClaudeSDKExecutionOptions {
  sessionId: string
  prompt: string
  workingDirectory?: string
  maxTurns?: number
  timeout?: number
  preserveContext?: boolean
  onProgress?: (progress: string) => void
  onThoughtProcess?: (thought: { type: string, content: string, metadata?: any }) => void
}

export class ClaudeSandboxExecutor {
  async executeClaudeInSandbox(options: ClaudeSDKExecutionOptions): Promise<ClaudeSDKExecutionResult> {
    // Execute with full file creation permissions
    const claudeFlags = `-p --dangerously-skip-permissions`
    
    // Emit real-time thought process events
    if (options.onThoughtProcess) {
      options.onThoughtProcess({
        type: 'thinking',
        content: 'Scanning available sub-agents and analyzing task requirements...',
        metadata: { phase: 'pre-execution' }
      })
    }
    
    // Let Claude Code automatically select appropriate sub-agent
    const result = await this.sandboxManager.executeCommand(sessionId, command)
    
    // Detect and emit sub-agent selection
    const subAgentDetection = this.detectSubAgentFromResponse(result.stdout)
    if (subAgentDetection.agent) {
      options.onThoughtProcess?.({
        type: 'subagent_selected',
        content: `Sub-agent detected: ${subAgentDetection.agent}`,
        metadata: {
          subagent: subAgentDetection.agent,
          reasoning: subAgentDetection.reasoning,
          confidence: 'medium'
        }
      })
    }
  }
}
```

#### Sub-agent Detection System
```typescript
// Intelligent sub-agent detection using keyword analysis
private detectSubAgentFromResponse(response: string): { agent?: string, reasoning?: string } {
  const patterns = [
    { agent: 'requirements-analyst', keywords: ['requirements', 'business analysis', 'gathering needs', 'stakeholder'] },
    { agent: 'architecture-expert', keywords: ['architecture', 'system design', 'technical design', 'components'] },
    { agent: 'code-generator', keywords: ['creating file', 'implementing', 'writing code', 'generating code'] },
    { agent: 'qa-engineer', keywords: ['testing', 'quality assurance', 'test cases', 'validation'] },
    { agent: 'security-auditor', keywords: ['security', 'vulnerability', 'audit', 'security review'] },
    { agent: 'deployment-specialist', keywords: ['deployment', 'production', 'release', 'deploy'] }
  ]
  
  const responseLower = response.toLowerCase()
  
  for (const pattern of patterns) {
    const matchCount = pattern.keywords.filter(keyword => responseLower.includes(keyword)).length
    if (matchCount >= 2) { // Require at least 2 keyword matches for confidence
      return {
        agent: pattern.agent,
        reasoning: `Detected based on keywords: ${pattern.keywords.filter(k => responseLower.includes(k)).join(', ')}`
      }
    }
  }
  
  return {}
}
```

### 🎨 Advanced UI Components for Sub-agent Visibility

#### SubAgentIndicator Component
```typescript
export interface SubAgentActivity {
  agent: 'requirements-analyst' | 'code-generator' | 'architecture-expert' | 'qa-engineer' 
       | 'security-auditor' | 'deployment-specialist' | 'performance-optimizer' | 'implementation-planner'
  action: 'analyzing' | 'planning' | 'implementing' | 'reviewing' | 'optimizing' | 'testing' | 'deploying'
  progress: number
  reasoning: string
  files: string[]
  startTime: Date
  isActive: boolean
}

export function SubAgentIndicator({ activity, detectedAgent, detectionReasoning }: SubAgentIndicatorProps) {
  const config = agentConfig[activity?.agent || detectedAgent]
  const Icon = config.icon

  return (
    <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full text-white", config.color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {config.emoji} {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">detected</span>
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {detectionReasoning && (
              <p className="text-xs text-muted-foreground/80 mt-1">
                🔍 {detectionReasoning}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### ThoughtProcessStream Component
```typescript
export function ThoughtProcessStream({ sessionId, thoughts, isActive }: ThoughtProcessStreamProps) {
  return (
    <Card className={cn(
      "transition-all duration-300",
      isActive ? "border-green-200 bg-green-50/30" : ""
    )}>
      <CardContent className="p-0">
        <div className="p-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Claude Code Thought Process</span>
            {isActive && <Badge variant="secondary" className="text-xs animate-pulse">Active</Badge>}
          </div>
        </div>
        
        <ScrollArea className="p-3" style={{ maxHeight: "400px" }}>
          <div className="space-y-3">
            {thoughts.map((thought) => (
              <ThoughtItem key={thought.id} thought={thought} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
```

### 🔄 Enhanced Streaming Architecture

#### Real-time Thought Process Streaming
```typescript
// Enhanced streaming API with thought process visibility
export async function POST(request: NextRequest) {
  // ... existing setup ...
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: any) => {
        const eventData = `data: ${JSON.stringify({ type, ...data })}\n\n`
        controller.enqueue(encoder.encode(eventData))
      }

      try {
        // Send sub-agent analysis start
        sendEvent('subagent_analyzing', {
          message: 'Claude Code is analyzing your request and selecting the appropriate specialist...',
          timestamp: new Date().toISOString()
        })
        
        // Send thought process updates
        sendEvent('thought_process_start', {
          sessionId,
          message: 'Starting analysis of user request...'
        })
        
        // Execute with thought process callbacks
        const claudeResult = await claudeExecutor.executeClaudeInSandbox({
          sessionId,
          prompt: sanitizedMessage, // Clean prompt without system injection
          workingDirectory: environment.workingDirectory,
          maxTurns: 10,
          preserveContext: true,
          onThoughtProcess: (thought) => {
            sendEvent('thought_process_update', {
              type: thought.type,
              content: thought.content,
              timestamp: new Date().toISOString(),
              metadata: thought.metadata
            })
          }
        })
        
        // Claude Code can now create files with --dangerously-skip-permissions
        
      } catch (error) {
        sendEvent('error', { error: error.message })
      }
    }
  })
}

### 🔄 Conversation Persistence & Session Management

#### Problem Statement
Users need seamless conversation continuity when:
- Leaving and returning to Builder App sessions
- E2B sandboxes are destroyed and recreated
- Server restarts or network interruptions occur
- Switching between multiple projects and sessions

#### Solution Architecture: 3-Tier Restoration Strategy

**Tier 1: Claude Session Resume** (Fastest)
- Store Claude Code's actual session IDs in database
- Attempt `claude -p --resume <claude-session-id>` for exact continuation
- Works when Claude's internal session is still accessible

**Tier 2: Conversation Replay** (Robust Fallback)
- Retrieve complete message history from database
- Create context restoration prompt with full conversation
- Start fresh Claude session with historical context
- Claude acknowledges previous work and continues seamlessly

**Tier 3: Fresh Start** (Graceful Degradation)
- If both strategies fail, start new conversation
- User informed about restoration status
- No conversation history lost - stored in database

#### Database Schema Enhancement

```sql
-- Enhanced sessions table with Claude session tracking
ALTER TABLE sessions ADD COLUMN claude_session_id TEXT;
ALTER TABLE sessions ADD COLUMN claude_session_status TEXT DEFAULT 'inactive';
ALTER TABLE sessions ADD COLUMN claude_first_message_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN claude_last_interaction_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN claude_conversation_turns INTEGER DEFAULT 0;

-- Dedicated conversation tracking table
CREATE TABLE claude_conversations (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    claude_session_id TEXT NOT NULL,
    conversation_status TEXT DEFAULT 'active',
    restoration_method TEXT, -- 'resume', 'replay', 'none'
    total_messages INTEGER DEFAULT 0,
    last_restoration_at TIMESTAMPTZ,
    working_directory TEXT,
    metadata JSONB DEFAULT '{}'
);
```

#### Implementation Architecture

```typescript
// Enhanced Claude Sandbox Executor with Persistence
export class ClaudeSandboxExecutor {
  
  async executeClaudeInSandbox(options: ClaudeSDKExecutionOptions): Promise<ClaudeSDKExecutionResult> {
    const isFirstMessage = await this.isFirstClaudeMessage(options.sessionId)
    
    // Attempt conversation restoration for returning users
    if (!isFirstMessage) {
      const restoration = await this.restoreConversationContext(
        options.sessionId, 
        workingDir, 
        claudeBinary, 
        apiKey
      )
      
      if (restoration.restored) {
        // Continue with restored context
        return this.executeWithRestoredContext(options, restoration)
      }
    }
    
    // Execute with appropriate Claude command
    const command = isFirstMessage 
      ? `claude -p --output-format json`  // Capture session ID
      : `claude -p --continue`            // Continue in working directory
      
    // Store conversation metadata and track restoration attempts
    await this.updateConversationMetadata(options.sessionId, restoration)
  }
  
  private async restoreConversationContext(
    sessionId: string, 
    workingDir: string, 
    claudeBinary: string, 
    apiKey: string
  ): Promise<RestorationResult> {
    
    // Strategy 1: Try Claude session resume
    const claudeSessionId = await this.getStoredClaudeSessionId(sessionId)
    if (claudeSessionId) {
      try {
        const resumeResult = await this.attemptClaudeResume(claudeSessionId, workingDir)
        if (resumeResult.success) {
          return { restored: true, method: 'resume', claudeSessionId }
        }
      } catch (error) {
        console.log('Claude session resume failed, trying replay method')
      }
    }
    
    // Strategy 2: Conversation replay with context restoration
    const conversationHistory = await this.getConversationHistory(sessionId)
    if (conversationHistory.length > 0) {
      const restorationPrompt = this.buildContextRestorationPrompt(conversationHistory)
      const replayResult = await this.executeContextRestoration(restorationPrompt, workingDir)
      
      if (replayResult.success) {
        return { 
          restored: true, 
          method: 'replay', 
          claudeSessionId: replayResult.newClaudeSessionId 
        }
      }
    }
    
    return { restored: false, method: 'none' }
  }
  
  private buildContextRestorationPrompt(messages: ChatMessage[]): string {
    const conversationHistory = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n')
    
    return `I'm returning to a previous conversation. Here's our conversation history:

${conversationHistory}

Please acknowledge that you understand the context and are ready to continue our work. Briefly summarize what we were working on.`
  }
}
```

#### Session Isolation & Multi-User Support

**Per-Session Working Directories:**
- Each PRIA session: `/home/user/session-{uuid}`
- Claude Code stores conversations per working directory
- `--continue` automatically continues most recent conversation in that directory
- Perfect isolation between users and sessions

**Database Integration:**
- All messages stored in `chat_messages` table with workspace isolation
- Claude session IDs tracked in session metadata
- Restoration attempts logged for debugging and analytics
- Complete audit trail of conversation persistence events

#### User Experience Flow

1. **New Session**: User starts → First message captures Claude session ID → Normal conversation flow
2. **User Leaves**: Session state preserved in database → E2B sandbox may timeout
3. **User Returns**: System detects returning session → Attempts restoration automatically
4. **Restoration Success**: Seamless continuation with "I understand our previous work on..."
5. **Restoration Failure**: Graceful fallback with conversation replay or fresh start
6. **Multi-Session**: Each session maintains independent conversation context

#### Error Recovery & Monitoring

```typescript
// Comprehensive restoration tracking
interface ConversationRestoration {
  session_id: string
  restoration_method: 'resume' | 'replay' | 'none'
  restoration_success: boolean
  restoration_duration_ms: number
  previous_claude_session_id?: string
  new_claude_session_id?: string
  error_details?: string
  conversation_turns_restored: number
}

// Database functions for restoration management
- update_claude_session_metadata()
- get_conversation_history_for_restoration()
- mark_conversation_restored()
```

#### Performance Considerations

- **Resume Strategy**: Instant continuation if Claude session exists (~100ms)
- **Replay Strategy**: Context restoration in 1-3 seconds depending on history length
- **Database Optimization**: Indexed queries on session ID and Claude session ID
- **Memory Management**: Conversation history truncated to last 50 messages for replay
- **E2B Sandbox Persistence**: Sandboxes cached in memory with smart cleanup

This conversation persistence system ensures users never lose context when returning to Builder App sessions, providing enterprise-grade reliability for continuous development workflows.

#### Enhanced Sub-Agent Orchestration
```typescript
// lib/claude-sdk/official-subagents-manager.ts
import { query } from '@anthropic-ai/claude-code'

export class OfficialSubAgentsManager {
  private subAgentConfigs: Map<string, SubAgentConfig> = new Map()

  async executeSubAgent(execution: SubAgentExecution): Promise<SubAgentResult> {
    const { subAgentName, prompt, sessionId, workspaceId, phase } = execution
    
    // Get phase-specific sub-agent configuration
    const subAgentConfig = this.selectSubAgentForTask(subAgentName, { phase })
    
    // Execute using official Claude Code SDK pattern
    const messages = []
    for await (const message of query(
      this.buildSubAgentPrompt(prompt, subAgentConfig),
      {
        maxTurns: 10,
        cwd: `/workspace/session-${sessionId}`,
        permissionMode: 'default',
        context: {
          workspace_id: workspaceId,
          session_id: sessionId,
          phase: phase,
          subagent: subAgentName
        }
      }
    )) {
      messages.push(message)
      
      // Real-time progress updates to Builder App
      await this.notifyBuilderApp(sessionId, {
        type: 'subagent_progress',
        subagent: subAgentName,
        message: message.content,
        timestamp: new Date().toISOString()
      })
    }
    
    return {
      success: true,
      messages,
      subAgentUsed: subAgentName,
      executionTime: Date.now() - execution.startTime,
      artifacts: this.extractArtifacts(messages)
    }
  }

  private selectSubAgentForTask(task: string, context: { phase?: number }): string {
    const phaseSubAgentMap = {
      1: 'requirements-analyst',
      2: 'architecture-expert', 
      3: 'implementation-planner',
      4: 'code-generator',
      5: 'qa-engineer',
      6: 'security-auditor',
      7: 'deployment-specialist'
    }
    
    return phaseSubAgentMap[context.phase || 1] || 'requirements-analyst'
  }
}
```

#### Real-time Streaming Integration
```typescript
// app/api/claude/stream/route.ts - Enhanced streaming with sub-agent support
export async function POST(request: NextRequest) {
  const { sessionId, prompt, subAgent, phase, workspaceId } = await request.json()
  
  // Validate session and workspace isolation
  const session = await validateSessionAndWorkspace(sessionId, workspaceId)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const targetAppPath = `/workspace/session-${sessionId}`
  
  // Create enhanced streaming response with sub-agent context
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const subAgentPrompt = await buildSubAgentPrompt(prompt, subAgent, phase)
        
        for await (const message of query(subAgentPrompt, {
          maxTurns: 10,
          cwd: targetAppPath,
          permissionMode: 'default',
          context: {
            workspace_id: workspaceId,
            session_id: sessionId,
            phase: phase,
            subagent: subAgent
          }
        })) {
          // Enhanced message with metadata
          const enhancedMessage = {
            ...message,
            metadata: {
              sessionId,
              workspaceId,
              subAgent,
              phase,
              timestamp: new Date().toISOString()
            }
          }
          
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify(enhancedMessage)}\n\n`
            )
          )
          
          // Update progress in database
          await updateSessionProgress(sessionId, {
            current_phase: phase,
            current_subagent: subAgent,
            last_message: message.content,
            updated_at: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Streaming error:', error)
        controller.error(error)
      } finally {
        controller.close()
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Session-ID': sessionId,
      'X-Workspace-ID': workspaceId
    }
  })
}
```

## 🐳 Enhanced E2B Sandbox Integration with Full File Creation Capabilities

### PRIA Custom Template v2.0.0 Integration with Sub-agent Support

The Builder App leverages the enhanced E2B custom template with **comprehensive Claude Code tooling**, **8 specialized sub-agents**, and **full file creation permissions** for production-ready development:

```typescript
// lib/e2b/optimized-sandbox-manager.ts
export class OptimizedE2BSandboxManager {
  async createSandbox(sessionId: string, metadata: Record<string, any> = {}): Promise<SandboxEnvironment> {
    console.log(`Creating optimized sandbox for session: ${sessionId}`)
    
    const sandbox = await Sandbox.create({
      template: 'pria-dev-env', // Custom template v2.0.0
      metadata: {
        session_id: sessionId,
        workspace_id: metadata.workspaceId,
        template_version: '2.0.0',
        created_at: new Date().toISOString()
      }
    })

    // Initialize PRIA project using custom template script
    const initResult = await this.initializePRIAProject(sandbox, sessionId, metadata)
    
    if (!initResult.success) {
      throw new Error(`Project initialization failed: ${initResult.error}`)
    }

    return {
      sandbox,
      sessionId,
      projectPath: `/home/user/workspace/session-${sessionId}`,
      templateVersion: '2.0.0',
      subAgentsConfigured: true,
      claudeSDKReady: true,
      fileCreationEnabled: true, // --dangerously-skip-permissions
      thoughtProcessStreaming: true,
      subAgentDetection: true,
      initializationResult: initResult
    }
  }

  private async initializePRIAProject(
    sandbox: Sandbox, 
    sessionId: string, 
    metadata: Record<string, any>
  ): Promise<InitializationResult> {
    
    const projectName = metadata.projectName || `pria-app-${sessionId.substring(0, 8)}`
    const projectDir = `/home/user/workspace/session-${sessionId}`
    
    // Use enhanced initialization script with all parameters
    const initCommand = [
      '/home/user/scripts/init-pria-project.sh',
      projectDir,
      projectName,
      metadata.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      metadata.workspaceId,
      sessionId
    ].join(' ')

    console.log(`Running initialization: ${initCommand}`)
    
    const result = await sandbox.process.startAndWait(initCommand)
    
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: `Initialization failed: ${result.stderr}`,
        logs: [result.stdout, result.stderr]
      }
    }

    // Validate initialization success
    const validationResult = await sandbox.process.startAndWait(
      'cd /home/user/workspace/session-' + sessionId + ' && npm run pria:validate'
    )

    return {
      success: validationResult.exitCode === 0,
      projectPath: projectDir,
      templateVersion: '2.0.0',
      subAgentsReady: true,
      claudeSDKConfigured: true,
      logs: [result.stdout, validationResult.stdout],
      validationResults: validationResult.stdout
    }
  }
}
```

### 🚀 Enhanced Capabilities Summary

#### File Creation & Modification Powers
- **Full Permissions**: Claude Code runs with `--dangerously-skip-permissions` flag
- **Real Code Generation**: Can create, modify, and manage actual project files
- **Production-Ready Output**: No more design-only responses - actual working applications

#### Sub-agent Transparency System
- **8 Specialized Sub-agents**: requirements-analyst, architecture-expert, code-generator, qa-engineer, security-auditor, deployment-specialist, performance-optimizer, implementation-planner
- **Intelligent Detection**: Keyword-based analysis identifies which sub-agent is handling each task
- **Real-time Visibility**: Users see exactly which specialist is working and why
- **Confidence Scoring**: Multi-keyword matching for reliable sub-agent identification

#### Thought Process Streaming
- **Real-time Updates**: Live streaming of Claude's decision-making process
- **Transparent Development**: Users see analysis, planning, and implementation steps
- **Progress Tracking**: Step-by-step visibility into code generation
- **Interactive Experience**: No more black-box waiting - engage with the development process

#### Enhanced User Experience
- **Split-screen Interface**: Chat on left, thought process on right
- **Sub-agent Indicators**: Beautiful visual indicators showing active specialists
- **Progress Visualization**: Real-time progress bars and status updates
- **Toggleable Views**: Users can show/hide thought process panel as needed

#### Critical PATH Configuration for Claude CLI Access
- **Multi-Layer PATH Setup**: Global environment variables, .bashrc, Python runtime, and shell scripts
- **E2B Sandbox Compatibility**: Claude CLI accessible via `/home/user/.npm-global/bin/claude`
- **Automatic PATH Detection**: Python API server automatically adds npm-global bin to PATH
- **Comprehensive Testing**: Template validation includes Claude CLI availability verification

## 🛠️ Claude CLI PATH Configuration Architecture

### Critical Finding: E2B PATH Requirements
During implementation, we discovered that Claude CLI installation and PATH configuration in E2B sandboxes requires a multi-layered approach due to how E2B provisions containers and manages process environments.

#### PATH Architecture Layers

**Layer 1: Dockerfile Global Environment**
```dockerfile
# Set PATH to include npm-global and user local bins (for all processes, not just bash)
ENV PATH="/home/user/.npm-global/bin:/home/user/.local/bin:$PATH"
```

**Layer 2: Shell Configuration (.bashrc)**
```bash
# npm-global bin path
echo 'export PATH=/home/user/.npm-global/bin:$PATH' >> /home/user/.bashrc

# Python local bin path  
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

**Layer 3: Python API Server Runtime PATH Detection**
```python
# Ensure Claude CLI is available in PATH for the Python process
current_path = os.environ.get('PATH', '')
npm_global_bin = os.path.join(home, '.npm-global', 'bin')
if npm_global_bin not in current_path:
    new_path = f"{npm_global_bin}:{current_path}"
    os.environ['PATH'] = new_path
    print(f"[CLAUDE API] Added npm-global bin to PATH: {npm_global_bin}")
```

**Layer 4: Shell Script PATH Export**
```bash
# Set up Python paths dynamically based on Python version
export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"
```

### Claude CLI Installation and Detection

#### Installation Location
- **Claude CLI Path**: `/home/user/.npm-global/bin/claude`
- **Installed via**: `npm install -g @anthropic-ai/claude-code@latest`
- **npm prefix**: `/home/user/.npm-global` (configured in E2B template)

#### Detection and Verification
```bash
# Test Claude CLI availability
echo "say hi" | claude -p
# Expected output: "Hi! How can I help you with your software engineering tasks today?"

# Check Claude CLI location
$(npm config get prefix)/bin/claude --version
# Expected: Claude CLI version information
```

#### Common PATH Issues and Solutions

**Issue 1: Claude CLI Not Found in PATH**
```bash
# Symptoms
which claude          # Returns: command not found
claude --version      # Returns: command not found

# Solution
export PATH="/home/user/.npm-global/bin:$PATH"
which claude          # Should now return: /home/user/.npm-global/bin/claude
```

**Issue 2: Python SDK Can't Find Claude CLI**
```python
# Symptoms: Python subprocess calls to 'claude' fail
subprocess.run(['claude', '--version'])  # FileNotFoundError

# Solution: Python API server automatically detects and fixes PATH
# See claude_api_server.py lines 21-48 for automatic PATH configuration
```

**Issue 3: E2B Container Environment Differences**
```bash
# E2B modifies environment after Docker build, so:
# 1. Dockerfile ENV sets global PATH
# 2. .bashrc sets interactive shell PATH  
# 3. Python API server detects and fixes runtime PATH
# 4. Shell scripts explicitly export PATH
```

### Validation and Testing

#### Template Validation Script
The E2B template includes comprehensive validation:
```bash
# Check required commands including Claude CLI
for cmd in node npm git claude; do
    if command -v $cmd >/dev/null 2>&1; then
        echo "✅ $cmd available"
        if [ "$cmd" = "claude" ]; then
            version=$(claude --version 2>/dev/null || echo "version check failed")
            echo "   Claude CLI version: $version"
        fi
    else
        echo "❌ $cmd missing"
        if [ "$cmd" = "claude" ]; then
            echo "   PATH: $PATH"
            echo "   Checking npm-global: $(ls -la /home/user/.npm-global/bin/ 2>/dev/null || echo 'directory not found')"
        fi
        errors=$((errors + 1))
    fi
done
```

#### Python API Server Startup Verification
```python
# Verify Claude CLI is accessible on startup
try:
    claude_test = subprocess.run(['claude', '--version'], capture_output=True, text=True, timeout=5)
    if claude_test.returncode == 0:
        print(f"[CLAUDE API] ✅ Claude CLI accessible: {claude_test.stdout.strip()}")
    else:
        print(f"[CLAUDE API] ❌ Claude CLI test failed: {claude_test.stderr}")
except Exception as e:
    print(f"[CLAUDE API] ❌ Claude CLI not found in PATH: {e}")
```

### Troubleshooting Guide

#### Debug Commands
```bash
# Check current PATH
echo $PATH

# Check npm configuration
npm config get prefix
npm config list

# Check Claude CLI installation
ls -la /home/user/.npm-global/bin/
ls -la /home/user/.npm-global/bin/claude

# Test Claude CLI directly
/home/user/.npm-global/bin/claude --version
$(npm config get prefix)/bin/claude --version

# Test with echo pipe
echo "test" | /home/user/.npm-global/bin/claude -p
```

#### Expected vs Actual Behavior
**Expected PATH**: `/home/user/.npm-global/bin:/home/user/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`

**Common Missing PATH**: `/home/user/.local/bin:/home/user/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
(Notice missing `/home/user/.npm-global/bin`)

#### Recovery Strategies
1. **Immediate Fix**: `export PATH="/home/user/.npm-global/bin:$PATH"`
2. **Python SDK Fix**: Automatic PATH detection in `claude_api_server.py`
3. **Template Rebuild**: Update E2B template with corrected Dockerfile ENV
4. **Runtime Installation**: Sandbox manager runtime setup ensures Claude CLI available

This multi-layered approach ensures Claude CLI is accessible regardless of how processes are started within the E2B sandbox environment.

## 🛡️ Critical Security Requirements (NON-NEGOTIABLE)

### Enhanced Workspace Tenancy Isolation
EVERY database interaction MUST include workspace-level filtering with comprehensive audit logging:

```typescript
// Enhanced security pattern with audit logging
export async function secureServerAction(formData: FormData) {
  const auditLog = new SecurityAuditLogger()
  
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      await auditLog.logSecurityEvent('authentication_required', { action: 'server_action' })
      return { error: 'Authentication required' }
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      await auditLog.logSecurityEvent('workspace_isolation_violation', { 
        user_id: user.id, 
        action: 'server_action' 
      })
      return { error: 'Workspace access denied' }
    }
    
    // MANDATORY workspace filtering with audit
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('workspace_id', workspaceId) // NON-NEGOTIABLE
      
    await auditLog.logDataAccess('table_query', {
      user_id: user.id,
      workspace_id: workspaceId,
      table: 'your_table',
      operation: 'select'
    })
    
    return { data, success: true }
    
  } catch (error) {
    await auditLog.logSecurityEvent('server_action_error', { error: error.message })
    return { error: 'Operation failed' }
  }
}
```

### Advanced Authentication with Session Management
```typescript
// Enhanced authentication with comprehensive session handling
export async function advancedAuthHandler() {
  const sessionManager = new EnhancedSessionManager()
  const securityValidator = new SecurityValidator()
  
  const session = await sessionManager.validateSession()
  if (!session.valid) {
    return { error: 'Session invalid or expired' }
  }
  
  const securityCheck = await securityValidator.validateWorkspaceAccess(
    session.user.id,
    session.workspace.id
  )
  
  if (!securityCheck.allowed) {
    await securityValidator.logSecurityViolation(securityCheck.violation)
    return { error: 'Access denied' }
  }
  
  return { 
    user: session.user, 
    workspace: session.workspace,
    permissions: securityCheck.permissions 
  }
}
```

## 🎨 Enhanced UI/UX Standards

### 🚫 **Critical React Anti-Patterns to Avoid**

#### **useEffect Dependency Loops - Zero Tolerance**
Never create useEffect hooks that depend on state they modify or cause cascading re-renders:

```typescript
// ❌ FORBIDDEN - Creates infinite loops and performance issues
useEffect(() => {
  if (isOpen) {
    loadData()
  }
}, [isOpen, currentWorkspace?.id, currentProject?.id]) // Dependencies cause loops

useEffect(() => {
  if (currentWorkspace && !workspaces.find(w => w.id === currentWorkspace.id)) {
    loadData() // This modifies state that triggers this effect
  }
}, [currentWorkspace, isOpen, workspaces])

// ✅ CORRECT - Single, predictable useEffect
useEffect(() => {
  if (isOpen) {
    loadData()
  }
}, [isOpen]) // Only depends on dialog open state
```

#### **Modern State Management Patterns**

**Controlled Data Loading Functions:**
```typescript
// ✅ CORRECT - Granular, explicit data loading
const loadWorkspaces = async () => {
  try {
    const response = await fetch('/api/workspaces')
    const { workspaces } = await response.json()
    setWorkspaces(workspaces || [])
    return workspaces
  } catch (error) {
    console.error('Failed to load workspaces:', error)
    throw error
  }
}

const loadProjectsForWorkspace = async (workspaceId: string) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
    
    if (error) throw error
    setProjects(data || [])
    return data
  } catch (error) {
    console.error('Failed to load projects:', error)
    throw error
  }
}

// Manual refresh methods
const refreshProjects = async () => {
  if (currentWorkspace) {
    await loadProjectsForWorkspace(currentWorkspace.id)
  }
}
```

**Event-Driven State Updates:**
```typescript
// ✅ CORRECT - Explicit, controlled state changes
const handleWorkspaceChange = async (workspace: Workspace) => {
  onWorkspaceChange(workspace)
  // Clear dependent state immediately
  setProjects([])
  setSessions([])
  // Load new data explicitly
  try {
    await loadProjectsForWorkspace(workspace.id)
  } catch (error) {
    setError('Failed to load projects')
  }
}

const handleProjectChange = async (project: Project) => {
  onProjectChange(project)
  // Clear dependent state immediately
  setSessions([])
  // Load new data explicitly
  try {
    await loadSessionsForProject(project.id)
  } catch (error) {
    setError('Failed to load sessions')
  }
}
```

#### **State Management Rules**

1. **One Effect Rule**: Maximum one useEffect per component for data loading
2. **Explicit Loading**: Use named functions for data operations, not effects
3. **Immediate State Clearing**: Clear dependent state before loading new data
4. **Error Boundaries**: Handle errors at each operation level
5. **Predictable Flow**: Data loading should be traceable and debuggable

#### **Performance Patterns**

**Debounced Operations:**
```typescript
// ✅ CORRECT - Debounced search with explicit state management
const [searchTerm, setSearchTerm] = useState('')
const [debouncedSearch, setDebouncedSearch] = useState('')

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchTerm)
  }, 300)
  return () => clearTimeout(timer)
}, [searchTerm])

// Trigger search when debounced value changes
useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch)
  }
}, [debouncedSearch])
```

**Memoization Patterns:**
```typescript
// ✅ CORRECT - Memoized computed values
const filteredSessions = useMemo(() => {
  return sessions.filter(({ session }) => {
    const matchesSearch = session.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter
    return matchesSearch && matchesStatus
  })
}, [sessions, searchTerm, statusFilter])

// ✅ CORRECT - Memoized callbacks to prevent re-renders
const handleSessionClick = useCallback((session: Session) => {
  onSessionChange(session)
  setIsOpen(false)
}, [onSessionChange])
```

### Advanced Component Patterns with Real-time Updates

#### Enhanced Loading States with Progress Tracking
```typescript
// Advanced loading states with detailed progress
export function AdvancedLoadingState({ 
  phase, 
  subAgent, 
  progress, 
  estimatedTimeRemaining 
}: LoadingStateProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {Math.round(progress)}%
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Phase {phase}: {getPhaseDisplayName(phase)}</h3>
              <Badge variant="secondary">{subAgent}</Badge>
            </div>
            <Progress value={progress} className="mb-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Working with {subAgent} sub-agent...</span>
              {estimatedTimeRemaining && (
                <span>~{formatDuration(estimatedTimeRemaining)} remaining</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### Comprehensive Error Handling with Recovery Options
```typescript
// Enhanced error handling with automatic recovery
export function EnhancedErrorDisplay({ 
  error, 
  recovery, 
  sessionId, 
  onRetry 
}: ErrorDisplayProps) {
  const [isRecovering, setIsRecovering] = useState(false)
  
  const handleAutoRecovery = async () => {
    setIsRecovering(true)
    try {
      await recovery.attemptRecovery(sessionId)
      onRetry?.()
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError)
    } finally {
      setIsRecovering(false)
    }
  }
  
  return (
    <Card className="border-destructive">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive mb-2">
              {error.category || 'An error occurred'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error.message}
            </p>
            {error.details && (
              <Collapsible>
                <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
                  View technical details
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            )}
            <div className="flex items-center space-x-2 mt-4">
              <Button onClick={onRetry} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              {recovery.canAutoRecover && (
                <Button 
                  onClick={handleAutoRecovery} 
                  variant="secondary" 
                  size="sm"
                  disabled={isRecovering}
                >
                  {isRecovering ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-2" />
                  )}
                  Auto Recover
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## 📚 Comprehensive Documentation Architecture

### Enhanced Cross-Application Documentation System

The PRIA system maintains sophisticated documentation across all components:

#### Builder App Documentation (Current Repository)
- **CLAUDE.md** (This File): Complete Builder App development guidelines and orchestration patterns
- **README.md**: Project overview, implementation status, and comprehensive getting started guide
- **PROJECT_CONTEXT.md**: Current implementation status, architectural decisions, and change log
- **REQUIREMENTS.md**: Complete technical specification, requirements tracking, and validation criteria

#### E2B Template Documentation (Target App Environment)
- **e2b-template/CLAUDE.md**: Comprehensive Target App development guidelines with PRIA compliance rules
- **e2b-template/TARGET_APP_SPECIFICATION_TEMPLATE.md**: Template for project specification documents
- **e2b-template/TEMPLATE_SPECIFICATION.md**: Complete template requirements and synchronization guide
- **TARGET_APP_SPECIFICATION.md**: Live document maintained by Claude Code SDK in each Target App

#### Advanced Documentation Workflow
1. **Builder App Context**: This CLAUDE.md provides complete Builder App development context and orchestration patterns
2. **Target App Initialization**: E2B template includes comprehensive Target App development guidelines and sub-agent configurations
3. **Project Specification**: Each Target App maintains detailed project specification with real-time updates
4. **Cross-Reference System**: All documents maintain references and dependencies for complete context preservation
5. **Version Synchronization**: Documentation versions are tracked and synchronized across all system components

#### Context Preservation Strategy
- **Builder App Sessions**: Maintain comprehensive workflow state, requirements database, and Target App references
- **Target App Projects**: Maintain TARGET_APP_SPECIFICATION.md with current implementation status and progress tracking
- **Documentation Sync**: Ensure Target App specifications reference current requirements and Builder App state
- **Session Recovery**: Use documentation system for complete context restoration across development sessions
- **Audit Trail**: Maintain complete documentation change history with version control and rollback capabilities

## 🚫 Forbidden Practices and Security Violations

### Critical Security Violations (Zero Tolerance)
- Missing workspace_id filters in any database queries
- Hardcoded API keys, secrets, or credentials in code or configuration
- Direct object references without proper authorization validation
- Client-side authentication logic or security validations
- Unvalidated user inputs or insufficient input sanitization
- Cross-workspace data access or tenant isolation violations

### Code Quality Violations (Automated Detection)
- Using `any` type in TypeScript without explicit justification
- Missing comprehensive error handling in async operations
- TODO comments, placeholder code, or incomplete implementations
- Console.log statements in production code paths
- Unused imports, variables, or dead code segments
- Missing TypeScript strict mode compliance

### Architecture Violations (Build Failures)
- Creating or modifying `components/ui/*` files (shadcn/ui is read-only)
- Direct database queries without proper Supabase client usage
- Missing authentication middleware for protected routes
- Inline styles instead of Tailwind CSS classes
- Non-responsive design patterns or mobile-unfriendly interfaces
- Violation of Builder App orchestration principles (generating Target App code directly)

## ✅ Comprehensive Success Checklist

### Enhanced Builder App Development Validation
Before deploying Builder App changes, verify:

- [x] **Enhanced Claude Code Integration**: Full file creation permissions with `--dangerously-skip-permissions`
- [x] **Sub-agent Transparency**: Detection, visibility, and real-time progress tracking
- [x] **Thought Process Streaming**: Live visibility into Claude's decision-making process
- [x] **Advanced UI Components**: SubAgentIndicator, ThoughtProcessStream, enhanced ChatInterface
- [x] **Real-time Communication**: Server-sent events with thought process callbacks
- [x] **Conversation Persistence**: 3-tier restoration strategy (resume/replay/fresh start)
- [x] **Session Management**: Claude session ID tracking and context preservation
- [x] **Streaming Architecture**: Enhanced API with sub-agent detection and emission
- [x] **Security Architecture**: Multi-tenant workspace isolation maintained and audited
- [x] **Documentation**: All documentation updated to reflect enhanced architecture

### Enhanced Target App Coordination Validation
Before completing enhanced Target App orchestration, verify:

- [x] **File Creation Capabilities**: Claude Code can create, modify, and manage actual files
- [x] **Sub-agent Configuration**: 8 specialized sub-agents properly configured in E2B template
- [x] **Debugging System**: Comprehensive sub-agent detection and logging
- [x] **Streaming Integration**: Real-time thought process emission throughout execution
- [x] **Clean Prompt Handling**: No system prompt injection - natural Claude Code orchestration
- [x] **Session Isolation**: Independent working directories with isolated Claude conversations
- [x] **Enhanced Authentication**: Full API key setup with environment variable security
- [x] **Production-Ready Output**: Actual working applications, not just designs
- [x] **Community Best Practices**: Integration patterns from claude-code-webui and claudeCO-webui
- [x] **Performance Optimization**: Efficient streaming with minimal latency

## 🗄️ Database Schema Management

### **CRITICAL: Single Source of Truth for Database Schema**

**AUTHORITATIVE SCHEMA LOCATION:**
```
/database-consolidated/pria-complete-schema.sql
```

This file is the **ONLY** authoritative source for database schema definitions. It consolidates and fixes all SQL files that were previously scattered across 4 different locations:

#### **Previous Fragmented Locations (NOW DEPRECATED):**
- ❌ `/builder-app/lib/database/schema.sql` - Basic core schema
- ❌ `/builder-app/supabase/migrations/*.sql` - Had invalid INDEX syntax  
- ❌ `/database/requirements-schema.sql` - Requirements management
- ❌ `/database/requirements-enhancement.sql` - Requirements enhancements
- ❌ `/database/migrations/*.sql` - Additional migrations

#### **Key Fixes Applied:**
1. **Fixed Invalid PostgreSQL INDEX Syntax** - Moved all inline INDEX definitions outside CREATE TABLE statements
2. **Added Missing Tables** - `workflow_sessions`, `workflow_artifacts`, `implementation_tasks`, `claude_interactions`
3. **Resolved Naming Inconsistencies** - `technical_specs` → `technical_specifications` with backward compatibility views
4. **Enhanced Security** - Consistent workspace isolation RLS policies across all tables
5. **Optimized Performance** - Comprehensive indexing strategy with composite and partial indexes

#### **Schema Features:**
- **Multi-tenant workspace isolation** with comprehensive RLS policies
- **7-phase workflow management** with cross-phase artifact tracking
- **Advanced requirements management** with lifecycle tracking, change history, comments, templates
- **Claude Code SDK integration** with subagent context preservation and artifact sharing
- **Conversation persistence system** with 3-tier restoration strategy (resume/replay/fresh start)
- **Claude session management** with dedicated tracking tables and restoration functions
- **Complete deployment pipeline** with environments, approvals, monitoring, rollback strategies
- **Comprehensive error recovery** with health monitoring, circuit breakers, and recovery strategies
- **GitHub integration** with encrypted token storage and sync tracking
- **Backward compatibility** with views for renamed tables and multiple status values

#### **Usage Instructions:**
1. **For New Deployments**: Use `/database-consolidated/pria-complete-schema.sql` directly
2. **For Existing Deployments**: Apply Claude session persistence enhancement:
   ```bash
   psql -d your_database -f database-consolidated/claude-session-persistence.sql
   ```
   **Note**: Migration uses `app_builder` schema as defined in the main schema file
3. **For Development**: Reference only the consolidated file - ignore all other SQL files
4. **For Schema Changes**: Update ONLY the consolidated file and deploy atomically
5. **For Rollback**: Use `database-consolidated/claude-session-persistence-rollback.sql` if needed

**⚠️ WARNING**: Do NOT use any SQL files outside `/database-consolidated/`. They contain syntax errors and are incomplete.

## 🎯 Development Priorities and Guidelines

Every technical decision should prioritize in this exact order:

1. **Security First**: Comprehensive authentication, authorization, workspace isolation, and data protection
2. **User Experience Second**: Intuitive, accessible, responsive interfaces with exceptional developer experience  
3. **Performance Third**: Fast loading times, efficient resource usage, and scalable architecture
4. **Maintainability Fourth**: Clean, well-documented, testable code with comprehensive error handling

This document serves as the definitive architectural guide for the PRIA App Builder system. Any deviation from these guidelines requires explicit architectural review, security impact assessment, and documentation approval.