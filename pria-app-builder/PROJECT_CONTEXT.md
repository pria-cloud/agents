# PRIA App Builder - Project Context & Implementation Status

## Overview
We are building a sophisticated two-app system within an E2B sandbox that enables users to collaboratively build applications with Claude Code AI assistance, following PRIA platform standards. The system has evolved into a production-ready platform with advanced workflow management, requirements tracking, and iterative development support.

## Key Architecture Decisions

### Split Architecture (Builder + Target Apps)
1. **Builder App** (This Repository) - Orchestration and user interface
   - Real-time chat interface with Claude Code SDK
   - 7-phase structured workflow management
   - Requirements extraction and lifecycle tracking
   - E2B sandbox orchestration and management
   - Multi-tenant workspace isolation

2. **Target Apps** (E2B Sandboxes) - Individual application development environments
   - Each session gets isolated E2B sandbox with custom template
   - Claude Code SDK with `--dangerously-skip-permissions` for smooth operations
   - Node.js 22 runtime with Git, GitHub CLI pre-installed
   - Generated code follows PRIA architectural compliance
   - Automatic Git repository management

### Critical Implementation Details

1. **7-Phase Structured Workflow**
   - **Phase 1**: Requirements Gathering (with automatic extraction)
   - **Phase 2**: Architecture & Technical Design (PRIA compliance validation)
   - **Phase 3**: Implementation Planning (task breakdown and dependencies)
   - **Phase 4**: Development & Implementation (iterative code generation)
   - **Phase 5**: Testing & Quality Assurance (comprehensive validation)
   - **Phase 6**: Final Validation & Code Review (security and deployment readiness)
   - **Phase 7**: Deployment & Monitoring (production deployment with observability)

2. **Advanced Requirements Management**
   - Automatic extraction from Claude conversations using pattern matching
   - Comprehensive lifecycle tracking (new → draft → approved → in-design → implemented → tested → deployed)
   - Confidence scoring and duplicate detection
   - Integration with workflow phases for contextual requirement discovery

3. **Context7 MCP Integration**
   - Real-time documentation access across all workflow phases
   - System prompts include Context7 research directives
   - Up-to-date best practices and component library documentation
   - Enhanced decision-making with current industry standards

4. **E2B Sandbox Management**
   - Custom template: `pria-dev-env` with Node.js 22, Claude Code SDK, Git
   - Sandbox persistence across sessions via database tracking
   - Automatic reconnection to existing sandboxes
   - Command execution with proper error handling and logging

5. **Multi-tenant Security Architecture**
   - Complete workspace isolation using Supabase RLS
   - Service role bypass for Claude operations while maintaining security
   - JWT-based authentication with workspace context
   - All database operations include workspace_id filtering

## Current Implementation Status

### ✅ Fully Implemented Core Features
- **Foundation Architecture**: Multi-tenant database schema with RLS policies
- **Authentication & Authorization**: Supabase Auth with workspace isolation
- **E2B Sandbox Integration**: Custom template with pre-installed Claude Code SDK
- **7-Phase Workflow System**: Complete implementation with Context7 MCP integration
- **Requirements Management**: Database schema, API endpoints, automatic extraction
- **Chat Interface**: Real-time Claude communication with workflow context
- **Sandbox Persistence**: Database-backed session management and reconnection
- **Builder-Target Communication**: API-based orchestration between apps
- **Workflow State Management**: Progress tracking, quality gates, phase transitions
- **Requirements UI**: Web interface for collaborative requirement editing and status management
- **Code View**: File explorer with real-time file content display from Target Apps
- **Live Preview**: Target app development server integration with auto-start functionality
- **Workflow Visualization**: Complete progress tracking and phase navigation interface
- **Phase 1 Implementation**: Requirements gathering with conversational discovery and automatic extraction
- **Phase 2 Implementation**: Architecture & technical design with specifications extraction and PRIA compliance
- **Technical Specifications System**: Automated extraction, storage, and management of architecture docs
- **Phase 3 Implementation**: Implementation planning with task breakdown, sprint planning, and milestone tracking
- **Task Management System**: Complete task, sprint, and milestone management with dependency analysis and critical path identification
- **Subagent Architecture**: Core subagent implementation with specialized phase-specific agents
- **Context Preservation**: Subagent context and artifact storage system for enhanced workflow coordination

### 🚧 In Active Development
- **Dependency Mapping & Critical Path**: Visual dependency graphs and critical path optimization
- **Quality Gates & Advancement**: Automated phase transition logic based on completion criteria
- **PRIA Compliance Validation**: Real-time architecture compliance checking and reporting
- **Phase 4-7 Implementation**: Development, testing, validation, and deployment phases

### 📋 Planned Advanced Features
- **GitHub Integration**: Repository creation, sync, push/pull, webhook integration
- **Testing Infrastructure**: Automated test execution and results display
- **Deployment Pipeline**: Vercel integration and production deployment automation
- **Session Recovery**: Advanced context preservation and development session resumption

## Key Technical Specifications

### Builder App Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase with PostgreSQL + RLS
- **Authentication**: Supabase Auth with JWT
- **Sandbox Management**: E2B SDK
- **Real-time**: Supabase Realtime for collaboration

### Target App Environment (E2B Template)
- **Runtime**: Node.js 22 with npm/git pre-installed
- **Claude Integration**: @anthropic-ai/claude-code SDK with skip-permissions
- **Version Control**: Git with GitHub CLI
- **Framework**: Next.js 15 (PRIA-compliant) for generated applications
- **Testing**: Vitest, Playwright pre-configured
- **Deployment**: Ready for Vercel/production deployment

### Database Schema (Enhanced)
- **Multi-tenant Foundation**: `workspaces`, `projects`, `sessions`
- **Requirements Management**: `requirements` with lifecycle tracking and automatic numbering
- **Technical Specifications**: `technical_specs` with architecture documentation and PRIA compliance tracking
- **Implementation Planning**: `development_tasks`, `sprints`, `milestones` with complete project management
- **Subagent System**: `subagent_contexts`, `subagent_artifacts` for specialized agent coordination
- **Workflow Tracking**: Enhanced `sessions` with workflow state and metadata
- **Communication**: `chat_messages` with workflow context
- **Operations Tracking**: `claude_operations`, `generated_files` for audit trail
- **Change History**: `requirement_changes` for requirement evolution tracking

### Security & Compliance
1. **Multi-tenant Isolation**: Complete data separation via RLS
2. **PRIA Compliance**: All generated code follows PRIA architectural guidelines
3. **Security First**: Input validation, XSS prevention, secure API design
4. **Audit Trail**: Complete tracking of all operations and changes
5. **Environment Isolation**: E2B sandboxes provide secure development environments

## Advanced Features Implemented

### Workflow Management
- **Phase-specific System Prompts**: Each phase has specialized Claude instructions
- **Context7 Integration**: Real-time documentation access in all phases
- **Progress Tracking**: Granular progress measurement with quality gates
- **Iterative Support**: Non-linear development with requirement evolution
- **Quality Gates**: Phase completion validation before advancement

### Requirements Engineering
- **Automatic Extraction**: Pattern-based requirement discovery from conversations
- **Lifecycle Management**: Complete requirement tracking from inception to deployment
- **Confidence Scoring**: AI-driven confidence assessment for extracted requirements
- **Duplicate Detection**: Intelligent deduplication of similar requirements
- **Change Tracking**: Historical record of requirement modifications

### Development Process
- **Structured Phases**: 7-phase development with clear deliverables
- **Contextual Prompts**: Phase-appropriate Claude system instructions
- **Documentation Integration**: Real-time access to current best practices
- **Quality Assurance**: Built-in validation and compliance checking
- **Deployment Readiness**: Automated preparation for production deployment

## Current Development Phase

**Phase 6: Workflow Enhancement & Advanced Feature Development**

We are currently focused on:
1. **Dependency Mapping & Critical Path**: Visual dependency graphs and critical path optimization
2. **Quality Gates & Phase Advancement**: Automated workflow progression based on completion criteria
3. **PRIA Compliance Validation**: Real-time architecture compliance checking and reporting
4. **Phase 4-7 Implementation**: Development, testing, validation, and deployment phases

### Recent Major Completions
- ✅ **Subagent Architecture Implementation**: Complete Claude Code subagent system with phase-specific delegation
- ✅ **Core Subagent Definitions**: requirements-analyst, system-architect, and code-generator with specialized expertise  
- ✅ **Context Preservation System**: Database-backed subagent context and artifact storage
- ✅ **Enhanced Streaming API**: Intelligent subagent delegation with fallback to direct execution
- ✅ **Phase 3 Implementation Planning**: Complete with task breakdown, sprint planning, and milestone tracking
- ✅ **Task Management System**: Full implementation with dependency analysis and critical path identification
- ✅ **Planning UI**: Comprehensive task, sprint, and milestone management interface
- ✅ **Technical Specifications System**: Full extraction, storage, and API management
- ✅ **Live Code View**: Real-time file content display from Target Apps
- ✅ **Live Preview Integration**: Development server management with auto-start
- ✅ **Workflow Progress Visualization**: Complete 7-phase tracking and navigation

## References & Documentation
- [REQUIREMENTS.md](./REQUIREMENTS.md) - Complete technical specification (557 lines)
- [CLAUDE.md](./CLAUDE.md) - PRIA architectural guidelines for Builder App
- [e2b-template/CLAUDE.md](./e2b-template/CLAUDE.md) - Target app development guidelines
- [README.md](./README.md) - Project overview and getting started guide
- [database/](./database/) - Complete database schema and migration scripts

## Environment Configuration
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Claude Code SDK
ANTHROPIC_API_KEY=your_anthropic_api_key

# E2B Sandbox Management
E2B_API_KEY=your_e2b_api_key
NEXT_PUBLIC_E2B_API_KEY=your_e2b_api_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Architecture Evolution Notes
This project has evolved significantly from its initial conception. The implementation now includes:
- Advanced workflow management with 7 structured phases
- Sophisticated requirements engineering with automatic extraction
- Real-time documentation integration via Context7 MCP
- Production-ready multi-tenant architecture
- Comprehensive E2B sandbox integration
- Support for iterative, non-linear development processes

The architecture maintains backward compatibility while supporting advanced enterprise-grade features required for professional application development.