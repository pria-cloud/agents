#!/usr/bin/env node

/**
 * TARGET_APP_SPECIFICATION.md Generator
 * Creates a project-specific specification file from the template
 */

const fs = require('fs').promises;
const path = require('path');

async function generateSpecification() {
  try {
    console.log('🔧 Generating TARGET_APP_SPECIFICATION.md from template...');

    // Load session context
    const sessionContext = JSON.parse(await fs.readFile('.pria/session-context.json', 'utf8'));
    const currentPhase = JSON.parse(await fs.readFile('.pria/current-phase.json', 'utf8'));
    
    // Load requirements if available
    let requirements = [];
    try {
      const requirementsData = JSON.parse(await fs.readFile('.pria/requirements.json', 'utf8'));
      requirements = requirementsData.requirements || [];
    } catch (error) {
      console.log('ℹ️  No requirements file found, using empty requirements');
    }

    // Load technical specs if available
    let technicalSpecs = {};
    try {
      const techSpecsData = JSON.parse(await fs.readFile('.pria/technical-specs.json', 'utf8'));
      technicalSpecs = techSpecsData.specifications || {};
    } catch (error) {
      console.log('ℹ️  No technical specs file found, using empty specs');
    }

    // Load tasks if available
    let tasks = [];
    try {
      const tasksData = JSON.parse(await fs.readFile('.pria/tasks.json', 'utf8'));
      tasks = tasksData.tasks || [];
    } catch (error) {
      console.log('ℹ️  No tasks file found, using empty tasks');
    }

    // Read the template
    const template = await fs.readFile('TARGET_APP_SPECIFICATION_TEMPLATE.md', 'utf8');

    // Generate specification content
    const specificationContent = processTemplate(template, {
      sessionContext,
      currentPhase,
      requirements,
      technicalSpecs,
      tasks
    });

    // Write the generated specification
    await fs.writeFile('TARGET_APP_SPECIFICATION.md', specificationContent);

    console.log('✅ TARGET_APP_SPECIFICATION.md generated successfully');
    console.log(`   Project: ${sessionContext.projectName || 'Unnamed Project'}`);
    console.log(`   Phase: ${currentPhase.phase} - ${currentPhase.phaseName || 'Unknown Phase'}`);
    console.log(`   Requirements: ${requirements.length}`);
    console.log(`   Tasks: ${tasks.length}`);
    
  } catch (error) {
    console.error('❌ Failed to generate TARGET_APP_SPECIFICATION.md:', error);
    process.exit(1);
  }
}

function processTemplate(template, data) {
  const { sessionContext, currentPhase, requirements, technicalSpecs, tasks } = data;
  const timestamp = new Date().toISOString();

  // Basic replacements
  let content = template
    .replace(/{PROJECT_NAME}/g, sessionContext.projectName || 'PRIA Generated Application')
    .replace(/{PROJECT_TYPE}/g, sessionContext.projectType || 'Next.js Web Application')
    .replace(/{SESSION_ID}/g, sessionContext.sessionId || 'unknown')
    .replace(/{WORKSPACE_ID}/g, sessionContext.workspaceId || 'unknown')
    .replace(/{CREATED_DATE}/g, sessionContext.createdAt || timestamp)
    .replace(/{LAST_UPDATED}/g, timestamp)
    .replace(/{BUILDER_APP_URL}/g, sessionContext.builderAppUrl || 'http://localhost:3007')
    .replace(/{TEMPLATE_ID}/g, sessionContext.templateId || '4w6sko07dck8h6biek2m')
    .replace(/{SANDBOX_ID}/g, sessionContext.sandboxId || 'unknown')
    .replace(/{CURRENT_PHASE}/g, currentPhase.phase || 1)
    .replace(/{PHASE_NAME}/g, currentPhase.phaseName || 'Requirements Gathering')
    .replace(/{SUBAGENT_ROLE}/g, currentPhase.subagent || 'requirements-analyst')
    .replace(/{PHASE_STATUS}/g, currentPhase.status || 'active')
    .replace(/{PHASE_START_TIME}/g, currentPhase.startTime || timestamp)
    .replace(/{PHASE_PROGRESS}/g, currentPhase.progress || 0)
    .replace(/{OVERALL_PROGRESS}/g, calculateOverallProgress(currentPhase.phase))
    .replace(/{QUALITY_GATES_PASSED}/g, currentPhase.qualityGatesPassed || false)
    .replace(/{CURRENT_FOCUS}/g, getCurrentFocus(currentPhase.phase))
    .replace(/{NEXT_MILESTONE}/g, getNextMilestone(currentPhase.phase))
    .replace(/{FRAMEWORK}/g, 'Next.js 15 with App Router')
    .replace(/{RUNTIME}/g, 'React 19, Node.js 22')
    .replace(/{DATABASE}/g, 'Supabase PostgreSQL with RLS')
    .replace(/{AUTHENTICATION}/g, 'Supabase Auth')
    .replace(/{STYLING}/g, 'Tailwind CSS + shadcn/ui')
    .replace(/{TESTING}/g, 'Vitest + Playwright')
    .replace(/{LAST_SYNC_TIME}/g, timestamp)
    .replace(/{BUILDER_APP_CONNECTION_STATUS}/g, 'connected')
    .replace(/{ACTIVE_SUBAGENT}/g, currentPhase.subagent || 'requirements-analyst')
    .replace(/{CONTEXT_VERSION}/g, '1.0.0')
    .replace(/{DOCUMENT_VERSION}/g, '1.0.0');

  // Generate complex sections
  content = content
    .replace(/{FUNCTIONAL_REQUIREMENTS}/g, generateRequirementsSection(requirements, 'functional'))
    .replace(/{NON_FUNCTIONAL_REQUIREMENTS}/g, generateRequirementsSection(requirements, 'non_functional'))
    .replace(/{BUSINESS_RULES}/g, generateBusinessRulesSection(requirements))
    .replace(/{USER_STORIES}/g, generateUserStoriesSection(requirements))
    .replace(/{ARCHITECTURE_PATTERNS}/g, generateArchitecturePatterns(technicalSpecs))
    .replace(/{DATA_MODELS}/g, generateDataModels(technicalSpecs))
    .replace(/{API_SPECIFICATIONS}/g, generateAPISpecs(technicalSpecs))
    .replace(/{DEVELOPMENT_TASKS}/g, generateTasksSection(tasks))
    .replace(/{DEPENDENCIES}/g, generateDependenciesSection(tasks))
    .replace(/{FILE_STRUCTURE}/g, generateFileStructure())
    .replace(/{CONFIGURATION}/g, generateConfiguration())
    .replace(/{TESTING_STRATEGY}/g, generateTestingStrategy(currentPhase.phase))
    .replace(/{SECURITY_CONSIDERATIONS}/g, generateSecurityConsiderations())
    .replace(/{PERFORMANCE_REQUIREMENTS}/g, generatePerformanceRequirements())
    .replace(/{COMPLIANCE_CHECKLIST}/g, generateComplianceChecklist())
    .replace(/{ENVIRONMENT_CONFIG}/g, generateEnvironmentConfig())
    .replace(/{DEPLOYMENT_STRATEGY}/g, generateDeploymentStrategy())
    .replace(/{MONITORING_CONFIG}/g, generateMonitoringConfig())
    .replace(/{GENERATED_FILES}/g, generateArtifactsList())
    .replace(/{EXTERNAL_DEPENDENCIES}/g, generateExternalDependencies())
    .replace(/{DOCUMENTATION_LINKS}/g, generateDocumentationLinks())
    .replace(/{CROSS_PHASE_REFERENCES}/g, generateCrossPhaseReferences())
    .replace(/{DEVELOPMENT_NOTES}/g, generateDevelopmentNotes(currentPhase))
    .replace(/{KNOWN_ISSUES}/g, generateKnownIssues())
    .replace(/{FUTURE_ENHANCEMENTS}/g, generateFutureEnhancements());

  return content;
}

function generateRequirementsSection(requirements, type) {
  const filteredReqs = requirements.filter(req => req.type === type);
  
  if (filteredReqs.length === 0) {
    return `No ${type} requirements defined yet.`;
  }

  return filteredReqs.map(req => `
### ${req.title} (${req.priority.toUpperCase()})
**Status**: ${req.status}
**Description**: ${req.description}

**Acceptance Criteria**:
${req.acceptanceCriteria ? req.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n') : '- To be defined'}

**Related Tasks**: ${req.relatedTasks ? req.relatedTasks.join(', ') : 'None'}
`).join('\n');
}

function generateBusinessRulesSection(requirements) {
  const businessRules = requirements.filter(req => req.type === 'business_rule');
  
  if (businessRules.length === 0) {
    return 'Business rules will be defined during requirements gathering phase.';
  }

  return businessRules.map(rule => `- **${rule.title}**: ${rule.description}`).join('\n');
}

function generateUserStoriesSection(requirements) {
  const userStories = requirements.filter(req => req.userStory);
  
  if (userStories.length === 0) {
    return 'User stories will be defined during requirements gathering phase.';
  }

  return userStories.map(story => `
**${story.title}**
${story.userStory}

**Acceptance Criteria**:
${story.acceptanceCriteria ? story.acceptanceCriteria.map(criteria => `- [ ] ${criteria}`).join('\n') : '- [ ] To be defined'}
`).join('\n');
}

function generateArchitecturePatterns(technicalSpecs) {
  if (!technicalSpecs.architecture) {
    return 'Architecture patterns will be defined during technical design phase.';
  }

  return `
**Application Architecture**: ${technicalSpecs.architecture.pattern || 'Server-side rendered with client-side interactivity'}
**Data Flow**: ${technicalSpecs.architecture.dataFlow || 'Unidirectional data flow with server state management'}
**State Management**: ${technicalSpecs.architecture.stateManagement || 'React state + Supabase real-time subscriptions'}
**Security Model**: ${technicalSpecs.architecture.security || 'Row-Level Security with workspace isolation'}
`;
}

function generateDataModels(technicalSpecs) {
  if (!technicalSpecs.database || !technicalSpecs.database.tables) {
    return 'Data models will be defined during technical design phase.';
  }

  const tables = technicalSpecs.database.tables;
  return Object.keys(tables).map(tableName => {
    const table = tables[tableName];
    return `
### ${tableName}
**Purpose**: ${table.description || 'Purpose to be defined'}
**Columns**: ${table.columns ? table.columns.join(', ') : 'Columns to be defined'}
**Relationships**: ${table.relationships || 'Relationships to be defined'}
`;
  }).join('\n');
}

function generateAPISpecs(technicalSpecs) {
  if (!technicalSpecs.api || !technicalSpecs.api.endpoints) {
    return 'API specifications will be defined during technical design phase.';
  }

  const endpoints = technicalSpecs.api.endpoints;
  return endpoints.map(endpoint => `
### ${endpoint.method} ${endpoint.path}
**Purpose**: ${endpoint.description}
**Authentication**: ${endpoint.auth ? 'Required' : 'Not required'}
**Parameters**: ${endpoint.parameters || 'None'}
**Response**: ${endpoint.response || 'To be defined'}
`).join('\n');
}

function generateTasksSection(tasks) {
  if (tasks.length === 0) {
    return 'Development tasks will be defined during implementation planning phase.';
  }

  return tasks.map(task => `
### ${task.title} (${task.priority.toUpperCase()})
**Status**: ${task.status}
**Estimated Effort**: ${task.estimatedHours || 'TBD'} hours
**Dependencies**: ${task.dependencies ? task.dependencies.join(', ') : 'None'}
**Description**: ${task.description}
**Acceptance Criteria**: ${task.acceptanceCriteria || 'To be defined'}
`).join('\n');
}

function generateDependenciesSection(tasks) {
  const dependencies = tasks.reduce((deps, task) => {
    if (task.dependencies && task.dependencies.length > 0) {
      deps.push(`**${task.title}** depends on: ${task.dependencies.join(', ')}`);
    }
    return deps;
  }, []);

  if (dependencies.length === 0) {
    return 'Task dependencies will be mapped during implementation planning phase.';
  }

  return dependencies.join('\n');
}

function generateFileStructure() {
  return `
\`\`\`
target-app/
├── .pria/                      # PRIA context and communication files
├── app/                        # Next.js App Router pages
│   ├── (auth)/                # Auth-related routes
│   ├── (dashboard)/           # Protected dashboard routes
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/                # Custom React components
│   ├── ui/                   # shadcn/ui components
│   └── ...                   # Application-specific components
├── lib/
│   ├── supabase/             # Supabase client configurations
│   ├── utils.ts              # Utility functions
│   └── types/                # TypeScript definitions
├── middleware.ts             # Route protection & session management
├── TARGET_APP_SPECIFICATION.md # This document
└── package.json              # Dependencies
\`\`\`
`;
}

function generateConfiguration() {
  return `
**Environment Variables**:
- \`NEXT_PUBLIC_SUPABASE_URL\`: Supabase project URL
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: Supabase anonymous key
- \`NEXT_PUBLIC_APP_URL\`: Application base URL

**Build Configuration**:
- Next.js 15 with App Router
- TypeScript strict mode enabled
- Tailwind CSS with shadcn/ui components
- ESLint with Next.js configuration

**Development Setup**:
- Node.js 22+ required
- npm or yarn for package management
- Claude Code SDK integration
`;
}

function generateTestingStrategy(phase) {
  if (phase < 5) {
    return 'Testing strategy will be defined during the testing phase.';
  }

  return `
**Unit Testing**:
- Vitest for component and utility testing
- React Testing Library for component interaction testing
- Minimum 80% code coverage target

**Integration Testing**:
- API endpoint testing with Supabase integration
- Database operation testing with test database
- Authentication flow testing

**End-to-End Testing**:
- Playwright for browser automation testing
- Critical user journey validation
- Cross-browser compatibility testing

**Performance Testing**:
- Core Web Vitals monitoring
- Load testing for key endpoints
- Bundle size optimization validation
`;
}

function generateSecurityConsiderations() {
  return `
**PRIA Security Requirements**:
- Workspace-level data isolation (NON-NEGOTIABLE)
- Row-Level Security (RLS) policies on all tables
- Authenticated access to all protected routes
- Input validation and sanitization

**Authentication & Authorization**:
- Supabase Auth integration with JWT tokens
- Role-based access control
- Session management with secure cookies

**Data Protection**:
- Encrypted data transmission (HTTPS)
- Database-level encryption at rest
- No sensitive data in client-side code or logs

**Security Testing**:
- Automated vulnerability scanning
- OWASP compliance validation
- Penetration testing before deployment
`;
}

function generatePerformanceRequirements() {
  return `
**Core Web Vitals Targets**:
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

**Page Load Performance**:
- Initial page load: < 3s
- Subsequent navigation: < 1s
- API response time: < 200ms (95th percentile)

**Scalability Requirements**:
- Support for 1000+ concurrent users
- Database query optimization
- Efficient caching strategies
- CDN integration for static assets
`;
}

function generateComplianceChecklist() {
  return `
- [ ] All database queries include workspace_id filtering
- [ ] Row-Level Security policies implemented on all tables
- [ ] Authentication required for all protected routes
- [ ] TypeScript strict mode enabled without errors
- [ ] shadcn/ui components used exclusively for UI
- [ ] Lucide React icons used exclusively
- [ ] Mobile-responsive design implemented
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] No hardcoded secrets or API keys in code
- [ ] Error boundaries implemented for component isolation
- [ ] Loading states implemented for all async operations
- [ ] Proper error handling throughout the application
`;
}

function generateEnvironmentConfig() {
  return `
**Development Environment**:
- Node.js 22+
- Next.js 15 development server
- Supabase local development (optional)
- Hot module reloading enabled

**Staging Environment**:
- Vercel preview deployments
- Supabase staging database
- Performance monitoring enabled
- E2E testing execution

**Production Environment**:
- Vercel production deployment
- Supabase production database
- CDN configuration
- Full monitoring and alerting
`;
}

function generateDeploymentStrategy() {
  return `
**Deployment Pipeline**:
1. Code commit to main branch
2. Automated testing execution
3. Build process with optimization
4. Deployment to Vercel
5. Health checks and validation
6. Rollback capability if issues detected

**Database Migrations**:
- Supabase migration files
- Rollback scripts for safety
- Data migration validation

**Monitoring Setup**:
- Application performance monitoring
- Error tracking and alerting
- Business metrics collection
`;
}

function generateMonitoringConfig() {
  return `
**Application Monitoring**:
- Real User Monitoring (RUM)
- Error tracking and reporting
- Performance metrics collection
- Uptime monitoring

**Business Intelligence**:
- User engagement analytics
- Feature usage tracking
- Conversion funnel analysis

**Alerting Configuration**:
- Error rate thresholds
- Performance degradation alerts
- Availability monitoring
- Security incident detection
`;
}

function generateArtifactsList() {
  return `
Generated artifacts will be listed here as development progresses:

**Phase 1 Artifacts**:
- Requirements documentation
- User story mapping
- Acceptance criteria definitions

**Phase 2 Artifacts**:
- Technical architecture diagrams
- Database schema definitions
- API specification documents

**Phase 3 Artifacts**:
- Implementation task breakdown
- Dependency mapping
- Sprint planning documents

**Phase 4+ Artifacts**:
- Application source code
- Component implementations
- Test suites
- Documentation
`;
}

function generateExternalDependencies() {
  return `
**Core Dependencies**:
- Next.js 15+ (React framework)
- Supabase (Database and authentication)
- Tailwind CSS (Styling framework)
- shadcn/ui (UI component library)
- Lucide React (Icon library)

**Development Dependencies**:
- TypeScript (Type safety)
- ESLint (Code linting)
- Vitest (Unit testing)
- Playwright (E2E testing)

**Integration Dependencies**:
- Builder App APIs (Progress reporting)
- GitHub (Code synchronization)
- Vercel (Deployment platform)
`;
}

function generateDocumentationLinks() {
  return `
**Internal Documentation**:
- [PRIA Development Guidelines](./CLAUDE.md)
- [Builder App Integration](../builder-app/README.md)
- [Project Requirements](../REQUIREMENTS.md)

**External Documentation**:
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
`;
}

function generateCrossPhaseReferences() {
  return `
Cross-phase artifact references will be tracked here:

**@requirements-analyst:user-requirements** - User requirement specifications
**@system-architect:technical-architecture** - System architecture design
**@implementation-planner:task-breakdown** - Development task definitions
**@code-generator:application-components** - Generated application code
**@qa-engineer:test-suites** - Comprehensive test implementations
**@security-auditor:security-report** - Security validation results
**@deployment-specialist:deployment-config** - Production deployment setup
`;
}

function generateDevelopmentNotes(currentPhase) {
  const phaseNotes = {
    1: 'Focus on gathering comprehensive requirements through conversational discovery.',
    2: 'Design robust technical architecture with proper workspace isolation.',
    3: 'Create detailed implementation plan with clear task dependencies.',
    4: 'Generate production-ready, PRIA-compliant application code.',
    5: 'Implement comprehensive testing strategy with high coverage.',
    6: 'Perform thorough security audit and deployment readiness check.',
    7: 'Prepare application for production deployment with monitoring.'
  };

  return `
**Current Phase Focus**: ${phaseNotes[currentPhase.phase] || 'Development in progress'}

**Development Approach**:
- Iterative development with continuous validation
- PRIA compliance maintained throughout
- Regular sync with Builder App for progress tracking
- Quality gates validated before phase transitions

**Context Management**:
- .pria/ directory maintained with current state
- TARGET_APP_SPECIFICATION.md updated regularly
- Builder App progress reporting active
- Artifact references tracked across phases
`;
}

function generateKnownIssues() {
  return `
No known issues at this time. Issues discovered during development will be tracked here.

**Resolution Process**:
1. Document issue with reproduction steps
2. Assess impact and priority
3. Create resolution plan
4. Implement fix with testing
5. Validate resolution
6. Update documentation
`;
}

function generateFutureEnhancements() {
  return `
Future enhancements will be identified and tracked here as development progresses.

**Enhancement Process**:
1. Identify improvement opportunity
2. Assess business value and technical feasibility
3. Create enhancement specification
4. Prioritize against current roadmap
5. Plan implementation approach
6. Execute with proper validation
`;
}

function calculateOverallProgress(phase) {
  const phaseProgress = {
    1: 14, // 1/7 * 100
    2: 28, // 2/7 * 100
    3: 42, // 3/7 * 100
    4: 57, // 4/7 * 100
    5: 71, // 5/7 * 100
    6: 85, // 6/7 * 100
    7: 100 // 7/7 * 100
  };
  
  return phaseProgress[phase] || 0;
}

function getCurrentFocus(phase) {
  const phaseFocus = {
    1: 'Requirements gathering and stakeholder alignment',
    2: 'Technical architecture and system design',
    3: 'Implementation planning and task breakdown',
    4: 'Code generation and feature development',
    5: 'Testing implementation and quality assurance',
    6: 'Security audit and deployment preparation',
    7: 'Production deployment and monitoring setup'
  };
  
  return phaseFocus[phase] || 'Development activities';
}

function getNextMilestone(phase) {
  const nextMilestone = {
    1: 'Complete requirements documentation',
    2: 'Finalize technical architecture',
    3: 'Complete implementation planning',
    4: 'Deliver working application features',
    5: 'Achieve comprehensive test coverage',
    6: 'Pass security audit and deployment readiness',
    7: 'Successfully deploy to production'
  };
  
  return nextMilestone[phase] || 'Continue development progress';
}

// Run the generator
if (require.main === module) {
  generateSpecification();
}

module.exports = { generateSpecification };