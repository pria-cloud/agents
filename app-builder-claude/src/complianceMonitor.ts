import pino from 'pino';

const logger = pino({
  name: 'compliance-monitor',
  level: process.env.LOG_LEVEL || 'info',
});

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'architecture' | 'quality' | 'performance';
}

export interface ComplianceResult {
  check: ComplianceCheck;
  passed: boolean;
  message: string;
  evidence?: string;
  suggestion?: string;
}

export interface ComplianceReport {
  overall: 'pass' | 'fail' | 'warning';
  results: ComplianceResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
  };
}

export class ComplianceMonitor {
  private checks: ComplianceCheck[] = [
    // Security Checks (Critical)
    {
      id: 'security-tenant-isolation',
      name: 'Tenant Isolation',
      description: 'All database queries must filter by workspace_id',
      severity: 'critical',
      category: 'security',
    },
    {
      id: 'security-user-registration',
      name: 'User Registration Pattern',
      description: 'After auth.signUp(), must create record in public.users table',
      severity: 'critical',
      category: 'security',
    },
    {
      id: 'security-no-hardcoded-secrets',
      name: 'No Hardcoded Secrets',
      description: 'All secrets must use environment variables',
      severity: 'critical',
      category: 'security',
    },
    {
      id: 'security-no-pii-logging',
      name: 'No PII Logging',
      description: 'Personally identifiable information must not be logged',
      severity: 'critical',
      category: 'security',
    },
    {
      id: 'security-access-control',
      name: 'Access Control Validation',
      description: 'User permissions must be validated before data access',
      severity: 'critical',
      category: 'security',
    },

    // Architecture Checks (High)
    {
      id: 'arch-nextjs-app-router',
      name: 'Next.js App Router',
      description: 'Must use Next.js 15 App Router structure',
      severity: 'high',
      category: 'architecture',
    },
    {
      id: 'arch-typescript-usage',
      name: 'TypeScript Usage',
      description: 'All files must use TypeScript (.ts/.tsx)',
      severity: 'high',
      category: 'architecture',
    },
    {
      id: 'arch-supabase-patterns',
      name: 'Supabase Integration Patterns',
      description: 'Must follow established Supabase client patterns',
      severity: 'high',
      category: 'architecture',
    },
    {
      id: 'arch-import-aliases',
      name: 'Import Alias Usage',
      description: 'Must use @/ alias, never @/src/',
      severity: 'high',
      category: 'architecture',
    },
    {
      id: 'arch-file-structure',
      name: 'File Structure Compliance',
      description: 'Must follow PRIA file structure conventions',
      severity: 'high',
      category: 'architecture',
    },

    // Quality Checks (Medium)
    {
      id: 'quality-production-ready',
      name: 'Production Ready Code',
      description: 'No placeholders, TODOs, or mock data',
      severity: 'medium',
      category: 'quality',
    },
    {
      id: 'quality-no-console-logs',
      name: 'No Console Logs',
      description: 'Remove all debugging console statements',
      severity: 'medium',
      category: 'quality',
    },
    {
      id: 'quality-complete-implementations',
      name: 'Complete Implementations',
      description: 'All functions must be fully implemented',
      severity: 'medium',
      category: 'quality',
    },
    {
      id: 'quality-proper-error-handling',
      name: 'Proper Error Handling',
      description: 'Use appropriate try/catch patterns',
      severity: 'medium',
      category: 'quality',
    },
    {
      id: 'quality-typescript-typing',
      name: 'TypeScript Typing',
      description: 'Proper typing for all variables and functions',
      severity: 'medium',
      category: 'quality',
    },
  ];

  /**
   * Run compliance checks on conversation content
   */
  async checkConversationCompliance(
    conversationContent: string,
    files: any[] = [],
    context: any = {}
  ): Promise<ComplianceReport> {
    logger.info({ event: 'compliance.check.start', fileCount: files.length }, 'Starting compliance check');

    const results: ComplianceResult[] = [];

    for (const check of this.checks) {
      const result = await this.runSingleCheck(check, conversationContent, files, context);
      results.push(result);
    }

    const summary = this.generateSummary(results);
    const overall = this.determineOverallStatus(results);

    const report: ComplianceReport = {
      overall,
      results,
      summary,
    };

    logger.info({ event: 'compliance.check.complete', overall, summary }, 'Compliance check completed');
    return report;
  }

  /**
   * Run a single compliance check
   */
  private async runSingleCheck(
    check: ComplianceCheck,
    conversationContent: string,
    files: any[],
    context: any
  ): Promise<ComplianceResult> {
    logger.debug({ event: 'compliance.check.single', checkId: check.id }, 'Running single compliance check');

    try {
      switch (check.id) {
        case 'security-tenant-isolation':
          return this.checkTenantIsolation(check, files);
        case 'security-user-registration':
          return this.checkUserRegistration(check, files);
        case 'security-no-hardcoded-secrets':
          return this.checkNoHardcodedSecrets(check, files);
        case 'security-no-pii-logging':
          return this.checkNoPIILogging(check, files);
        case 'security-access-control':
          return this.checkAccessControl(check, files);
        case 'arch-nextjs-app-router':
          return this.checkNextJSAppRouter(check, files);
        case 'arch-typescript-usage':
          return this.checkTypeScriptUsage(check, files);
        case 'arch-supabase-patterns':
          return this.checkSupabasePatterns(check, files);
        case 'arch-import-aliases':
          return this.checkImportAliases(check, files);
        case 'arch-file-structure':
          return this.checkFileStructure(check, files);
        case 'quality-production-ready':
          return this.checkProductionReady(check, files);
        case 'quality-no-console-logs':
          return this.checkNoConsoleLogs(check, files);
        case 'quality-complete-implementations':
          return this.checkCompleteImplementations(check, files);
        case 'quality-proper-error-handling':
          return this.checkProperErrorHandling(check, files);
        case 'quality-typescript-typing':
          return this.checkTypeScriptTyping(check, files);
        default:
          return {
            check,
            passed: true,
            message: 'Check not implemented',
          };
      }
    } catch (error: any) {
      logger.error({ event: 'compliance.check.error', checkId: check.id, error: error.message }, 'Error running compliance check');
      return {
        check,
        passed: false,
        message: `Error running check: ${error.message}`,
      };
    }
  }

  /**
   * Check tenant isolation compliance
   */
  private checkTenantIsolation(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      if (file.content && file.content.includes('supabase.from(')) {
        // Check if workspace_id filtering is present
        const hasWorkspaceFilter = file.content.includes('workspace_id') || 
                                  file.content.includes('workspaceId');
        
        if (!hasWorkspaceFilter) {
          violations.push(`${file.filePath}: Missing workspace_id filter`);
        }
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'All database queries properly filter by workspace_id'
        : `Found ${violations.length} violations`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Add .eq("workspace_id", workspaceId) to all database queries'
        : undefined,
    };
  }

  /**
   * Check user registration pattern compliance
   */
  private checkUserRegistration(check: ComplianceCheck, files: any[]): ComplianceResult {
    let hasSignUp = false;
    let hasUserTableInsert = false;
    
    files.forEach(file => {
      if (file.content) {
        if (file.content.includes('auth.signUp')) {
          hasSignUp = true;
        }
        if (file.content.includes('from("users")') && file.content.includes('insert')) {
          hasUserTableInsert = true;
        }
      }
    });

    const passed = !hasSignUp || (hasSignUp && hasUserTableInsert);
    
    return {
      check,
      passed,
      message: passed 
        ? 'User registration pattern is correct'
        : 'Missing user table insert after auth.signUp()',
      suggestion: !passed 
        ? 'After auth.signUp(), create a record in the public.users table'
        : undefined,
    };
  }

  /**
   * Check for hardcoded secrets
   */
  private checkNoHardcodedSecrets(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    const secretPatterns = [
      /['"]sk-[a-zA-Z0-9]{32,}['"]/, // API keys
      /['"]password['"]:\s*['"][^'"]+['"]/, // Hardcoded passwords
      /['"]secret['"]:\s*['"][^'"]+['"]/, // Secrets
      /['"]token['"]:\s*['"][^'"]+['"]/, // Tokens
    ];

    files.forEach(file => {
      if (file.content) {
        secretPatterns.forEach(pattern => {
          if (pattern.test(file.content)) {
            violations.push(`${file.filePath}: Potential hardcoded secret detected`);
          }
        });
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'No hardcoded secrets found'
        : `Found ${violations.length} potential hardcoded secrets`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Use process.env.VARIABLE_NAME for all secrets'
        : undefined,
    };
  }

  /**
   * Check for PII logging
   */
  private checkNoPIILogging(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    const piiPatterns = [
      /console\.log.*email/i,
      /console\.log.*password/i,
      /console\.log.*phone/i,
      /console\.log.*ssn/i,
      /logger.*email/i,
      /logger.*password/i,
    ];

    files.forEach(file => {
      if (file.content) {
        piiPatterns.forEach(pattern => {
          if (pattern.test(file.content)) {
            violations.push(`${file.filePath}: Potential PII logging detected`);
          }
        });
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'No PII logging detected'
        : `Found ${violations.length} potential PII logging violations`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Remove or mask PII from log statements'
        : undefined,
    };
  }

  /**
   * Check access control validation
   */
  private checkAccessControl(check: ComplianceCheck, files: any[]): ComplianceResult {
    // This is a simplified check - in practice, you'd want more sophisticated analysis
    const hasAuth = files.some(file => 
      file.content && (
        file.content.includes('auth.getUser()') ||
        file.content.includes('getUser()')
      )
    );

    return {
      check,
      passed: hasAuth,
      message: hasAuth 
        ? 'Authentication checks present'
        : 'No authentication checks found',
      suggestion: !hasAuth 
        ? 'Add user authentication checks before data access'
        : undefined,
    };
  }

  /**
   * Check Next.js App Router usage
   */
  private checkNextJSAppRouter(check: ComplianceCheck, files: any[]): ComplianceResult {
    const hasAppRouter = files.some(file => 
      file.filePath.startsWith('app/') && 
      (file.filePath.endsWith('page.tsx') || file.filePath.endsWith('route.ts'))
    );

    return {
      check,
      passed: hasAppRouter,
      message: hasAppRouter 
        ? 'Using Next.js App Router structure'
        : 'No App Router structure detected',
      suggestion: !hasAppRouter 
        ? 'Use app/ directory for pages and API routes'
        : undefined,
    };
  }

  /**
   * Check TypeScript usage
   */
  private checkTypeScriptUsage(check: ComplianceCheck, files: any[]): ComplianceResult {
    const nonTSFiles = files.filter(file => 
      !file.filePath.endsWith('.ts') && 
      !file.filePath.endsWith('.tsx') &&
      !file.filePath.endsWith('.json') &&
      !file.filePath.endsWith('.md')
    );

    return {
      check,
      passed: nonTSFiles.length === 0,
      message: nonTSFiles.length === 0 
        ? 'All files use TypeScript'
        : `Found ${nonTSFiles.length} non-TypeScript files`,
      evidence: nonTSFiles.map(f => f.filePath).join('; '),
      suggestion: nonTSFiles.length > 0 
        ? 'Convert all JavaScript files to TypeScript'
        : undefined,
    };
  }

  /**
   * Check Supabase patterns
   */
  private checkSupabasePatterns(check: ComplianceCheck, files: any[]): ComplianceResult {
    const supabaseFiles = files.filter(file => 
      file.content && file.content.includes('supabase')
    );

    if (supabaseFiles.length === 0) {
      return {
        check,
        passed: true,
        message: 'No Supabase usage detected',
      };
    }

    const hasProperImports = supabaseFiles.every(file => 
      file.content.includes('@/lib/supabase/') ||
      file.content.includes('from "supabase"') ||
      file.content.includes('from "@supabase/')
    );

    return {
      check,
      passed: hasProperImports,
      message: hasProperImports 
        ? 'Supabase imports follow established patterns'
        : 'Supabase imports do not follow established patterns',
      suggestion: !hasProperImports 
        ? 'Use @/lib/supabase/client or @/lib/supabase/server for imports'
        : undefined,
    };
  }

  /**
   * Check import aliases
   */
  private checkImportAliases(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      if (file.content && file.content.includes('@/src/')) {
        violations.push(`${file.filePath}: Uses forbidden @/src/ import`);
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'Import aliases are correct'
        : `Found ${violations.length} forbidden @/src/ imports`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Use @/ instead of @/src/ for imports'
        : undefined,
    };
  }

  /**
   * Check file structure compliance
   */
  private checkFileStructure(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      // Check for forbidden file modifications
      const forbiddenFiles = [
        'package.json', 'next.config.js', 'tailwind.config.ts',
        'tsconfig.json', 'components/ui/'
      ];
      
      if (forbiddenFiles.some(forbidden => file.filePath.includes(forbidden))) {
        violations.push(`${file.filePath}: Modifying forbidden scaffold file`);
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'File structure is compliant'
        : `Found ${violations.length} file structure violations`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Do not modify scaffold files'
        : undefined,
    };
  }

  /**
   * Check production ready code
   */
  private checkProductionReady(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    const patterns = [
      /TODO/i,
      /FIXME/i,
      /placeholder/i,
      /mock data/i,
      /temporary/i,
    ];

    files.forEach(file => {
      if (file.content) {
        patterns.forEach(pattern => {
          if (pattern.test(file.content)) {
            violations.push(`${file.filePath}: Contains non-production code`);
          }
        });
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'Code is production ready'
        : `Found ${violations.length} non-production code patterns`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Remove TODOs, placeholders, and mock data'
        : undefined,
    };
  }

  /**
   * Check for console logs
   */
  private checkNoConsoleLogs(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      if (file.content && file.content.includes('console.')) {
        violations.push(`${file.filePath}: Contains console statements`);
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'No console statements found'
        : `Found ${violations.length} console statements`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Remove all console.log statements'
        : undefined,
    };
  }

  /**
   * Check complete implementations
   */
  private checkCompleteImplementations(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      if (file.content) {
        if (file.content.includes('throw new Error("Not implemented")') ||
            file.content.includes('// TODO: implement') ||
            file.content.includes('return null; // placeholder')) {
          violations.push(`${file.filePath}: Contains incomplete implementation`);
        }
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'All implementations are complete'
        : `Found ${violations.length} incomplete implementations`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Complete all function implementations'
        : undefined,
    };
  }

  /**
   * Check proper error handling
   */
  private checkProperErrorHandling(check: ComplianceCheck, files: any[]): ComplianceResult {
    // This is a simplified check - you might want more sophisticated analysis
    const hasErrorHandling = files.some(file => 
      file.content && (
        file.content.includes('try {') ||
        file.content.includes('catch (') ||
        file.content.includes('throw new Error')
      )
    );

    return {
      check,
      passed: hasErrorHandling,
      message: hasErrorHandling 
        ? 'Error handling patterns found'
        : 'No error handling patterns detected',
      suggestion: !hasErrorHandling 
        ? 'Add appropriate try/catch blocks for error handling'
        : undefined,
    };
  }

  /**
   * Check TypeScript typing
   */
  private checkTypeScriptTyping(check: ComplianceCheck, files: any[]): ComplianceResult {
    const violations: string[] = [];
    
    files.forEach(file => {
      if (file.content && file.filePath.endsWith('.ts') || file.filePath.endsWith('.tsx')) {
        // Check for 'any' type usage
        if (file.content.includes(': any') || file.content.includes('<any>')) {
          violations.push(`${file.filePath}: Uses 'any' type`);
        }
      }
    });

    return {
      check,
      passed: violations.length === 0,
      message: violations.length === 0 
        ? 'TypeScript typing is proper'
        : `Found ${violations.length} typing issues`,
      evidence: violations.join('; '),
      suggestion: violations.length > 0 
        ? 'Replace any types with proper TypeScript types'
        : undefined,
    };
  }

  /**
   * Generate summary of compliance results
   */
  private generateSummary(results: ComplianceResult[]): ComplianceReport['summary'] {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const critical = results.filter(r => !r.passed && r.check.severity === 'critical').length;

    return { total, passed, failed, critical };
  }

  /**
   * Determine overall compliance status
   */
  private determineOverallStatus(results: ComplianceResult[]): 'pass' | 'fail' | 'warning' {
    const criticalFailures = results.filter(r => !r.passed && r.check.severity === 'critical');
    const highFailures = results.filter(r => !r.passed && r.check.severity === 'high');
    
    if (criticalFailures.length > 0) {
      return 'fail';
    } else if (highFailures.length > 0) {
      return 'warning';
    } else {
      return 'pass';
    }
  }

  /**
   * Get all compliance checks
   */
  getChecks(): ComplianceCheck[] {
    return this.checks;
  }

  /**
   * Get checks by category
   */
  getChecksByCategory(category: ComplianceCheck['category']): ComplianceCheck[] {
    return this.checks.filter(check => check.category === category);
  }

  /**
   * Get checks by severity
   */
  getChecksBySeverity(severity: ComplianceCheck['severity']): ComplianceCheck[] {
    return this.checks.filter(check => check.severity === severity);
  }
} 