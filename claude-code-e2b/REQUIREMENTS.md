# PRIA Claude Code App Builder - Requirements & Technical Specification

## 🎯 Project Overview

Build a sophisticated two-app system within an E2B sandbox that enables users to collaboratively build applications with Claude Code AI assistance, following PRIA platform standards.

## 🏗️ System Architecture

### Two-App Architecture in E2B Sandbox

```
e2b-sandbox/
├── builder-app/                    # App 1 - Builder Interface
│   ├── components/                 # React components
│   │   ├── chat/                  # Chat interface components
│   │   ├── preview/               # Code/UI preview components
│   │   ├── requirements/          # Requirements management
│   │   └── project-management/    # Session/project management
│   ├── app/                       # Next.js 15 App Router
│   │   ├── (dashboard)/          # Protected routes
│   │   ├── api/                  # API endpoints
│   │   └── globals.css           # Global styles
│   ├── lib/                       # Core libraries
│   │   ├── supabase/             # Database client
│   │   ├── claude-sdk/           # Claude Code SDK communication
│   │   ├── github/               # GitHub integration
│   │   └── e2b/                  # E2B sandbox management
│   └── middleware.ts             # Auth & session management
└── target-apps/                  # App 2s - Generated Applications
    ├── session-{uuid}/           # Each session gets its own directory
    │   ├── .claude/              # Claude Code SDK configuration
    │   ├── package.json          # Project dependencies
    │   ├── app/                  # Generated Next.js app
    │   ├── components/           # Generated components
    │   ├── lib/                  # Generated utilities
    │   └── .git/                 # Git repository for this project
    └── session-{uuid-2}/         # Another project
```

## 📋 Functional Requirements

### 1. User Interface (App 1 - Builder Interface)

#### 1.1 Main Layout
- **Split-pane interface**: 50/50 horizontal split
- **Left Pane**: Chat interface with Claude Code
- **Right Pane**: Tabbed interface with:
  - Code View (file explorer + code editor)
  - UI Preview (iframe showing running App 2)
  - Requirements Dashboard
  - Technical Specifications View

#### 1.2 Chat Interface (Left Pane)
- **Real-time chat** with Claude Code AI
- **Message types**:
  - User messages (requirements, clarifications, modifications)
  - Assistant responses (questions, confirmations, code explanations)
  - System messages (status updates, file operations)
- **Chat features**:
  - Message history persistence
  - Copy message content
  - Clear conversation
  - Export conversation
- **Context awareness**: Chat should understand current project state

#### 1.3 Code View (Right Pane - Tab 1)
- **File explorer**: Tree view of generated files in App 2
- **Code editor**: Syntax-highlighted code viewer
- **File operations**: View, download generated files
- **Diff viewer**: Show changes made by Claude Code
- **Real-time updates**: Automatically refresh when Claude generates/modifies files

#### 1.4 UI Preview (Right Pane - Tab 2)
- **Live preview**: Iframe showing running App 2
- **Auto-refresh**: Update when code changes
- **Responsive preview**: Toggle between desktop/mobile views
- **Error display**: Show build/runtime errors clearly

#### 1.5 Requirements Dashboard (Right Pane - Tab 3)
- **Requirements tree**: Hierarchical view of gathered requirements
- **Status tracking**: Show requirement status (pending, in-progress, completed)
- **Edit capability**: Modify requirements and trigger re-generation
- **Priority management**: Set requirement priorities

#### 1.6 Technical Specifications (Right Pane - Tab 4)
- **Architecture overview**: Generated technical specifications
- **Component hierarchy**: Visual representation of app structure
- **Data flow diagrams**: Show how data moves through the app
- **Deployment configuration**: Show deployment settings and pipeline

### 2. Requirements Gathering Process

#### 2.1 Initial Requirements Collection
- **Conversational discovery**: Claude asks clarifying questions
- **Structured capture**: Convert free-form input to structured requirements
- **Requirement types**:
  - Functional requirements (what the app should do)
  - Non-functional requirements (performance, security, etc.)
  - UI/UX requirements (design preferences, user flows)
  - Technical constraints (technologies, integrations)
  - Business requirements (goals, success metrics)

#### 2.2 Requirements Structure
```typescript
interface Requirement {
  id: string
  session_id: string
  workspace_id: string
  type: 'functional' | 'non-functional' | 'ui-ux' | 'technical' | 'business'
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  title: string
  description: string
  acceptance_criteria: string[]
  dependencies: string[] // IDs of other requirements
  estimated_effort: 'small' | 'medium' | 'large'
  tags: string[]
  created_at: string
  updated_at: string
  completed_at?: string
}
```

#### 2.3 Requirements Validation
- **Completeness check**: Ensure all necessary requirements are captured
- **Consistency validation**: Check for conflicting requirements
- **Feasibility assessment**: Validate technical feasibility
- **PRIA compliance**: Ensure requirements align with PRIA standards

### 3. Technical Specification Generation

#### 3.1 Architecture Planning
- **Component breakdown**: Define React components needed
- **Data model design**: Plan database schema and types
- **API design**: Define endpoints and data flows
- **State management**: Plan React state and context usage
- **Routing structure**: Define Next.js routing and navigation

#### 3.2 Implementation Planning
- **Development phases**: Break work into logical phases
- **File structure**: Plan directory and file organization
- **Dependencies**: Identify required packages and libraries
- **Testing strategy**: Plan unit, integration, and E2E tests
- **Deployment strategy**: Plan build and deployment process

#### 3.3 PRIA Compliance Planning
- **Security requirements**: Multi-tenant isolation, authentication
- **Code standards**: TypeScript, component patterns, error handling
- **UI standards**: shadcn/ui components, responsive design
- **Database patterns**: Supabase with RLS, workspace isolation

### 4. Code Generation (App 2 - Target Application)

#### 4.1 Claude Code SDK Integration
- **SDK Installation**: Claude Code SDK runs in each target app directory
- **Communication**: Builder app communicates with Claude via SDK API
- **File operations**: Claude can create, modify, delete files in target app
- **Build execution**: Claude can run build commands and tests
- **Git operations**: Claude can commit changes and manage branches

#### 4.2 Code Generation Process
1. **Requirements analysis**: Review gathered requirements
2. **Technical specification review**: Validate implementation plan
3. **Phase-based generation**: Generate code in logical phases
4. **Quality validation**: Ensure generated code meets PRIA standards
5. **Testing**: Run automated tests on generated code
6. **Deployment preparation**: Set up deployment configuration

#### 4.3 Generated Code Standards
- **PRIA compliance**: Follow all PRIA architecture guidelines
- **TypeScript strict mode**: All code must be properly typed
- **Error handling**: Comprehensive error handling patterns
- **Security**: Workspace isolation, input validation, secure defaults
- **Performance**: Optimized React patterns, efficient data fetching
- **Accessibility**: WCAG 2.1 AA compliance

### 5. Session and Project Management

#### 5.1 Session Hierarchy
```
Workspace (tenant isolation)
├── Projects (logical groupings of related apps)
│   ├── Sessions (individual app development sessions)
│   │   ├── Requirements
│   │   ├── Technical Specifications
│   │   ├── Generated Code
│   │   ├── Chat History
│   │   └── Deployment Configuration
│   └── Shared Resources (components, utilities)
└── Team Members (access control)
```

#### 5.2 Session Lifecycle
- **Creation**: Initialize new session with requirements gathering
- **Active development**: Iterative code generation and refinement
- **Testing phase**: Automated and manual testing
- **Deployment**: Production deployment and monitoring
- **Maintenance**: Bug fixes and feature additions
- **Archive**: Session completion and archival

#### 5.3 Session Persistence
- **Database storage**: All session data in Supabase
- **Git integration**: Code and history in GitHub repositories
- **File storage**: Generated assets in appropriate storage
- **Backup strategy**: Regular backups of all session data

### 6. Data Persistence and Multi-tenancy

#### 6.1 Supabase Database Schema

```sql
-- Workspaces (tenant isolation)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects (logical groupings)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions (individual app development sessions)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    github_repo_url TEXT,
    github_branch TEXT DEFAULT 'main',
    deployment_url TEXT,
    e2b_sandbox_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Requirements
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    acceptance_criteria JSONB DEFAULT '[]',
    dependencies JSONB DEFAULT '[]',
    estimated_effort TEXT,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Technical Specifications
CREATE TABLE technical_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    requirement_id UUID REFERENCES requirements(id),
    type TEXT NOT NULL, -- 'architecture', 'component', 'api', 'database', etc.
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Claude Operations (code generation tracking)
CREATE TABLE claude_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL,
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Generated Files (tracking what Claude creates)
CREATE TABLE generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    session_id UUID NOT NULL REFERENCES sessions(id),
    operation_id UUID REFERENCES claude_operations(id),
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    content_hash TEXT,
    size_bytes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies (workspace isolation)
CREATE POLICY "workspace_isolation" ON workspaces
FOR ALL USING (workspace_id = (jwt.claims->>'workspace_id')::uuid);

-- Similar policies for all tables...
```

#### 6.2 Multi-tenant Security
- **Row-Level Security (RLS)**: All queries automatically filtered by workspace_id
- **JWT claims**: Workspace ID embedded in authentication token
- **API validation**: All endpoints validate workspace access
- **File isolation**: Generated files isolated by workspace and session

### 7. GitHub Integration

#### 7.1 Repository Management
- **Auto-creation**: Create GitHub repo for each session
- **Branch strategy**: Main branch for stable code, feature branches for development
- **Commit strategy**: Atomic commits for each Claude operation
- **PR workflow**: Optional pull request workflow for code review

#### 7.2 Version Control
- **Automatic commits**: Claude commits all generated/modified files
- **Meaningful commit messages**: Descriptive messages for each change
- **File tracking**: Track all generated files in database
- **History preservation**: Maintain complete development history

#### 7.3 Collaboration Features
- **Team access**: Multiple users can work on same project
- **Code review**: Optional review process for generated code
- **Conflict resolution**: Handle conflicts when multiple users work simultaneously

### 8. Deployment Pipeline

#### 8.1 Build Process
- **Automated builds**: Trigger builds on code changes
- **Build validation**: Ensure all builds succeed before deployment
- **Test execution**: Run all tests in build pipeline
- **Quality checks**: TypeScript, linting, security scans

#### 8.2 Deployment Targets
- **Development**: Automatic deployment for testing
- **Staging**: Manual deployment for user acceptance testing
- **Production**: Controlled deployment with rollback capability

#### 8.3 Monitoring and Observability
- **Build status**: Real-time build status in UI
- **Deployment status**: Show current deployment state
- **Error tracking**: Capture and display build/deployment errors
- **Performance monitoring**: Track app performance metrics

## 🔧 Technical Implementation

### 1. Technology Stack

#### App 1 - Builder Interface
- **Framework**: Next.js 15+ with App Router
- **Runtime**: React 19+, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase with PostgreSQL + RLS
- **Authentication**: Supabase Auth with JWT
- **Real-time**: Supabase Realtime for live updates
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library + Playwright

#### App 2 - Target Applications (Generated)
- **Framework**: Next.js 15+ with App Router (PRIA compliant)
- **Runtime**: React 19+, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (shared with builder, workspace isolated)
- **Claude Integration**: @anthropic-ai/claude-code SDK

#### Infrastructure
- **Sandbox**: E2B sandboxes for isolated development environments
- **Version Control**: GitHub for code storage and collaboration
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Deployment**: Vercel for production hosting

### 2. Communication Architecture

#### Builder App ↔ Claude Code SDK
```typescript
// Builder app communicates with Claude Code SDK running in target app
interface ClaudeSDKCommunication {
  // Send requirements and get implementation plan
  analyzeRequirements(requirements: Requirement[]): Promise<ImplementationPlan>
  
  // Generate code based on specifications
  generateCode(specs: TechnicalSpec[]): Promise<GenerationResult>
  
  // Execute specific commands in target app context
  executeCommand(command: string): Promise<CommandResult>
  
  // Get current project state
  getProjectState(): Promise<ProjectState>
  
  // Stream real-time updates
  streamUpdates(): AsyncIterable<UpdateEvent>
}
```

#### Real-time Updates
- **Supabase Realtime**: For cross-user collaboration
- **WebSocket**: For Claude Code SDK communication
- **Server-Sent Events**: For build status and file changes

### 3. Error Handling and Resilience

#### 3.1 Error Categories
- **User errors**: Invalid requirements, conflicting specifications
- **System errors**: Database failures, network issues
- **Claude errors**: API failures, code generation errors
- **Build errors**: Compilation failures, test failures

#### 3.2 Error Recovery
- **Automatic retry**: Retry failed operations with exponential backoff
- **Graceful degradation**: Continue with limited functionality if possible
- **User notification**: Clear error messages and suggested actions
- **Error persistence**: Log all errors for debugging and analysis

### 4. Performance Requirements

#### 4.1 Response Times
- **Chat response**: < 2 seconds for simple queries
- **Code generation**: < 30 seconds for component generation
- **File operations**: < 1 second for file saves
- **Build process**: < 60 seconds for full application build

#### 4.2 Scalability
- **Concurrent users**: Support 100+ concurrent users
- **Session storage**: Handle 10,000+ active sessions
- **File operations**: Process 1,000+ file operations per minute
- **Database queries**: Optimize for < 100ms query response

### 5. Security Requirements

#### 5.1 Authentication and Authorization
- **User authentication**: Supabase Auth with social logins
- **Workspace isolation**: Complete data isolation between tenants
- **Role-based access**: Admin, developer, viewer roles
- **Session management**: Secure session handling and timeout

#### 5.2 Data Protection
- **Data encryption**: Encrypt sensitive data at rest and in transit
- **Input validation**: Validate all user inputs and API calls
- **SQL injection prevention**: Use parameterized queries
- **XSS prevention**: Sanitize all user-generated content

#### 5.3 Code Security
- **Dependency scanning**: Scan for vulnerable dependencies
- **Secret management**: Secure handling of API keys and secrets
- **Access control**: Limit file system access in sandbox
- **Code review**: Optional security review for generated code

## 🎯 Success Criteria

### 1. Functional Success
- [ ] Users can start new sessions and define requirements conversationally
- [ ] Claude Code generates working, PRIA-compliant applications
- [ ] Users can view and interact with generated applications in real-time
- [ ] Sessions can be paused, resumed, and shared between team members
- [ ] Generated applications can be deployed to production
- [ ] All data is properly isolated by workspace

### 2. Technical Success
- [ ] System handles 100+ concurrent users without performance degradation
- [ ] All generated code passes TypeScript strict mode compilation
- [ ] 99.9% uptime for the builder interface
- [ ] < 2 second response time for chat interactions
- [ ] Complete audit trail of all development activities

### 3. User Experience Success
- [ ] Intuitive interface that requires minimal training
- [ ] Clear visibility into development progress and status
- [ ] Responsive design that works on desktop and tablet
- [ ] Helpful error messages and recovery suggestions
- [ ] Seamless collaboration between team members

## 📅 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Set up E2B sandbox with two-app architecture
- Implement basic Builder interface with chat UI
- Set up Supabase database with multi-tenant schema
- Implement authentication and workspace management
- Basic Claude Code SDK integration

### Phase 2: Requirements Management (Weeks 3-4)
- Implement requirements gathering conversation flow
- Build requirements dashboard and management UI
- Add structured requirement capture and validation
- Implement technical specification generation
- Add requirements persistence and retrieval

### Phase 3: Code Generation (Weeks 5-6)
- Implement full Claude Code SDK integration
- Build code generation pipeline with PRIA compliance
- Add real-time file monitoring and display
- Implement build process and error handling
- Add code diff and change tracking

### Phase 4: Preview and Testing (Weeks 7-8)
- Implement live app preview in iframe
- Add responsive preview modes
- Implement automated testing pipeline
- Add manual testing and feedback features
- Build deployment preparation tools

### Phase 5: Collaboration and Polish (Weeks 9-10)
- Add real-time collaboration features
- Implement session sharing and team management
- Add GitHub integration and version control
- Polish UI/UX and add comprehensive error handling
- Implement monitoring and analytics

### Phase 6: Deployment and Production (Weeks 11-12)
- Set up production deployment pipeline
- Implement monitoring and observability
- Add backup and disaster recovery
- Performance optimization and load testing
- Documentation and user training materials

## 📖 Reference Implementation

This document serves as the single source of truth for the PRIA Claude Code App Builder implementation. Any deviations from this specification must be documented and approved to ensure project coherence and success.

All implementation decisions should reference back to these requirements to maintain alignment with the original vision and prevent scope creep or architectural drift.