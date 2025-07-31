# PRIA App Builder

A sophisticated two-app system for building applications with Claude Code AI assistance, following PRIA platform standards. The system uses a split architecture where a Builder App manages the user interface and orchestrates development activities, while Target Apps run in E2B sandboxes with Claude Code SDK for actual code generation.

## Architecture Overview

### Split Architecture Design
- **Builder App** (This Repository): Next.js interface for user interaction, workflow management, and Target App orchestration
- **Target Apps** (E2B Sandboxes): Individual project environments with Claude Code SDK, each developing a specific application

### Key Components
- **7-Phase Structured Workflow**: Requirements → Architecture → Planning → Development → Testing → Validation → Deployment
- **Multi-Tenant Database**: Supabase with Row-Level Security for workspace isolation
- **E2B Sandbox Integration**: Custom template with Node.js 22, Claude Code SDK, Git, and PRIA development environment
- **Requirements Management**: Automatic extraction and lifecycle tracking from Claude conversations
- **Context7 MCP Integration**: Real-time documentation access for all development phases

## Technology Stack

### Builder App
- Next.js 15 with App Router
- React 19, TypeScript strict mode
- Tailwind CSS + shadcn/ui components
- Supabase (database, auth, real-time)
- E2B SDK for sandbox management

### Target Apps (Generated in E2B)
- Next.js 15 (PRIA-compliant)
- Claude Code SDK with `--dangerously-skip-permissions`
- Git integration for version control
- Automated testing and deployment pipelines

## Implementation Status

### ✅ Completed Core Features
- [x] **Foundation Architecture**: Multi-tenant database, authentication, workspace management
- [x] **E2B Sandbox Integration**: Custom template v2.0.0 with Claude Code SDK pre-installed
- [x] **7-Phase Workflow System**: Structured development with Context7 MCP integration
- [x] **Requirements Management**: Automatic extraction, lifecycle tracking, database schema
- [x] **Chat Interface**: Real-time Claude communication with workflow context
- [x] **Sandbox Persistence**: Database-backed sandbox reuse across sessions
- [x] **Builder-Target Communication**: API-based communication between apps
- [x] **Requirements UI**: Collaborative editing and status management interface
- [x] **Code View**: File explorer and generated code display with real-time content
- [x] **Live Preview**: Target app development server integration with auto-start
- [x] **Workflow UI**: Progress visualization and phase navigation with 7-phase tracking
- [x] **Phase 1 Implementation**: Requirements gathering with conversational discovery
- [x] **Phase 2 Implementation**: Architecture & technical design with specifications extraction
- [x] **Phase 3 Implementation**: Implementation planning with task breakdown, sprint planning, and milestone tracking
- [x] **Task Management System**: Complete task, sprint, and milestone management with dependency analysis
- [x] **Subagent Architecture**: Claude Code official sub-agents pattern with 8 specialized agents
- [x] **Context Preservation**: Database-backed subagent context and artifact storage for enhanced coordination
- [x] **GitHub Integration**: Repository sync, OAuth authentication, webhook processing
- [x] **Session Recovery**: Complete session recovery with sandbox reconnection and snapshot restoration
- [x] **Performance Monitoring**: Comprehensive metrics collection and reporting system
- [x] **Security System**: AES-256-GCM encryption for sensitive data and tokens
- [x] **Error Recovery**: Multi-strategy sandbox error recovery with circuit breakers
- [x] **Deployment Pipeline**: Phase 7 deployment with Vercel integration and monitoring

### 🚧 In Progress
- [x] **E2B Custom Template v2.0.0**: Production-ready template with 8 sub-agents and enhanced initialization
- [ ] **Dependency Mapping & Critical Path**: Visual dependency graphs and critical path optimization
- [ ] **Phase Advancement Logic**: Automated quality gates and phase transitions
- [ ] **Phase 4-7 Implementation**: Development, testing, validation, and deployment phases (core pipeline complete)
- [ ] **PRIA Compliance Validation**: Real-time architecture compliance checking

### 📋 Planned Features
- [ ] **Testing Infrastructure**: Automated test execution and results display
- [ ] **Advanced Analytics**: Usage analytics and performance insights
- [ ] **Template Marketplace**: Additional E2B templates for different frameworks
- [ ] **Collaboration Features**: Multi-user development sessions

## Getting Started

### Prerequisites
- Node.js 22+
- E2B API key
- Supabase project
- Anthropic API key

### Environment Setup
```bash
# Copy and configure environment variables
cp .env.example .env.local

# Required variables:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
E2B_API_KEY=your_e2b_api_key
```

### Installation
```bash
# Install dependencies
cd builder-app
npm install

# Start development server
npm run dev
```

### Database Setup
```bash
# Apply database schema
# Import database/pria-schema.sql to your Supabase project
```

## Architecture Deep Dive

### Workflow Phase System
The application implements a sophisticated 7-phase development workflow:

1. **Requirements Gathering**: Conversational discovery with automatic requirement extraction
2. **Architecture & Technical Design**: System design with PRIA compliance validation
3. **Implementation Planning**: Task breakdown and dependency mapping
4. **Development & Implementation**: Code generation with iterative refinement
5. **Testing & QA**: Comprehensive testing with automated validation
6. **Final Validation**: Security audit and deployment readiness
7. **Deployment & Monitoring**: Production deployment with continuous monitoring

Each phase includes:
- Phase-specific Claude system prompts with Context7 MCP integration
- Progress tracking and quality gates
- Artifact generation and validation
- Support for iterative, non-linear development

### Multi-Tenancy & Security
- **Workspace Isolation**: Complete data separation using Supabase RLS
- **Authentication**: Supabase Auth with JWT-based session management
- **API Security**: All endpoints validate workspace access
- **Sandbox Security**: E2B provides isolated development environments

### Documentation Architecture
- **CLAUDE.md** (Builder App): Split architecture context and workflow management
- **CLAUDE.md** (E2B Template): Target app development guidelines and PRIA compliance
- **Target App Specification**: Dynamic requirements and architecture documentation
- **Reference System**: Cross-linked documentation for context preservation

## Development Workflow

### For Builder App Development
1. Work in the `builder-app/` directory
2. Follow Next.js and React best practices
3. Maintain PRIA architectural compliance
4. Update documentation as needed

### For Target App Development
1. Builder App creates E2B sandbox with custom template
2. Claude Code SDK operates within sandbox environment
3. Generated code follows PRIA standards automatically
4. Version control via Git within sandbox

## Contributing

1. Review [REQUIREMENTS.md](./REQUIREMENTS.md) for complete technical specification
2. Follow PRIA architectural guidelines in [CLAUDE.md](./CLAUDE.md)
3. Maintain multi-tenant security patterns
4. Update documentation for any architectural changes

## Documentation
- [REQUIREMENTS.md](./REQUIREMENTS.md) - Complete technical specification
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) - Development context and decisions
- [CLAUDE.md](./CLAUDE.md) - PRIA architectural guidelines for Builder App
- [e2b-template/CLAUDE.md](./e2b-template/CLAUDE.md) - Target app development guidelines

## Current Development Phase

**Phase 5: Production Readiness** - Complete platform with deployment pipeline, error recovery, and comprehensive monitoring

### Implementation Status Summary
- **Core Platform**: ✅ Complete with multi-tenant architecture and security
- **E2B Integration**: ✅ Custom template v2.0.0 with 8 specialized sub-agents
- **Claude Code SDK**: ✅ Official TypeScript integration with streaming support
- **GitHub Integration**: ✅ OAuth, webhooks, repository synchronization
- **Session Management**: ✅ Recovery, snapshots, and context preservation
- **Monitoring & Security**: ✅ Performance metrics, encryption, error recovery
- **Deployment Pipeline**: ✅ Vercel integration with monitoring and rollback
- **Documentation**: ✅ Comprehensive guidelines for Builder App and Target Apps