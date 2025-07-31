#!/usr/bin/env node

/**
 * PRIA Context Initialization Script
 * Sets up .pria/ directory structure and initializes context files
 */

const fs = require('fs').promises;
const path = require('path');

// Default context structure
const defaultContext = {
  currentPhase: {
    phase: 1,
    phaseName: "Requirements Gathering",
    subagent: "requirements-analyst",
    startTime: new Date().toISOString(),
    expectedDuration: "30-60 minutes",
    qualityGates: [
      "requirements_documented",
      "stakeholder_validation", 
      "acceptance_criteria_defined"
    ],
    nextPhase: 2,
    builderAppCallbacks: [
      "POST /api/workflow/{sessionId}/progress",
      "POST /api/requirements/{sessionId}/updates"
    ]
  },

  sessionContext: {
    sessionId: process.env.PRIA_SESSION_ID || "sess_default",
    workspaceId: process.env.PRIA_WORKSPACE_ID || "ws_default",
    projectName: "PRIA Generated Application",
    builderAppUrl: process.env.PRIA_BUILDER_APP_URL || "http://localhost:3007",
    supabaseConfig: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    },
    githubIntegration: {
      enabled: !!process.env.GITHUB_TOKEN,
      repositoryUrl: process.env.GITHUB_REPOSITORY_URL || "",
      branch: "main"
    },
    workflowConfig: {
      parallelProcessing: true,
      artifactReferencing: true,
      iterativeDevelopment: true
    }
  },

  requirements: {
    lastSync: new Date().toISOString(),
    totalRequirements: 0,
    requirements: []
  },

  technicalSpecs: {
    lastUpdate: new Date().toISOString(),
    specifications: [],
    architecture: {
      framework: "Next.js 15",
      database: "Supabase PostgreSQL",
      authentication: "Supabase Auth",
      styling: "Tailwind CSS + shadcn/ui",
      deployment: "TBD"
    }
  },

  tasks: {
    lastUpdate: new Date().toISOString(),
    totalTasks: 0,
    tasks: [],
    dependencies: {},
    sprints: []
  },

  artifacts: {
    lastUpdate: new Date().toISOString(),
    artifacts: {}
  },

  progressTracking: {
    initializeDate: new Date().toISOString(),
    phases: {
      1: { status: "active", startTime: new Date().toISOString() },
      2: { status: "pending" },
      3: { status: "pending" },
      4: { status: "pending" },
      5: { status: "pending" },
      6: { status: "pending" },
      7: { status: "pending" }
    },
    overallProgress: 0,
    lastActivity: new Date().toISOString()
  },

  communicationLog: {
    initialized: new Date().toISOString(),
    entries: []
  },

  githubSyncStatus: {
    lastSync: null,
    lastCommit: null,
    conflicts: [],
    status: "not_configured"
  }
};

// Subagent-specific contexts
const subagentContexts = {
  "requirements-analyst": {
    role: "requirements-analyst",
    phase: 1,
    primaryFocus: "Conversational discovery and requirement structuring",
    responsibilities: [
      "Extract functional and non-functional requirements",
      "Engage in conversational discovery with stakeholders", 
      "Structure requirements with acceptance criteria",
      "Validate business logic and constraints",
      "Update .pria/requirements.json with findings"
    ],
    tools: ["conversational-discovery", "requirement-extraction", "business-analysis"],
    outputFormat: "structured-requirements-json",
    qualityChecks: [
      "All requirements have clear acceptance criteria",
      "Business logic is validated",
      "Edge cases are identified",
      "Priority levels are assigned"
    ]
  },

  "system-architect": {
    role: "system-architect", 
    phase: 2,
    primaryFocus: "Technical architecture and system design",
    responsibilities: [
      "Design database schema with workspace isolation",
      "Create API specifications and endpoints",
      "Plan component hierarchy and data flow",
      "Define integration patterns and external services",
      "Update .pria/technical-specs.json with architecture"
    ],
    tools: ["database-design", "api-specification", "architecture-planning"],
    outputFormat: "technical-specifications-json",
    qualityChecks: [
      "All tables include workspace_id for tenant isolation",
      "RLS policies are defined for all tables", 
      "API endpoints follow PRIA authentication patterns",
      "Component hierarchy supports scalability"
    ]
  },

  "implementation-planner": {
    role: "implementation-planner",
    phase: 3, 
    primaryFocus: "Task breakdown and implementation planning",
    responsibilities: [
      "Break requirements into development tasks",
      "Create dependency mapping between tasks",
      "Plan iterative development sprints",
      "Estimate effort and priority for each task",
      "Update .pria/tasks.json with implementation plan"
    ],
    tools: ["task-breakdown", "dependency-analysis", "sprint-planning"],
    outputFormat: "implementation-tasks-json",
    qualityChecks: [
      "All requirements mapped to specific tasks",
      "Dependencies are clearly defined",
      "Tasks are appropriately sized for development",
      "Critical path is identified"
    ]
  },

  "code-generator": {
    role: "code-generator",
    phase: 4,
    primaryFocus: "Production-ready PRIA-compliant code generation",
    responsibilities: [
      "Generate Next.js application code with TypeScript",
      "Implement database integration with workspace isolation",
      "Create UI components using shadcn/ui",
      "Ensure PRIA compliance in all generated code",
      "Maintain TARGET_APP_SPECIFICATION.md"
    ],
    tools: ["code-generation", "pria-compliance-validation", "typescript-development"],
    outputFormat: "complete-application-codebase",
    qualityChecks: [
      "All database queries include workspace_id",
      "TypeScript strict mode compilation passes",
      "All components handle loading/error states",
      "Authentication middleware protects routes"
    ]
  },

  "qa-engineer": {
    role: "qa-engineer",
    phase: 5,
    primaryFocus: "Comprehensive testing and quality assurance", 
    responsibilities: [
      "Generate unit tests for business logic",
      "Create integration tests for API endpoints",
      "Implement E2E tests for critical user flows",
      "Validate accessibility and performance standards",
      "Ensure PRIA compliance testing"
    ],
    tools: ["test-generation", "accessibility-validation", "performance-testing"],
    outputFormat: "comprehensive-test-suite",
    qualityChecks: [
      "Test coverage meets minimum thresholds",
      "All API endpoints have integration tests",
      "Critical user flows have E2E tests",
      "Accessibility standards are validated"
    ]
  },

  "security-auditor": {
    role: "security-auditor",
    phase: 6,
    primaryFocus: "Security audit and deployment readiness",
    responsibilities: [
      "Perform comprehensive security vulnerability scan",
      "Validate PRIA compliance across all components",
      "Check for proper authentication and authorization",
      "Assess deployment readiness and configuration",
      "Generate security audit report"
    ],
    tools: ["security-scanning", "compliance-validation", "deployment-assessment"],
    outputFormat: "security-audit-report",
    qualityChecks: [
      "No high-severity security vulnerabilities",
      "All authentication patterns are secure",
      "Workspace isolation is properly implemented",
      "Deployment configuration is validated"
    ]
  },

  "deployment-specialist": {
    role: "deployment-specialist", 
    phase: 7,
    primaryFocus: "Production deployment and monitoring setup",
    responsibilities: [
      "Prepare production environment configuration",
      "Set up monitoring and observability",
      "Create deployment documentation and runbooks", 
      "Configure CI/CD pipeline for continuous deployment",
      "Finalize production readiness checklist"
    ],
    tools: ["deployment-configuration", "monitoring-setup", "ci-cd-pipeline"],
    outputFormat: "production-ready-application",
    qualityChecks: [
      "Production environment is properly configured",
      "Monitoring and alerting are set up",
      "Deployment process is documented",
      "Rollback procedures are defined"
    ]
  }
};

async function initializePRIAContext() {
  console.log('🚀 Initializing PRIA context system...');
  
  try {
    // Ensure .pria directory exists
    await fs.mkdir('.pria', { recursive: true });
    await fs.mkdir('.pria/scripts', { recursive: true });
    await fs.mkdir('.pria/backups', { recursive: true });

    // Create core context files
    console.log('📁 Creating core context files...');
    
    await fs.writeFile('.pria/current-phase.json', JSON.stringify(defaultContext.currentPhase, null, 2));
    await fs.writeFile('.pria/session-context.json', JSON.stringify(defaultContext.sessionContext, null, 2));
    await fs.writeFile('.pria/requirements.json', JSON.stringify(defaultContext.requirements, null, 2));
    await fs.writeFile('.pria/technical-specs.json', JSON.stringify(defaultContext.technicalSpecs, null, 2));
    await fs.writeFile('.pria/tasks.json', JSON.stringify(defaultContext.tasks, null, 2));
    await fs.writeFile('.pria/artifacts.json', JSON.stringify(defaultContext.artifacts, null, 2));
    await fs.writeFile('.pria/progress-tracking.json', JSON.stringify(defaultContext.progressTracking, null, 2));
    await fs.writeFile('.pria/communication-log.json', JSON.stringify(defaultContext.communicationLog, null, 2));
    await fs.writeFile('.pria/github-sync-status.json', JSON.stringify(defaultContext.githubSyncStatus, null, 2));

    // Create subagent context files
    console.log('🤖 Creating subagent context files...');
    
    for (const [role, context] of Object.entries(subagentContexts)) {
      await fs.writeFile(`.pria/subagent-${role}.json`, JSON.stringify(context, null, 2));
    }

    // Create parallel processing configuration
    await fs.writeFile('.pria/parallel-tasks.json', JSON.stringify({
      lastUpdate: new Date().toISOString(),
      parallelBatches: [],
      activeTasks: [],
      dependencies: {}
    }, null, 2));

    // Create dependencies configuration  
    await fs.writeFile('.pria/dependencies.json', JSON.stringify({
      lastUpdate: new Date().toISOString(),
      taskDependencies: {},
      criticalPath: [],
      dependencyGraph: {}
    }, null, 2));

    // Create helper scripts
    console.log('🔧 Creating helper scripts...');
    
    await createHelperScripts();

    console.log('✅ PRIA context system initialized successfully!');
    console.log('📋 Context files created in .pria/ directory');
    console.log('🤖 Subagent contexts configured for all 7 phases');
    console.log('🔄 Ready for Builder App communication');

    return true;

  } catch (error) {
    console.error('❌ Failed to initialize PRIA context:', error);
    return false;
  }
}

async function createHelperScripts() {
  // Sync with Builder App script
  const syncScript = `#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs').promises;

async function syncWithBuilderApp() {
  try {
    const sessionContext = JSON.parse(await fs.readFile('.pria/session-context.json', 'utf8'));
    
    // Get latest requirements from Builder App
    const requirementsResponse = await fetch(
      \`\${sessionContext.builderAppUrl}/api/requirements/\${sessionContext.sessionId}\`
    );
    
    if (requirementsResponse.ok) {
      const latestRequirements = await requirementsResponse.json();
      await fs.writeFile('.pria/requirements.json', JSON.stringify(latestRequirements, null, 2));
      console.log('📋 Requirements synchronized from Builder App');
    }
    
    // Sync other context as needed
    console.log('🔄 Sync with Builder App completed');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

syncWithBuilderApp();
`;

  await fs.writeFile('.pria/scripts/sync-with-builder.js', syncScript);

  // Progress update script
  const progressScript = `#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs').promises;

async function updateProgress(phase, status, percentage = 0, artifacts = []) {
  try {
    const sessionContext = JSON.parse(await fs.readFile('.pria/session-context.json', 'utf8'));
    
    const update = {
      phase,
      status,
      percentage,
      artifacts,
      timestamp: new Date().toISOString(),
      subagent: sessionContext.currentSubagent
    };
    
    await fetch(
      \`\${sessionContext.builderAppUrl}/api/workflow/\${sessionContext.sessionId}/progress\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      }
    );
    
    // Update local progress tracking
    const progress = JSON.parse(await fs.readFile('.pria/progress-tracking.json', 'utf8'));
    progress.phases[phase] = { 
      status, 
      percentage, 
      lastUpdate: new Date().toISOString() 
    };
    progress.lastActivity = new Date().toISOString();
    
    await fs.writeFile('.pria/progress-tracking.json', JSON.stringify(progress, null, 2));
    
    console.log(\`📈 Progress updated: Phase \${phase} - \${status} (\${percentage}%)\`);
    
  } catch (error) {
    console.error('❌ Progress update failed:', error);
  }
}

// CLI usage: node update-progress.js <phase> <status> [percentage] [artifacts]
const [phase, status, percentage, ...artifacts] = process.argv.slice(2);
if (phase && status) {
  updateProgress(parseInt(phase), status, parseInt(percentage) || 0, artifacts);
} else {
  console.log('Usage: node update-progress.js <phase> <status> [percentage] [artifacts...]');
}
`;

  await fs.writeFile('.pria/scripts/update-progress.js', progressScript);

  // PRIA compliance validation script
  const validationScript = `#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function validatePRIACompliance() {
  console.log('🔍 Running PRIA compliance validation...');
  
  const violations = [];
  
  try {
    // Check for workspace isolation in database queries
    const files = await getAllFiles('.', ['.js', '.ts', '.tsx']);
    
    for (const file of files) {
      if (file.includes('node_modules') || file.includes('.next')) continue;
      
      const content = await fs.readFile(file, 'utf8');
      
      // Check for Supabase queries without workspace_id
      const supabaseQueries = content.match(/supabase\\s*\\.\\s*from\\s*\\([^)]+\\)/g) || [];
      
      for (const query of supabaseQueries) {
        if (!content.includes('workspace_id') || !query.includes('workspace_id')) {  
          violations.push(\`Missing workspace_id in query: \${file}:\${query}\`);
        }
      }
      
      // Check for hardcoded secrets
      if (content.includes('sk-') && !file.includes('.env')) {
        violations.push(\`Potential hardcoded API key in: \${file}\`);
      }
    }
    
    // Validate database schema files
    const schemaFiles = await getAllFiles('.', ['.sql']);
    for (const schemaFile of schemaFiles) {
      const content = await fs.readFile(schemaFile, 'utf8');
      
      if (content.includes('CREATE TABLE') && !content.includes('workspace_id')) {
        violations.push(\`Missing workspace_id in table schema: \${schemaFile}\`);
      }
      
      if (content.includes('CREATE TABLE') && !content.includes('ROW LEVEL SECURITY')) {
        violations.push(\`Missing RLS policy in table schema: \${schemaFile}\`);
      }
    }
    
    // Generate compliance report
    const report = {
      timestamp: new Date().toISOString(),
      passed: violations.length === 0,
      violations,
      totalFiles: files.length,
      schemaFiles: schemaFiles.length
    };
    
    await fs.writeFile('.pria/compliance-report.json', JSON.stringify(report, null, 2));
    
    if (violations.length === 0) {
      console.log('✅ PRIA compliance validation passed!');
    } else {
      console.log(\`❌ PRIA compliance validation failed with \${violations.length} violations:\`);
      violations.forEach(v => console.log(\`  - \${v}\`));
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Compliance validation failed:', error);
    return { passed: false, error: error.message };
  }
}

async function getAllFiles(dir, extensions) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
      files.push(...await getAllFiles(fullPath, extensions));
    } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

validatePRIACompliance();
`;

  await fs.writeFile('.pria/scripts/validate-compliance.js', validationScript);

  // Make scripts executable
  const scripts = [
    '.pria/scripts/sync-with-builder.js',
    '.pria/scripts/update-progress.js', 
    '.pria/scripts/validate-compliance.js'
  ];
  
  for (const script of scripts) {
    try {
      await fs.chmod(script, 0o755);
    } catch (error) {
      // Ignore chmod errors on Windows
    }
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializePRIAContext().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { initializePRIAContext };