/**
 * PRIA Compliance Checker - Real-time validation of PRIA architectural standards
 * Analyzes code for compliance with PRIA multi-tenant, security-first patterns
 */

export interface ComplianceIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'security' | 'architecture' | 'performance' | 'maintainability' | 'accessibility'
  title: string
  description: string
  file: string
  line?: number
  column?: number
  code?: string
  fix?: string
  documentation?: string
}

export interface ComplianceReport {
  score: number // 0-100
  totalIssues: number
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  issues: ComplianceIssue[]
  summary: string
  recommendations: string[]
}

export interface FileAnalysis {
  file: string
  content: string
  language: 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'sql' | 'markdown'
  issues: ComplianceIssue[]
}

export class PRIAComplianceChecker {
  private static issueId = 0

  /**
   * Analyze code files for PRIA compliance
   */
  static analyzeFiles(files: { path: string; content: string }[]): ComplianceReport {
    const allIssues: ComplianceIssue[] = []
    
    files.forEach(file => {
      const fileAnalysis = this.analyzeFile(file.path, file.content)
      allIssues.push(...fileAnalysis.issues)
    })

    return this.generateReport(allIssues)
  }

  /**
   * Analyze a single file for PRIA compliance
   */
  static analyzeFile(filePath: string, content: string): FileAnalysis {
    const language = this.detectLanguage(filePath)
    const issues: ComplianceIssue[] = []

    // Run all compliance checks
    issues.push(...this.checkWorkspaceIsolation(filePath, content))
    issues.push(...this.checkAuthentication(filePath, content))
    issues.push(...this.checkErrorHandling(filePath, content))
    issues.push(...this.checkTypeScript(filePath, content))
    issues.push(...this.checkSecurity(filePath, content))
    issues.push(...this.checkPerformance(filePath, content))
    issues.push(...this.checkAccessibility(filePath, content))
    issues.push(...this.checkArchitecture(filePath, content))

    return {
      file: filePath,
      content,
      language,
      issues
    }
  }

  /**
   * Check workspace isolation compliance
   */
  private static checkWorkspaceIsolation(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check for database queries without workspace_id
    if (file.includes('.ts') || file.includes('.tsx')) {
      const supabaseQueryPattern = /\.from\(['"`]([^'"`]+)['"`]\)[^.]*\.select\(/g
      let match
      
      while ((match = supabaseQueryPattern.exec(content)) !== null) {
        const beforeQuery = content.substring(0, match.index)
        const afterQuery = content.substring(match.index, match.index + 200)
        
        // Check if workspace_id filter is present
        if (!afterQuery.includes('workspace_id') && !afterQuery.includes('workspaceId')) {
          const lineNumber = (beforeQuery.match(/\n/g) || []).length + 1
          
          issues.push({
            id: `workspace-${++this.issueId}`,
            severity: 'critical',
            category: 'security',
            title: 'Missing workspace isolation',
            description: `Database query on table '${match[1]}' missing workspace_id filtering`,
            file,
            line: lineNumber,
            code: match[0],
            fix: `Add .eq('workspace_id', workspaceId) to the query chain`,
            documentation: 'All database queries MUST include workspace_id filtering for multi-tenant isolation'
          })
        }
      }

      // Check for missing workspace_id in INSERT operations
      const insertPattern = /\.insert\(\s*{([^}]+)}\s*\)/g
      while ((match = insertPattern.exec(content)) !== null) {
        if (!match[1].includes('workspace_id')) {
          const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
          
          issues.push({
            id: `insert-workspace-${++this.issueId}`,
            severity: 'critical',
            category: 'security',
            title: 'Missing workspace_id in INSERT',
            description: 'INSERT operation missing workspace_id field',
            file,
            line: lineNumber,
            code: match[0],
            fix: 'Include workspace_id: workspaceId in the INSERT object',
            documentation: 'All database inserts MUST include workspace_id for tenant isolation'
          })
        }
      }
    }

    return issues
  }

  /**
   * Check authentication compliance
   */
  private static checkAuthentication(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check server actions for authentication
    if (file.includes('route.ts') || content.includes("'use server'")) {
      if (!content.includes('auth.getUser()') && !content.includes('getUser()')) {
        issues.push({
          id: `auth-${++this.issueId}`,
          severity: 'critical',
          category: 'security',
          title: 'Missing authentication check',
          description: 'Server action or API route missing user authentication',
          file,
          fix: 'Add const { data: { user } } = await supabase.auth.getUser() and validate user exists',
          documentation: 'All protected endpoints MUST verify user authentication'
        })
      }

      // Check for workspace validation after auth
      if (content.includes('getUser()') && !content.includes('workspace_id')) {
        issues.push({
          id: `workspace-auth-${++this.issueId}`,
          severity: 'high',
          category: 'security',
          title: 'Missing workspace authorization',
          description: 'Authentication present but workspace access not validated',
          file,
          fix: 'Extract and validate workspace_id from user.app_metadata',
          documentation: 'After authentication, validate user access to the requested workspace'
        })
      }
    }

    return issues
  }

  /**
   * Check error handling compliance
   */
  private static checkErrorHandling(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check for try-catch in async functions
    if (file.includes('.ts') || file.includes('.tsx')) {
      const asyncFunctionPattern = /export\s+async\s+function\s+\w+[^{]*{([^}]*(?:{[^}]*}[^}]*)*)}/g
      let match
      
      while ((match = asyncFunctionPattern.exec(content)) !== null) {
        if (!match[1].includes('try') || !match[1].includes('catch')) {
          const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
          
          issues.push({
            id: `error-handling-${++this.issueId}`,
            severity: 'medium',
            category: 'maintainability',
            title: 'Missing error handling',
            description: 'Async function missing try-catch error handling',
            file,
            line: lineNumber,
            fix: 'Wrap async operations in try-catch blocks',
            documentation: 'All async functions should include comprehensive error handling'
          })
        }
      }

      // Check for proper error returns
      if (content.includes('return { error:') && !content.includes('console.error')) {
        issues.push({
          id: `error-logging-${++this.issueId}`,
          severity: 'medium',
          category: 'maintainability',
          title: 'Missing error logging',
          description: 'Error returned without logging for debugging',
          file,
          fix: 'Add console.error() before returning error responses',
          documentation: 'Log errors for debugging while returning user-friendly messages'
        })
      }
    }

    return issues
  }

  /**
   * Check TypeScript compliance
   */
  private static checkTypeScript(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    if (file.includes('.ts') || file.includes('.tsx')) {
      // Check for 'any' types
      const anyTypePattern = /:\s*any\b/g
      let match
      
      while ((match = anyTypePattern.exec(content)) !== null) {
        const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
        
        issues.push({
          id: `typescript-any-${++this.issueId}`,
          severity: 'high',
          category: 'maintainability',
          title: 'Use of any type',
          description: 'TypeScript any type used instead of proper typing',
          file,
          line: lineNumber,
          code: match[0],
          fix: 'Replace any with specific type or interface',
          documentation: 'PRIA requires TypeScript strict mode with no any types'
        })
      }

      // Check for missing return types on functions
      const functionPattern = /function\s+\w+\s*\([^)]*\)\s*{/g
      while ((match = functionPattern.exec(content)) !== null) {
        if (!match[0].includes(':')) {
          const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
          
          issues.push({
            id: `return-type-${++this.issueId}`,
            severity: 'medium',
            category: 'maintainability',
            title: 'Missing return type',
            description: 'Function missing explicit return type annotation',
            file,
            line: lineNumber,
            fix: 'Add explicit return type annotation',
            documentation: 'All functions should have explicit return type annotations'
          })
        }
      }
    }

    return issues
  }

  /**
   * Check security compliance
   */
  private static checkSecurity(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key['"`]\s*:\s*['"`][^'"`]{10,}/gi,
      /secret['"`]\s*:\s*['"`][^'"`]{10,}/gi,
      /password['"`]\s*:\s*['"`][^'"`]{6,}/gi,
      /token['"`]\s*:\s*['"`][^'"`]{20,}/gi
    ]

    secretPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
        
        issues.push({
          id: `hardcoded-secret-${++this.issueId}`,
          severity: 'critical',
          category: 'security',
          title: 'Hardcoded secret detected',
          description: 'Potential hardcoded API key, secret, or password found',
          file,
          line: lineNumber,
          fix: 'Move secret to environment variables',
          documentation: 'Never hardcode secrets in source code'
        })
      }
    })

    // Check for SQL injection vulnerabilities
    if (content.includes('`SELECT') || content.includes('`INSERT') || content.includes('`UPDATE')) {
      issues.push({
        id: `sql-injection-${++this.issueId}`,
        severity: 'critical',
        category: 'security',
        title: 'Potential SQL injection',
        description: 'Raw SQL query detected - use parameterized queries',
        file,
        fix: 'Use Supabase query builder or parameterized queries',
        documentation: 'Always use parameterized queries to prevent SQL injection'
      })
    }

    return issues
  }

  /**
   * Check performance compliance
   */
  private static checkPerformance(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check for missing React.memo on components
    if (file.includes('.tsx') && content.includes('export default function')) {
      if (!content.includes('React.memo') && !content.includes('memo(')) {
        issues.push({
          id: `react-memo-${++this.issueId}`,
          severity: 'low',
          category: 'performance',
          title: 'Consider React.memo',
          description: 'Component could benefit from React.memo for performance',
          file,
          fix: 'Wrap component with React.memo if it receives props',
          documentation: 'Use React.memo for components that receive props to prevent unnecessary re-renders'
        })
      }
    }

    // Check for large bundle imports
    const largeLibraryPattern = /(import.*from ['"`]lodash['"`]|import.*from ['"`]moment['"`])/g
    let match
    
    while ((match = largeLibraryPattern.exec(content)) !== null) {
      const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
      
      issues.push({
        id: `large-import-${++this.issueId}`,
        severity: 'medium',
        category: 'performance',
        title: 'Large library import',
        description: 'Importing large library that could impact bundle size',
        file,
        line: lineNumber,
        fix: 'Use tree-shaking or smaller alternatives',
        documentation: 'Prefer smaller, tree-shakeable libraries for better performance'
      })
    }

    return issues
  }

  /**
   * Check accessibility compliance
   */
  private static checkAccessibility(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    if (file.includes('.tsx')) {
      // Check for missing alt text on images
      const imgPattern = /<img\s+(?![^>]*alt=)[^>]*>/g
      let match
      
      while ((match = imgPattern.exec(content)) !== null) {
        const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
        
        issues.push({
          id: `missing-alt-${++this.issueId}`,
          severity: 'high',
          category: 'accessibility',
          title: 'Missing alt text',
          description: 'Image missing alt attribute for screen readers',
          file,
          line: lineNumber,
          code: match[0],
          fix: 'Add descriptive alt attribute to image',
          documentation: 'All images must have alt text for accessibility'
        })
      }

      // Check for missing form labels
      const inputPattern = /<input\s+(?![^>]*aria-label=)(?![^>]*id=)[^>]*>/g
      while ((match = inputPattern.exec(content)) !== null) {
        const lineNumber = (content.substring(0, match.index).match(/\n/g) || []).length + 1
        
        issues.push({
          id: `missing-label-${++this.issueId}`,
          severity: 'high',
          category: 'accessibility',
          title: 'Missing form label',
          description: 'Input missing associated label or aria-label',
          file,
          line: lineNumber,
          fix: 'Add label element or aria-label attribute',
          documentation: 'All form inputs must have associated labels'
        })
      }
    }

    return issues
  }

  /**
   * Check architecture compliance
   */
  private static checkArchitecture(file: string, content: string): ComplianceIssue[] {
    const issues: ComplianceIssue[] = []

    // Check for proper component structure
    if (file.includes('components/ui/')) {
      issues.push({
        id: `ui-component-${++this.issueId}`,
        severity: 'info',
        category: 'architecture',
        title: 'UI component modification',
        description: 'Modifying shadcn/ui component - ensure this is intentional',
        file,
        fix: 'Consider extending instead of modifying base UI components',
        documentation: 'shadcn/ui components should generally not be modified directly'
      })
    }

    // Check for proper file structure
    if (file.includes('pages/') && !file.includes('app/')) {
      issues.push({
        id: `pages-router-${++this.issueId}`,
        severity: 'medium',
        category: 'architecture',
        title: 'Legacy Pages Router detected',
        description: 'Using Pages Router instead of App Router',
        file,
        fix: 'Migrate to Next.js App Router for better performance',
        documentation: 'PRIA applications should use Next.js App Router'
      })
    }

    return issues
  }

  /**
   * Generate compliance report
   */
  private static generateReport(issues: ComplianceIssue[]): ComplianceReport {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length
    const highIssues = issues.filter(i => i.severity === 'high').length
    const mediumIssues = issues.filter(i => i.severity === 'medium').length
    const lowIssues = issues.filter(i => i.severity === 'low').length

    // Calculate score (100 - weighted penalty for issues)
    const score = Math.max(0, 100 - (
      criticalIssues * 25 +
      highIssues * 10 +
      mediumIssues * 5 +
      lowIssues * 2
    ))

    const recommendations = this.generateRecommendations(issues)
    const summary = this.generateSummary(score, issues)

    return {
      score,
      totalIssues: issues.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      issues,
      summary,
      recommendations
    }
  }

  /**
   * Generate recommendations based on issues
   */
  private static generateRecommendations(issues: ComplianceIssue[]): string[] {
    const recommendations: string[] = []

    if (issues.some(i => i.category === 'security' && i.severity === 'critical')) {
      recommendations.push('🔥 CRITICAL: Address security vulnerabilities immediately')
    }

    if (issues.filter(i => i.title.includes('workspace')).length > 0) {
      recommendations.push('🏢 Implement proper workspace isolation for multi-tenancy')
    }

    if (issues.filter(i => i.title.includes('auth')).length > 0) {
      recommendations.push('🔐 Add comprehensive authentication and authorization')
    }

    if (issues.filter(i => i.category === 'accessibility').length > 3) {
      recommendations.push('♿ Improve accessibility for better user experience')
    }

    if (issues.filter(i => i.title.includes('TypeScript')).length > 5) {
      recommendations.push('📝 Enhance TypeScript usage for better code quality')
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Great job! Code follows PRIA standards well')
    }

    return recommendations
  }

  /**
   * Generate summary based on score and issues
   */
  private static generateSummary(score: number, issues: ComplianceIssue[]): string {
    if (score >= 90) {
      return `Excellent PRIA compliance (${score}/100). Code follows architectural standards with minimal issues.`
    } else if (score >= 75) {
      return `Good PRIA compliance (${score}/100). Minor improvements needed for full compliance.`
    } else if (score >= 50) {
      return `Moderate PRIA compliance (${score}/100). Several architectural issues need attention.`
    } else {
      return `Poor PRIA compliance (${score}/100). Significant architectural and security issues require immediate attention.`
    }
  }

  /**
   * Detect file language
   */
  private static detectLanguage(filePath: string): 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'sql' | 'markdown' {
    if (filePath.endsWith('.tsx')) return 'tsx'
    if (filePath.endsWith('.ts')) return 'typescript'
    if (filePath.endsWith('.jsx')) return 'jsx'
    if (filePath.endsWith('.js')) return 'javascript'
    if (filePath.endsWith('.sql')) return 'sql'
    if (filePath.endsWith('.md')) return 'markdown'
    return 'typescript' // default
  }
}