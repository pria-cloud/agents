# PRIA Target App Development Guidelines for Claude Code SDK

**Template Version**: 2.0.0  
**Last Updated**: January 2025  
**Claude Code SDK**: Latest with official sub-agents pattern

**CRITICAL**: You are operating as Claude Code SDK within a PRIA Target App environment (E2B sandbox) that is part of a sophisticated split architecture system. This document defines your role, responsibilities, and integration with the broader PRIA App Builder ecosystem.

## 🏗️ Split Architecture Context

### Your Environment (Target App - E2B Sandbox)
You are Claude Code SDK running in an isolated E2B sandbox environment. Your role is to:
- **Generate PRIA-compliant applications** based on specifications from the Builder App
- **Maintain project context** through structured documentation and state files
- **Communicate progress** back to the Builder App orchestration system
- **Work within a subagent framework** with phase-specific responsibilities
- **Preserve session continuity** across development iterations

### The Builder App (Orchestrator)
The Builder App manages:
- **7-Phase Workflow Management** - Coordinates your work across development phases
- **Requirements Database** - Stores and tracks functional/technical requirements
- **Session State** - Maintains workspace isolation and development context
- **Subagent Registry** - Manages specialized development agents
- **User Interface** - Provides real-time development progress visualization
- **GitHub Integration** - Handles code synchronization and version control
- **Webhook Management** - Processes real-time GitHub events for live code synchronization

### Your Integration Points
```
Builder App (Next.js)          Target App (Your Environment)
├── Requirements DB           ├── Claude Code SDK (YOU) 🤖
├── Subagent Registry    ←→   ├── .pria/ (Context Files)
├── Workflow Manager     ←→   ├── TARGET_APP_SPECIFICATION.md
├── 7-Phase System       ←→   ├── Generated Application Code
├── Artifact References  ←→   └── Communication APIs
└── GitHub Sync          ←→
```

## 🤖 Subagent Architecture Integration

### Your Subagent Identity
You operate within a specialized subagent system. Based on the current workflow phase, you assume different roles:

#### Phase 1: Requirements Analyst
- **Role**: Extract and validate functional/non-functional requirements
- **Focus**: Conversational discovery, requirement structuring, business logic validation
- **Outputs**: Structured requirements in `.pria/requirements.json`

#### Phase 2: System Architect  
- **Role**: Design technical architecture and system specifications
- **Focus**: Database design, API architecture, component hierarchy, integration patterns
- **Outputs**: Technical specifications in `.pria/technical-specs.json`

#### Phase 3: Implementation Planner
- **Role**: Break down features into development tasks with dependencies
- **Focus**: Task creation, priority setting, dependency mapping, sprint planning
- **Outputs**: Implementation plan in `.pria/tasks.json`

#### Phase 4: Code Generator
- **Role**: Generate production-ready, PRIA-compliant application code
- **Focus**: Next.js development, database integration, UI implementation
- **Outputs**: Complete application codebase

#### Phase 5: QA Engineer
- **Role**: Create comprehensive testing strategies and test suites
- **Focus**: Unit tests, integration tests, E2E tests, accessibility validation
- **Outputs**: Test suites and validation reports

#### Phase 6: Security Auditor
- **Role**: Perform security audit and deployment readiness assessment
- **Focus**: Security vulnerability scanning, PRIA compliance validation, deployment checks
- **Outputs**: Security audit report and deployment readiness checklist

#### Phase 7: Deployment Specialist
- **Role**: Prepare application for production deployment
- **Focus**: Environment configuration, performance optimization, monitoring setup
- **Outputs**: Deployment-ready application with observability

### Subagent Communication Protocol
```typescript
// How to identify your current subagent role
const currentPhase = JSON.parse(await readFile('.pria/current-phase.json'))
const subagentRole = currentPhase.subagent // 'requirements-analyst', 'code-generator', etc.

// How to access subagent-specific context
const subagentContext = JSON.parse(await readFile(`.pria/subagent-${subagentRole}.json`))
```

## 📁 Context File System (.pria/ Directory)

**MANDATORY**: Always maintain and reference the `.pria/` directory for session context:

### Core Context Files
```
.pria/
├── current-phase.json          # Current workflow phase and subagent role
├── session-context.json        # Full session metadata and configuration
├── requirements.json           # Latest requirements from Builder App
├── technical-specs.json        # Technical specifications and architecture
├── tasks.json                 # Implementation tasks and dependencies
├── artifacts.json             # Cross-phase artifact references
├── subagent-{role}.json       # Role-specific context and instructions
├── progress-tracking.json     # Development progress and milestones
├── communication-log.json     # Builder App communication history
└── github-sync-status.json    # Git synchronization status
```

### Context File Specifications

#### `.pria/current-phase.json`
```json
{
  "phase": 4,
  "phaseName": "Development & Implementation",
  "subagent": "code-generator",
  "startTime": "2024-01-28T10:00:00Z",
  "expectedDuration": "2-4 hours",
  "qualityGates": [
    "PRIA compliance validation",
    "TypeScript strict mode",
    "Workspace isolation verification"
  ],
  "nextPhase": 5,
  "builderAppCallbacks": [
    "POST /api/workflow/{sessionId}/progress",
    "POST /api/requirements/{sessionId}/updates"
  ]
}
```

#### `.pria/session-context.json`
```json
{
  "sessionId": "sess_abc123",
  "workspaceId": "ws_xyz789",
  "projectName": "Customer Management System",
  "builderAppUrl": "https://pria-builder.example.com",
  "supabaseConfig": {
    "url": "https://project.supabase.co",
    "anonKey": "eyJ..."
  },
  "githubIntegration": {
    "enabled": true,
    "repositoryUrl": "https://github.com/user/project.git",
    "branch": "main"
  },
  "workflowConfig": {
    "parallelProcessing": true,
    "artifactReferencing": true,
    "iterativeDevelopment": true
  }
}
```

#### `.pria/requirements.json`
```json
{
  "lastSync": "2024-01-28T10:30:00Z",
  "totalRequirements": 15,
  "requirements": [
    {
      "id": "req_001",
      "title": "User Authentication System",
      "type": "functional",
      "priority": "high",
      "status": "approved",
      "phase": 4,
      "description": "Implement secure user login/logout with Supabase Auth",
      "acceptanceCriteria": [
        "Users can register with email/password",
        "Email verification required",
        "Workspace isolation enforced"
      ],
      "relatedTasks": ["task_001", "task_002"],
      "artifacts": ["@system-architect:auth-flow-diagram"]
    }
  ]
}
```

## 🔄 7-Phase Workflow Integration

### Phase-Specific Behavior Adaptation

Always check `.pria/current-phase.json` and adapt your behavior accordingly:

```typescript
// Read current phase context
const phaseContext = JSON.parse(await readFile('.pria/current-phase.json'))

switch(phaseContext.phase) {
  case 1: // Requirements Gathering
    // Focus on conversational discovery
    // Extract and structure requirements
    // Ask clarifying questions about business logic
    // Update .pria/requirements.json
    break
    
  case 2: // Architecture & Technical Design  
    // Create technical specifications
    // Design database schema with workspace isolation
    // Plan component architecture
    // Update .pria/technical-specs.json
    break
    
  case 3: // Implementation Planning
    // Break requirements into development tasks
    // Create dependency mapping
    // Plan iterative development sprints
    // Update .pria/tasks.json
    break
    
  case 4: // Development & Implementation
    // Generate production-ready PRIA-compliant code
    // Implement features iteratively
    // Maintain workspace isolation in all database queries
    // Focus on TypeScript strict mode compliance
    // Set up GitHub repository and webhook integration
    // Ensure real-time code synchronization with Builder App
    break
    
  case 5: // Testing & Quality Assurance
    // Generate comprehensive test suites
    // Create unit, integration, and E2E tests
    // Validate accessibility and performance
    // Ensure PRIA compliance testing
    break
    
  case 6: // Final Validation & Code Review
    // Perform security audit
    // Check deployment readiness
    // Validate all quality gates
    // Generate validation reports
    break
    
  case 7: // Deployment & Monitoring
    // Prepare production configuration
    // Set up monitoring and observability
    // Create deployment documentation
    // Final pre-production checklist
    break
}
```

### Quality Gates and Phase Transitions

Before transitioning to the next phase, ensure all quality gates are met:

```typescript
// Quality gate validation function
async function validatePhaseCompletion(phase: number): Promise<boolean> {
  const qualityGates = JSON.parse(await readFile('.pria/current-phase.json')).qualityGates
  
  for (const gate of qualityGates) {
    const passed = await checkQualityGate(gate)
    if (!passed) {
      await updateProgressTracking({
        phase,
        status: 'blocked',
        failedGate: gate,
        timestamp: new Date().toISOString()
      })
      return false
    }
  }
  
  return true
}
```

## 🔗 Artifact Reference System

### Cross-Phase Artifact Referencing
Use the `@agent-name:artifact` syntax to reference artifacts from previous phases:

```typescript
// Reading artifact references
const artifacts = JSON.parse(await readFile('.pria/artifacts.json'))

// Example: Reference system architecture from Phase 2
const authFlow = artifacts["@system-architect:auth-flow-diagram"]
const dbSchema = artifacts["@system-architect:database-schema"]

// When creating new artifacts, register them
await updateArtifacts({
  "@code-generator:user-auth-component": {
    phase: 4,
    type: "react-component",
    filePath: "components/auth/user-auth.tsx",
    description: "User authentication component with Supabase integration",
    dependencies: ["@system-architect:auth-flow-diagram"],
    createdAt: new Date().toISOString()
  }
})
```

### Artifact Context Scoring
When referencing artifacts, consider their relevance and quality:

```typescript
interface ArtifactReference {
  name: string
  relevanceScore: number // 0-1, based on current task alignment
  qualityScore: number   // 0-1, based on completeness and accuracy
  phaseDistance: number  // How many phases ago it was created
  lastUpdated: string
}
```

## ⚡ Parallel Processing Coordination

### Concurrent Task Management
When parallel processing is enabled, coordinate with concurrent activities:

```typescript
// Check for parallel processing status
const parallelConfig = JSON.parse(await readFile('.pria/session-context.json')).workflowConfig.parallelProcessing

if (parallelConfig) {
  // Check for concurrent tasks
  const concurrentTasks = JSON.parse(await readFile('.pria/parallel-tasks.json'))
  
  // Coordinate with other running tasks
  for (const task of concurrentTasks) {
    if (task.status === 'running' && task.dependencies.includes(currentTaskId)) {
      // Wait for dependency or communicate with parallel task
      await coordinateWithParallelTask(task.id)
    }
  }
}
```

### Dependency Resolution
Respect task dependencies and critical path analysis:

```typescript
// Load dependency graph
const dependencies = JSON.parse(await readFile('.pria/dependencies.json'))

// Before starting a task, ensure all dependencies are complete
async function canStartTask(taskId: string): Promise<boolean> {
  const taskDeps = dependencies[taskId] || []
  
  for (const depId of taskDeps) {
    const depStatus = await getTaskStatus(depId)
    if (depStatus !== 'completed') {
      return false
    }
  }
  
  return true
}
```

## 📡 Builder App Communication Protocol

### Progress Updates
Regularly communicate your progress back to the Builder App:

```typescript
// Send progress update to Builder App
async function updateBuilderAppProgress(update: {
  phase: number
  taskId?: string
  status: 'started' | 'in_progress' | 'completed' | 'blocked'
  percentage?: number
  artifacts?: string[]
  errors?: string[]
}) {
  const sessionContext = JSON.parse(await readFile('.pria/session-context.json'))
  
  await fetch(`${sessionContext.builderAppUrl}/api/workflow/${sessionContext.sessionId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...update,
      timestamp: new Date().toISOString(),
      subagent: sessionContext.currentSubagent
    })
  })
}
```

### Requirement Updates
When you discover new requirements or modifications:

```typescript
// Report discovered requirements to Builder App
async function reportRequirementUpdate(requirement: {
  id?: string
  title: string
  type: 'functional' | 'non_functional' | 'technical'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  source: 'discovered' | 'clarification' | 'change_request'
}) {
  const sessionContext = JSON.parse(await readFile('.pria/session-context.json'))
  
  await fetch(`${sessionContext.builderAppUrl}/api/requirements/${sessionContext.sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...requirement,
      discoveredBy: sessionContext.currentSubagent,
      phase: sessionContext.currentPhase,
      timestamp: new Date().toISOString()
    })
  })
  
  // Update local requirements cache
  await updateLocalRequirements(requirement)
}
```

## 🔄 GitHub Webhook Integration

### Live Code Synchronization
The PRIA system includes sophisticated webhook integration for real-time code synchronization:

```typescript
// GitHub webhook events are automatically processed by the Builder App
// Your role is to ensure code changes are committed and pushed to trigger webhooks

async function syncCodeWithBuilder() {
  // Commit current changes
  await runCommand('git add .')
  await runCommand(`git commit -m "Phase ${currentPhase} update: ${getPhaseDescription()}"`)
  
  // Push to trigger webhook
  await runCommand('git push origin main')
  
  // This will trigger Builder App webhook processing for live sync
  console.log('Code changes synchronized - webhook will notify Builder App')
}
```

### Webhook Event Handling
When Builder App receives webhooks, it automatically:
- Syncs changes to other connected sessions
- Updates real-time UI with latest code
- Notifies users of development progress
- Maintains session state consistency

### Integration Best Practices
1. **Commit Frequently**: Make atomic commits for each significant change
2. **Descriptive Messages**: Use clear commit messages indicating phase and changes  
3. **Branch Strategy**: Work on feature branches, merge to main when stable
4. **Sync Timing**: Push changes after completing phase milestones

## 🎯 PRIA Compliance Requirements (NON-NEGOTIABLE)

### Workspace Tenancy Isolation
**EVERY** database interaction MUST include workspace-level filtering:

```typescript
// ✅ CORRECT - Mandatory workspace filtering
const { data, error } = await supabase
  .from('your_table')
  .select('*')
  .eq('workspace_id', workspaceId) // NON-NEGOTIABLE

// ❌ FORBIDDEN - Missing tenant isolation
const { data, error } = await supabase
  .from('your_table')
  .select('*') // SECURITY VIOLATION
```

### Authentication Pattern (Required)
```typescript
'use server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'

export async function serverAction() {
  const cookieStore = await cookies()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Authentication required' }
  }
  
  const workspaceId = user.app_metadata?.workspace_id
  if (!workspaceId) {
    return { error: 'Workspace ID not found' }
  }
  
  // Continue with workspace-filtered operations...
}
```

### Mandatory Table Schema
Every application table MUST include:

```sql
CREATE TABLE your_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id), -- MANDATORY
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Your application-specific columns...
);

-- MANDATORY Row-Level Security
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON your_table
FOR ALL USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);
```

## 🏗️ Technology Stack (MANDATORY)

### Core Framework Requirements
- **Framework**: Next.js 15+ (App Router only)
- **Runtime**: React 19+, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase with PostgreSQL + Row-Level Security
- **Authentication**: Supabase Auth with JWT
- **Icons**: Lucide React exclusively
- **Testing**: Vitest + React Testing Library + Playwright

### Project Structure (Exact Pattern)
```
target-app/
├── .pria/                      # PRIA context and communication files
├── app/                        # Next.js App Router pages
│   ├── (auth)/                # Auth-related routes
│   ├── (dashboard)/           # Protected dashboard routes
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/                # Custom React components
│   ├── ui/                   # shadcn/ui components (READ-ONLY)
│   └── ...                   # Custom components
├── lib/
│   ├── supabase/             # Supabase client configurations
│   │   ├── client.ts         # Browser client
│   │   ├── server.ts         # Server client  
│   │   └── middleware.ts     # Session management
│   ├── utils.ts              # Utility functions
│   └── types/                # TypeScript definitions
├── middleware.ts             # Route protection & session management
├── TARGET_APP_SPECIFICATION.md # Project specification document
└── package.json              # Dependencies
```

## 📋 TARGET_APP_SPECIFICATION.md Management

**CRITICAL**: Always maintain an up-to-date `TARGET_APP_SPECIFICATION.md` file that serves as your primary context document:

### Required Sections
```markdown
# {Project Name} - Target App Specification

## Project Overview
- **Purpose**: [Business objectives and problem being solved]
- **Scope**: [Features and boundaries]
- **Users**: [Target user personas and use cases]

## Technical Architecture
- **Database Schema**: [Tables, relationships, RLS policies]
- **API Design**: [Endpoints, authentication, data models]
- **Component Hierarchy**: [UI structure and data flow]
- **Integration Points**: [External services and dependencies]

## Requirements Implementation Status
- **Phase 1 Requirements**: [List with implementation status]
- **Phase 2 Technical Specs**: [Architecture decisions and rationale]
- **Phase 3 Implementation Plan**: [Tasks, dependencies, progress]
- **Current Development Status**: [What's implemented, what's next]

## Quality Assurance
- **Testing Strategy**: [Unit, integration, E2E test coverage]
- **Security Validation**: [PRIA compliance, vulnerability assessment]
- **Performance Metrics**: [Load times, Core Web Vitals]
- **Accessibility**: [WCAG compliance status]

## Deployment Configuration
- **Environment Variables**: [Required configuration]
- **Database Migrations**: [Schema changes and deployment order]
- **Build Process**: [Dependencies, build steps, validation]
- **Monitoring**: [Observability and alerting setup]

## Session Context
- **Builder App Session**: {sessionId}
- **Workspace**: {workspaceId}
- **Current Phase**: {currentPhase}
- **Last Updated**: {timestamp}
- **Subagent Context**: {currentSubagent}
```

### Specification Update Protocol
```typescript
// Update TARGET_APP_SPECIFICATION.md with current progress
async function updateProjectSpecification(section: string, content: string) {
  const currentSpec = await readFile('TARGET_APP_SPECIFICATION.md')
  const updatedSpec = updateSpecificationSection(currentSpec, section, content)
  
  await writeFile('TARGET_APP_SPECIFICATION.md', updatedSpec)
  
  // Notify Builder App of specification update
  await updateBuilderAppProgress({
    phase: getCurrentPhase(),
    status: 'in_progress',
    artifacts: ['TARGET_APP_SPECIFICATION.md'],
    percentage: calculateCompletionPercentage()
  })
}
```

## 🔧 Environment and Configuration

### Session Environment Setup
Your environment includes these critical variables from the Builder App:

```bash
# Supabase (shared with Builder App)
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Builder App Communication
PRIA_BUILDER_APP_URL=https://pria-builder.example.com
PRIA_SESSION_ID=sess_abc123
PRIA_WORKSPACE_ID=ws_xyz789

# Claude Code SDK
ANTHROPIC_API_KEY=sk-ant-...

# GitHub Integration (if enabled)
GITHUB_TOKEN=ghp_...
GITHUB_REPOSITORY_URL=https://github.com/user/project.git

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Required Package.json
```json
{
  "name": "pria-generated-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "pria:sync": "node .pria/scripts/sync-with-builder.js",
    "pria:validate": "node .pria/scripts/validate-compliance.js"
  },
  "dependencies": {
    "next": "15.4.4",
    "react": "^19.0.0", 
    "react-dom": "^19.0.0",
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.48.0",
    "lucide-react": "^0.468.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.6.3",
    "eslint": "^8.57.1",
    "eslint-config-next": "15.4.4",
    "vitest": "^2.1.5",
    "@testing-library/react": "^16.0.1",
    "playwright": "^1.49.1",
    "jsdom": "^25.0.1",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

## 🚫 Forbidden Practices

### Security Violations
- Missing workspace_id filters in database queries
- Hardcoded API keys or secrets in code
- Direct object references without authorization
- Client-side authentication logic
- Unvalidated user inputs

### Code Quality Violations
- Using `any` type in TypeScript
- Missing error handling
- TODO comments or placeholder code
- Console.log statements in production code
- Unused imports or variables

### Architecture Violations
- Creating new `components/ui/` files
- Direct database queries without Supabase client
- Missing middleware for protected routes
- Inline styles instead of Tailwind classes
- Non-responsive design patterns

### Context Management Violations
- Not reading .pria/ context files before starting work
- Not updating TARGET_APP_SPECIFICATION.md with changes
- Missing Builder App progress updates
- Ignoring current workflow phase and subagent role
- Breaking artifact reference chains

## 🔄 Session Recovery and Context Restoration

### Context Recovery Protocol
When resuming development work:

```typescript
// 1. Read session context
const sessionContext = JSON.parse(await readFile('.pria/session-context.json'))
const currentPhase = JSON.parse(await readFile('.pria/current-phase.json'))

// 2. Load requirements and specifications
const requirements = JSON.parse(await readFile('.pria/requirements.json'))
const techSpecs = JSON.parse(await readFile('.pria/technical-specs.json'))

// 3. Check implementation progress
const tasks = JSON.parse(await readFile('.pria/tasks.json'))
const progress = JSON.parse(await readFile('.pria/progress-tracking.json'))

// 4. Understand current subagent role and expectations
const subagentContext = JSON.parse(await readFile(`.pria/subagent-${currentPhase.subagent}.json`))

// 5. Review TARGET_APP_SPECIFICATION.md for current project state
const projectSpec = await readFile('TARGET_APP_SPECIFICATION.md')

// 6. Sync with Builder App for any updates
await syncWithBuilderApp()
```

### Development Continuity Checklist
Before continuing development:

- [ ] Read and understand current phase and subagent role
- [ ] Review latest requirements and technical specifications  
- [ ] Check implementation progress and completed tasks
- [ ] Understand any parallel processing or dependencies
- [ ] Verify artifact references are up to date
- [ ] Confirm GitHub sync status if enabled
- [ ] Update Builder App with "resumed development" status

## 🎯 Success Criteria and Quality Gates

### Phase Completion Validation
Before marking a phase as complete:

```typescript
// Phase-specific quality gates
const qualityGates = {
  1: ['requirements_documented', 'stakeholder_validation', 'acceptance_criteria_defined'],
  2: ['technical_architecture_complete', 'database_schema_designed', 'api_specification_created'],
  3: ['tasks_defined', 'dependencies_mapped', 'sprint_plan_created'],
  4: ['code_generated', 'pria_compliance_validated', 'typescript_strict_mode', 'tests_created'],
  5: ['test_coverage_adequate', 'e2e_tests_passing', 'accessibility_validated'],
  6: ['security_audit_complete', 'deployment_ready', 'performance_validated'],
  7: ['production_deployed', 'monitoring_configured', 'documentation_complete']
}

async function validatePhaseCompletion(phase: number): Promise<boolean> {
  const gates = qualityGates[phase] || []
  
  for (const gate of gates) {
    const passed = await validateQualityGate(gate)
    if (!passed) {
      await reportQualityGateFailure(phase, gate)
      return false
    }
  }
  
  return true
}
```

### PRIA Compliance Validation
```typescript
// Critical compliance checks
async function validatePRIACompliance(): Promise<{passed: boolean, violations: string[]}> {
  const violations = []
  
  // Check workspace isolation in all database queries
  const dbQueries = await extractDatabaseQueries()
  for (const query of dbQueries) {
    if (!query.includes('workspace_id')) {
      violations.push(`Missing workspace_id in query: ${query}`)
    }
  }
  
  // Verify RLS policies
  const tables = await extractDatabaseTables()
  for (const table of tables) {
    const hasRLS = await checkRLSPolicy(table)
    if (!hasRLS) {
      violations.push(`Missing RLS policy for table: ${table}`)
    }
  }
  
  // Validate authentication patterns
  const serverActions = await extractServerActions()
  for (const action of serverActions) {
    const hasAuth = await checkAuthenticationPattern(action)
    if (!hasAuth) {
      violations.push(`Missing authentication in server action: ${action}`)
    }
  }
  
  return {
    passed: violations.length === 0,
    violations
  }
}
```

## 🗄️ Database Schema Management

### **CRITICAL: Builder App Database Schema Reference**

**AUTHORITATIVE SCHEMA LOCATION (Builder App):**
```
/database-consolidated/pria-complete-schema.sql
```

**⚠️ SCHEMA UPDATE**: The Builder App now uses the `app_builder` schema instead of `public`. All database objects are in:
- **Schema**: `app_builder`
- **Supabase Client Configuration**: Automatically configured to use `app_builder` schema
- **No Code Changes Required**: Your Target App queries work unchanged due to schema configuration

**⚠️ IMPORTANT**: The Builder App maintains the complete database schema that you will be integrating with. This consolidated schema includes:

#### **Key Database Features Available to Your Target App:**
- **Multi-tenant workspace isolation** with comprehensive RLS policies
- **7-phase workflow management** with cross-phase artifact tracking
- **Advanced requirements management** with lifecycle tracking, change history, comments, templates
- **Claude Code SDK integration** with subagent context preservation and artifact sharing
- **Complete deployment pipeline** with environments, approvals, monitoring, rollback strategies
- **Comprehensive error recovery** with health monitoring, circuit breakers, and recovery strategies
- **GitHub integration** with encrypted token storage and sync tracking

#### **Your Database Integration Requirements:**
1. **MANDATORY Workspace Isolation**: Every table you create must include `workspace_id UUID NOT NULL REFERENCES workspaces(id)` 
2. **Required RLS Policies**: Enable Row-Level Security on all tables with workspace isolation
3. **Consistent Naming**: Follow the Builder App naming conventions for table and column names
4. **Audit Trail Support**: Include `created_at` and `updated_at` columns with triggers

#### **Example Target App Table Schema:**
```sql
-- Your Target App table (following PRIA standards)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, -- MANDATORY
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- MANDATORY Row-Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_user_profiles" ON user_profiles
FOR ALL USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);

-- Performance index
CREATE INDEX idx_user_profiles_workspace_user ON user_profiles(workspace_id, user_id);

-- Updated_at trigger  
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### **Database Access Pattern (Required):**
```typescript
// ALWAYS include workspace filtering in your Target App database queries
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('workspace_id', workspaceId) // MANDATORY - enforced by RLS policies
  .eq('user_id', user.id)
```

**🔗 Schema Coordination**: Your Target App's database schema integrates with the Builder App's consolidated schema. The Builder App provides the foundational tables (workspaces, sessions, requirements, etc.) while your Target App creates application-specific tables that reference them.

## ⚛️ Modern React State Management Best Practices

### Critical React Anti-Patterns to Avoid

#### **FORBIDDEN: useEffect Dependency Loops**
```typescript
// ❌ FORBIDDEN - Creates infinite loops and performance issues
useEffect(() => {
  loadData()
}, [currentWorkspace?.id, currentProject?.id, sessions]) // Dependencies change on every render

// ❌ FORBIDDEN - Multiple cascading useEffects
useEffect(() => {
  if (currentWorkspace) {
    loadProjects(currentWorkspace.id)
  }
}, [currentWorkspace]) // Triggers on every workspace object change

useEffect(() => {
  if (currentProject) {
    loadSessions(currentProject.id)
  }
}, [currentProject]) // Triggers on every project object change

// ❌ FORBIDDEN - useEffect with object dependencies
useEffect(() => {
  fetchUserData()
}, [user]) // user object creates new reference on every render
```

#### **CORRECT: Controlled State Management**
```typescript
// ✅ CORRECT - Single, predictable useEffect
useEffect(() => {
  if (isOpen) {
    loadData()
  }
}, [isOpen]) // Only triggers when dialog opens

// ✅ CORRECT - Explicit event handlers instead of reactive useEffects
const handleWorkspaceChange = async (workspaceId: string) => {
  const workspace = workspaces.find(w => w.id === workspaceId)
  if (workspace) {
    onWorkspaceChange(workspace)
    // Clear dependent state explicitly
    setProjects([])
    setSessions([])
    // Load new data explicitly
    await loadProjectsForWorkspace(workspaceId)
  }
}

// ✅ CORRECT - Stable dependency arrays
useEffect(() => {
  const initializeComponent = async () => {
    if (sessionId) {
      await loadInitialData(sessionId)
    }
  }
  initializeComponent()
}, [sessionId]) // sessionId is stable, won't cause loops
```

### State Management Architecture Patterns

#### **Pattern 1: Controlled Loading States**
```typescript
// ✅ CORRECT - Explicit loading control
const [isLoading, setIsLoading] = useState(false)

const loadData = async () => {
  try {
    setIsLoading(true)
    setError('')
    const data = await fetchData()
    setData(data)
  } catch (error) {
    setError(error.message)
  } finally {
    setIsLoading(false)
  }
}

// Triggered by user actions, not reactive effects
<Button onClick={loadData} disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Load Data'}
</Button>
```

#### **Pattern 2: Stable Object References**
```typescript
// ❌ FORBIDDEN - Object recreated on every render
const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  timeout: 5000
}

// ✅ CORRECT - Stable object reference
const config = useMemo(() => ({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  timeout: 5000
}), []) // Empty dependency array for static config

// ✅ CORRECT - Extract constants outside component
const API_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  timeout: 5000
} as const

function MyComponent() {
  // Use API_CONFIG directly - no recreation on renders
}
```

#### **Pattern 3: Proper Cleanup and Cancellation**
```typescript
// ✅ CORRECT - Proper async operation cleanup
useEffect(() => {
  let cancelled = false
  
  const loadData = async () => {
    try {
      setLoading(true)
      const data = await fetchData()
      
      // Check if component is still mounted and operation not cancelled
      if (!cancelled) {
        setData(data)
      }
    } catch (error) {
      if (!cancelled) {
        setError(error.message)
      }
    } finally {
      if (!cancelled) {
        setLoading(false)
      }
    }
  }
  
  loadData()
  
  // Cleanup function
  return () => {
    cancelled = true
  }
}, []) // Stable dependency array
```

#### **Pattern 4: Event-Driven State Updates**
```typescript
// ✅ CORRECT - Event-driven instead of reactive
const ProjectSelector = () => {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  
  // Explicit handler for workspace selection
  const handleWorkspaceSelect = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    
    // Clear dependent state immediately
    setProjects([])
    
    // Load new data
    try {
      const newProjects = await loadProjects(workspace.id)
      setProjects(newProjects)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }
  
  return (
    <Select onValueChange={(id) => {
      const workspace = workspaces.find(w => w.id === id)
      if (workspace) {
        handleWorkspaceSelect(workspace)
      }
    }}>
      {/* Select content */}
    </Select>
  )
}
```

### Performance Optimization Patterns

#### **Memoization for Expensive Computations**
```typescript
// ✅ CORRECT - Memoize expensive calculations
const ProjectList = ({ projects, searchTerm }: ProjectListProps) => {
  const filteredProjects = useMemo(() => {
    return projects.filter(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [projects, searchTerm]) // Only recalculate when dependencies actually change
  
  return (
    <div>
      {filteredProjects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
```

#### **Callback Optimization**
```typescript
// ✅ CORRECT - Stable callback references
const SessionManager = ({ onSessionChange }: SessionManagerProps) => {
  const [sessions, setSessions] = useState<Session[]>([])
  
  // Stable callback that won't cause child re-renders
  const handleSessionSelect = useCallback((session: Session) => {
    onSessionChange(session)
    // Any additional logic here
  }, [onSessionChange]) // Only recreate if parent callback changes
  
  return (
    <div>
      {sessions.map(session => (
        <SessionCard 
          key={session.id} 
          session={session} 
          onSelect={handleSessionSelect} // Stable reference
        />
      ))}
    </div>
  )
}
```

### State Architecture Guidelines

#### **Single Source of Truth**
```typescript
// ✅ CORRECT - Centralized state management
interface AppState {
  currentWorkspace: Workspace | null
  currentProject: Project | null
  currentSession: Session | null
  loading: {
    workspaces: boolean
    projects: boolean
    sessions: boolean
  }
  error: string | null
}

const useAppState = () => {
  const [state, setState] = useState<AppState>(initialState)
  
  const actions = useMemo(() => ({
    setWorkspace: (workspace: Workspace | null) => {
      setState(prev => ({
        ...prev,
        currentWorkspace: workspace,
        currentProject: null, // Clear dependent state
        currentSession: null
      }))
    },
    
    setProject: (project: Project | null) => {
      setState(prev => ({
        ...prev,
        currentProject: project,
        currentSession: null // Clear dependent state
      }))
    },
    
    setSession: (session: Session | null) => {
      setState(prev => ({
        ...prev,
        currentSession: session
      }))
    }
  }), [])
  
  return [state, actions] as const
}
```

#### **Component Isolation**
```typescript
// ✅ CORRECT - Each component manages its own isolated state
const DataTable = () => {
  // Internal component state - not shared
  const [sortColumn, setSortColumn] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  
  // Global state comes from props or context
  // Local state stays local
}
```

### Testing State Management

#### **Testable State Logic**
```typescript
// ✅ CORRECT - Extract state logic for testing
export const workspaceReducer = (state: WorkspaceState, action: WorkspaceAction): WorkspaceState => {
  switch (action.type) {
    case 'SET_WORKSPACE':
      return {
        ...state,
        currentWorkspace: action.payload,
        currentProject: null,
        currentSession: null
      }
    case 'SET_PROJECT':
      return {
        ...state,
        currentProject: action.payload,
        currentSession: null
      }
    default:
      return state
  }
}

// Easy to test without React components
describe('workspaceReducer', () => {
  it('clears dependent state when workspace changes', () => {
    const initialState = {
      currentWorkspace: workspace1,
      currentProject: project1,
      currentSession: session1
    }
    
    const result = workspaceReducer(initialState, {
      type: 'SET_WORKSPACE',
      payload: workspace2
    })
    
    expect(result.currentProject).toBeNull()
    expect(result.currentSession).toBeNull()
  })
})
```

### Migration Guide: Fixing Existing useEffect Issues

#### **Step 1: Identify Problem useEffects**
```typescript
// 🔍 IDENTIFY - Look for these patterns
useEffect(() => {
  // Problem: Runs on every render due to object dependency
}, [someObject])

useEffect(() => {
  // Problem: Cascading effects that depend on each other
}, [dependency1, dependency2, dependency3])
```

#### **Step 2: Convert to Event Handlers**
```typescript
// 🔧 CONVERT - Replace reactive effects with explicit handlers
// Before (reactive)
useEffect(() => {
  if (workspace) {
    loadProjects(workspace.id)
  }
}, [workspace])

// After (explicit)
const handleWorkspaceChange = async (workspace: Workspace) => {
  setCurrentWorkspace(workspace)
  await loadProjects(workspace.id)
}
```

#### **Step 3: Simplify Dependencies**
```typescript
// 🔧 SIMPLIFY - Use primitive values instead of objects
// Before
useEffect(() => {
  loadData()
}, [user, workspace, project]) // Objects change on every render

// After  
useEffect(() => {
  if (userId && workspaceId) {
    loadData()
  }
}, [userId, workspaceId]) // Primitive values are stable
```

### Common Pitfalls and Solutions

| Problem | Solution |
|---------|----------|
| useEffect runs on every render | Extract stable primitives from dependencies |
| Cascading useEffect chain | Convert to explicit event handlers |
| State not updating | Check for object reference equality issues |
| Performance issues | Use useMemo and useCallback appropriately |
| Infinite loops | Remove reactive dependencies, use event-driven updates |
| State inconsistency | Implement single source of truth pattern |

### **State Management Checklist**
- [ ] No useEffect dependency arrays with objects or arrays
- [ ] All user interactions trigger explicit handler functions
- [ ] State updates are predictable and testable
- [ ] No cascading useEffect chains
- [ ] Proper cleanup for async operations
- [ ] Memoization used only when necessary
- [ ] Component state is isolated and focused
- [ ] Global state has single source of truth

**Remember**: React state management should be **predictable**, **testable**, and **performance-conscious**. Avoid reactive patterns that create dependency loops or unpredictable re-renders.

## 🔗 External References and Documentation

### Context7 Integration for Latest Documentation
ALWAYS use Context7 to access current Claude Code SDK documentation:

```bash
# Search for Claude Code SDK documentation
/context7 search claude code sdk latest features

# Get specific information about file operations
/context7 search claude code file operations

# Access deployment and configuration guides
/context7 search claude code deployment setup

# Research PRIA architecture patterns
/context7 search pria architecture multi-tenant applications
```

### Documentation Hierarchy
1. **This CLAUDE.md** - Your primary development guidelines
2. **TARGET_APP_SPECIFICATION.md** - Current project context and progress
3. **.pria/ context files** - Session state and workflow integration
4. **Builder App documentation** - Overall system architecture and database schema
5. **Context7 Claude Code SDK docs** - Latest SDK capabilities and best practices

## 🎯 Remember: You Are Part of a Larger System

### Your Core Responsibilities
1. **Generate PRIA-compliant applications** that meet security and architecture standards
2. **Maintain session continuity** through proper context file management
3. **Communicate effectively** with the Builder App orchestration system
4. **Work within the subagent framework** with phase-appropriate behavior
5. **Preserve and enhance** project documentation and specifications
6. **Validate quality gates** before phase transitions
7. **Coordinate with parallel activities** when concurrent processing is enabled

### Success Priorities
1. **Security** - Workspace isolation, authentication, data protection
2. **User Experience** - Intuitive, accessible, responsive interfaces  
3. **Performance** - Fast loading times, efficient resource usage
4. **Maintainability** - Clean, documented, testable code
5. **Integration** - Seamless operation within the PRIA ecosystem

**Remember**: You are not working in isolation. You are part of a sophisticated development ecosystem designed to generate enterprise-grade applications through structured, phase-based development with multiple quality gates and continuous validation.

Always maintain awareness of your current phase, subagent role, and integration with the broader PRIA App Builder system.