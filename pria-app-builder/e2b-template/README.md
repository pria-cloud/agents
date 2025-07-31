# PRIA E2B Template

A comprehensive E2B sandbox template for generating PRIA-compliant Next.js applications using Claude Code SDK.

## 🎯 Overview

This template provides a complete, production-ready development environment optimized for the PRIA (Platform for Rapid Intelligent Applications) system. It enables the generation of enterprise-grade, multi-tenant Next.js applications with built-in security, compliance, and scalability features.

## ✨ Features

### Core Development Environment
- **Node.js 22 LTS** - Latest stable runtime with npm package management
- **Claude Code SDK** - AI-powered code generation and development assistance
- **Git & GitHub CLI** - Complete version control and repository management
- **TypeScript** - Strict type checking and enterprise-grade development

### PRIA Integration
- **Builder App Communication** - Seamless integration with PRIA orchestration system  
- **7-Phase Workflow Support** - Requirements → Architecture → Planning → Development → Testing → Validation → Deployment
- **Subagent Architecture** - Specialized AI agents for each development phase
- **Cross-Phase Artifact Referencing** - `@agent-name:artifact` syntax for context preservation
- **Parallel Processing** - Concurrent task execution with dependency resolution

### Next.js Foundation
- **Next.js 15** with App Router for modern web applications
- **React 19** with latest features and optimizations
- **Tailwind CSS** with shadcn/ui component library
- **Supabase Integration** - Authentication, database, and real-time features
- **PRIA Compliance Patterns** - Workspace isolation, RLS policies, secure authentication

### Security & Compliance
- **Multi-Tenant Architecture** - Workspace-based data isolation
- **Row-Level Security (RLS)** - Database-level access control
- **Authentication Middleware** - Route protection and session management
- **Security Auditing** - Automated vulnerability scanning and compliance validation

## 🏗️ Template Structure

```
e2b-template/
├── 🐳 Container Configuration
│   ├── e2b.Dockerfile          # Docker image with development tools
│   ├── e2b.toml                # E2B template configuration
│   └── scripts/
│       ├── startup.sh          # Environment initialization
│       ├── init-pria-project.sh
│       ├── claude-runner.sh
│       └── github-sync.sh
├── 🤖 PRIA Context System
│   └── .pria/
│       ├── scripts/
│       │   ├── init.js         # Context initialization
│       │   ├── sync-with-builder.js
│       │   ├── update-progress.js
│       │   └── validate-compliance.js
│       └── (context files created at runtime)
├── ⚛️ Next.js Application
│   ├── app/
│   │   ├── globals.css         # Tailwind styles with PRIA theme
│   │   ├── layout.tsx          # Root layout with security headers
│   │   └── page.tsx            # Landing page with feature showcase
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   └── lib/
│       ├── supabase/           # Database clients with RLS
│       └── utils.ts            # Utility functions
├── 🔧 Configuration Files
│   ├── package.json            # Dependencies and scripts
│   ├── next.config.js          # Next.js with security headers
│   ├── tailwind.config.js      # Tailwind with PRIA theme
│   ├── tsconfig.json           # TypeScript strict configuration
│   ├── middleware.ts           # Authentication and route protection
│   └── .env.example            # Environment variables template
└── 📚 Documentation
    ├── CLAUDE.md               # Claude Code SDK development guidelines
    ├── E2B_DEPLOYMENT_GUIDE.md # Complete deployment instructions
    └── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Authenticate with E2B
e2b auth login
```

### Build Template

```bash
# Navigate to template directory
cd e2b-template

# Build the template
e2b template build --name pria-dev-env

# Verify build
e2b template list
```

### Test Template

```bash
# Create test sandbox
e2b sandbox create pria-dev-env

# Expected output: Sandbox created successfully with PRIA environment
```

For detailed build and deployment instructions, see [`E2B_DEPLOYMENT_GUIDE.md`](./E2B_DEPLOYMENT_GUIDE.md).

## 🤖 Claude Code SDK Integration

This template is optimized for Claude Code SDK development with:

### Context-Aware Development
- **Session Context**: Automatic synchronization with Builder App state
- **Requirements Integration**: Live updates from requirements gathering phase
- **Technical Specifications**: Access to system architecture and design decisions
- **Artifact References**: Cross-phase context preservation and intelligent referencing

### Subagent System
The template supports specialized AI agents for each development phase:

1. **Requirements Analyst** - Conversational discovery and requirement structuring
2. **System Architect** - Technical architecture and database design
3. **Implementation Planner** - Task breakdown and dependency mapping
4. **Code Generator** - Production-ready PRIA-compliant code generation
5. **QA Engineer** - Comprehensive testing and quality assurance
6. **Security Auditor** - Security validation and deployment readiness
7. **Deployment Specialist** - Production deployment and monitoring

### Development Workflow
```bash
# Start development environment
./pria-dev.sh claude

# Sync with Builder App
./pria-dev.sh sync

# Validate PRIA compliance
./pria-dev.sh validate

# Check development status
./pria-dev.sh status
```

## 🔧 Builder App Integration

### Sandbox Creation

```typescript
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create('pria-dev-env', {
  timeoutMs: 120000,
  metadata: {
    sessionId: 'session_123',
    workspaceId: 'workspace_456',
    type: 'pria-target-app'
  }
})
```

### Environment Configuration

The template automatically configures:
- **PRIA_SESSION_ID** - Builder App session identifier
- **PRIA_WORKSPACE_ID** - Multi-tenant workspace identifier  
- **PRIA_BUILDER_APP_URL** - Builder App communication endpoint
- **ANTHROPIC_API_KEY** - Claude Code SDK authentication
- **GITHUB_TOKEN** - Git repository integration (optional)

### Communication Protocol

The template maintains bidirectional communication with the Builder App:
- **Progress Updates** - Real-time development progress reporting
- **Requirement Sync** - Live synchronization of requirements and specifications
- **Artifact Sharing** - Cross-phase artifact references and context preservation
- **Quality Gate Validation** - Automated compliance and security checks

## 🛡️ PRIA Compliance

### Security Requirements
- **Workspace Isolation** - Every database query includes `workspace_id` filtering
- **Row-Level Security** - Database-level access control policies
- **Authentication Middleware** - Route protection and session management
- **Security Headers** - OWASP-recommended security headers

### Architecture Patterns
- **Multi-Tenant Design** - Workspace-based data isolation
- **Server Actions** - Secure server-side operations with authentication
- **Type Safety** - TypeScript strict mode for enhanced reliability
- **Error Handling** - Comprehensive error boundaries and user feedback

### Quality Gates
- **PRIA Compliance Validation** - Automated checks for architecture patterns
- **Security Auditing** - Vulnerability scanning and penetration testing
- **Performance Optimization** - Core Web Vitals and loading time validation
- **Accessibility Standards** - WCAG compliance verification

## 📈 Performance & Scalability

### Resource Configuration
- **CPU**: 2 cores (configurable up to 4)
- **Memory**: 2048 MB (configurable up to 4096 MB)
- **Ports**: 3000-3005, 8000, 8080 (development servers)
- **Storage**: Persistent workspace with E2B filesystem mounting

### Development Optimization
- **Pre-installed Dependencies** - Common packages globally installed
- **Fast Startup** - Optimized container initialization (< 30 seconds)
- **Hot Reload** - Development server with instant updates
- **Caching** - npm cache and build optimization

## 🔍 Monitoring & Debugging

### Development Tools
- **Real-time Logs** - Container and application logging
- **Debug Console** - Interactive debugging capabilities
- **Performance Metrics** - Resource usage and timing analysis
- **Error Tracking** - Comprehensive error reporting and stack traces

### Builder App Integration
- **Progress Visualization** - Real-time development progress in Builder App
- **Live Preview** - Generated application preview with hot reload
- **Code Sync** - Bidirectional code synchronization with GitHub
- **Quality Reports** - Automated testing and validation results

## 🧪 Testing Framework

### Test Suite
- **Unit Tests** - Vitest with React Testing Library
- **Integration Tests** - API endpoint and database testing
- **End-to-End Tests** - Playwright for complete user journey testing
- **Accessibility Tests** - Automated WCAG compliance validation

### Quality Assurance
- **PRIA Compliance Testing** - Automated architecture pattern validation
- **Security Testing** - Vulnerability scanning and penetration testing
- **Performance Testing** - Load testing and Core Web Vitals measurement
- **Cross-browser Testing** - Multi-browser compatibility validation

## 🚀 Deployment

### Production Readiness
- **Environment Configuration** - Production environment variables and secrets
- **Database Migrations** - Automated schema updates and data migration
- **Monitoring Setup** - Observability and alerting configuration
- **Security Hardening** - Production security headers and policies

### Deployment Targets
- **Vercel** - Optimized for Next.js deployment with zero configuration
- **Docker** - Containerized deployment for any cloud provider
- **Kubernetes** - Scalable container orchestration
- **Traditional Hosting** - Standard Node.js hosting environments

## 📚 Documentation

### For Developers
- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive Claude Code SDK development guidelines
- **[E2B_DEPLOYMENT_GUIDE.md](./E2B_DEPLOYMENT_GUIDE.md)** - Complete deployment and build instructions
- **[.env.example](./.env.example)** - Environment variable configuration template

### For System Administrators
- **Template Configuration** - E2B template customization and optimization
- **Security Configuration** - Authentication and authorization setup
- **Monitoring Setup** - Observability and alerting configuration
- **Troubleshooting** - Common issues and resolution guides

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository and create a feature branch
2. **Develop** using the PRIA development guidelines
3. **Test** thoroughly with the included test suite
4. **Document** changes and update relevant documentation
5. **Submit** a pull request with detailed description

### Code Standards
- **TypeScript Strict** - All code must pass strict type checking
- **PRIA Compliance** - Follow workspace isolation and security patterns
- **Testing Coverage** - Maintain comprehensive test coverage
- **Documentation** - Update documentation for all changes

## 🔗 Related Projects

- **[PRIA Builder App](../builder-app/)** - Main orchestration system
- **[Claude Code SDK](https://docs.anthropic.com/claude-code)** - AI-powered development framework
- **[E2B Platform](https://e2b.dev)** - Secure sandbox infrastructure
- **[Supabase](https://supabase.com)** - Backend-as-a-Service platform

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Technical Issues**: Check the troubleshooting section in the deployment guide
- **Feature Requests**: Create an issue in the project repository
- **Documentation**: Refer to the comprehensive documentation files
- **Community**: Join the PRIA developer community for discussions and updates

---

**Built with ❤️ by the PRIA Team using Claude Code SDK**