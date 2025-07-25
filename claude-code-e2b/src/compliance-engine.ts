/**
 * PRIA Compliance Validation Engine
 * Validates generated code against PRIA architectural standards and security requirements
 */

import * as ts from 'typescript'
import { readFileSync } from 'fs'
import { join } from 'path'

export interface ComplianceViolation {
  type: 'TENANCY_VIOLATION' | 'SECURITY_VIOLATION' | 'ARCHITECTURE_VIOLATION' | 'QUALITY_VIOLATION'
  severity: 'critical' | 'high' | 'medium' | 'low'
  file: string
  line?: number
  column?: number
  message: string
  suggestion?: string
  rule: string
}

export interface ComplianceResult {
  isCompliant: boolean
  score: number // 0-100
  violations: ComplianceViolation[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  recommendations: string[]
}

export interface GeneratedFile {
  filePath: string
  content: string
  language: 'typescript' | 'javascript' | 'json' | 'sql' | 'other'
}

export class PRIAComplianceEngine {
  private workspaceId: string

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId
  }

  /**
   * Validate a set of generated files for PRIA compliance
   */
  async validateCode(files: GeneratedFile[]): Promise<ComplianceResult> {
    const violations: ComplianceViolation[] = []

    for (const file of files) {
      const fileViolations = await this.validateFile(file)
      violations.push(...fileViolations)
    }

    const summary = this.calculateSummary(violations)
    const score = this.calculateComplianceScore(violations)
    const recommendations = this.generateRecommendations(violations)

    return {
      isCompliant: violations.filter(v => v.severity === 'critical').length === 0,
      score,
      violations,
      summary,
      recommendations
    }
  }

  private async validateFile(file: GeneratedFile): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = []

    switch (file.language) {
      case 'typescript':
      case 'javascript':
        violations.push(...this.validateTypeScriptFile(file))
        break
      case 'sql':
        violations.push(...this.validateSQLFile(file))
        break
      case 'json':
        violations.push(...this.validateJSONFile(file))
        break
    }

    // Common validations for all files
    violations.push(...this.validateSecrets(file))
    violations.push(...this.validateArchitecturePatterns(file))

    return violations
  }

  private validateTypeScriptFile(file: GeneratedFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    try {
      // Parse TypeScript/JavaScript
      const sourceFile = ts.createSourceFile(
        file.filePath,
        file.content,
        ts.ScriptTarget.Latest,
        true
      )

      // Check for workspace tenancy violations
      violations.push(...this.checkTenancyViolations(file, sourceFile))

      // Check authentication patterns
      violations.push(...this.checkAuthenticationPatterns(file, sourceFile))

      // Check TypeScript quality
      violations.push(...this.checkTypeScriptQuality(file, sourceFile))

      // Check for required imports
      violations.push(...this.checkRequiredImports(file, sourceFile))

      // Check middleware patterns
      if (file.filePath.includes('middleware.ts')) {
        violations.push(...this.checkMiddlewareCompliance(file, sourceFile))
      }

      // Check server actions
      if (this.isServerAction(file.content)) {
        violations.push(...this.checkServerActionCompliance(file, sourceFile))
      }

    } catch (error) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'high',
        file: file.filePath,
        message: `Failed to parse TypeScript file: ${error}`,
        rule: 'typescript-parseable'
      })
    }

    return violations
  }

  private checkTenancyViolations(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for Supabase queries without workspace_id
    const supabaseQueryPattern = /\.from\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    const workspaceFilterPattern = /\.eq\s*\(\s*['"`]workspace_id['"`]/g

    let match
    const fromCalls: Array<{ table: string; line: number }> = []

    // Find all .from() calls
    while ((match = supabaseQueryPattern.exec(file.content)) !== null) {
      const lineNumber = this.getLineNumber(file.content, match.index)
      fromCalls.push({ table: match[1], line: lineNumber })
    }

    // Check if each .from() call has corresponding workspace_id filter
    for (const fromCall of fromCalls) {
      const queryBlock = this.extractQueryBlock(file.content, fromCall.line)
      
      if (!workspaceFilterPattern.test(queryBlock)) {
        violations.push({
          type: 'TENANCY_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          line: fromCall.line,
          message: `Missing workspace_id filter for table '${fromCall.table}' - this violates tenant isolation`,
          suggestion: `.eq('workspace_id', workspaceId)`,
          rule: 'workspace-isolation'
        })
      }
    }

    return violations
  }

  private checkAuthenticationPatterns(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for proper server action authentication
    if (this.isServerAction(file.content)) {
      const hasAuthCheck = /const\s+\{\s*data:\s*\{\s*user\s*\}\s*\}\s*=\s*await\s+supabase\.auth\.getUser\(\)/.test(file.content)
      const hasUserCheck = /if\s*\(\s*!user\s*\)/.test(file.content)
      const hasWorkspaceCheck = /user\.app_metadata\?\.workspace_id/.test(file.content)

      if (!hasAuthCheck) {
        violations.push({
          type: 'SECURITY_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          message: 'Server action missing user authentication check',
          suggestion: 'Add: const { data: { user } } = await supabase.auth.getUser()',
          rule: 'server-action-auth'
        })
      }

      if (!hasUserCheck) {
        violations.push({
          type: 'SECURITY_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          message: 'Server action missing user validation',
          suggestion: 'Add: if (!user) { return { error: "Authentication required" } }',
          rule: 'server-action-validation'
        })
      }

      if (!hasWorkspaceCheck) {
        violations.push({
          type: 'TENANCY_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          message: 'Server action missing workspace_id extraction',
          suggestion: 'Add: const workspaceId = user.app_metadata?.workspace_id',
          rule: 'workspace-extraction'
        })
      }
    }

    return violations
  }

  private checkTypeScriptQuality(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for 'any' types
    const anyTypePattern = /:\s*any\b/g
    let match
    while ((match = anyTypePattern.exec(file.content)) !== null) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'medium',
        file: file.filePath,
        line: this.getLineNumber(file.content, match.index),
        message: 'Using "any" type reduces type safety',
        suggestion: 'Use specific types instead of "any"',
        rule: 'no-any-type'
      })
    }

    // Check for console.log statements
    const consoleLogPattern = /console\.log\s*\(/g
    while ((match = consoleLogPattern.exec(file.content)) !== null) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'low',
        file: file.filePath,
        line: this.getLineNumber(file.content, match.index),
        message: 'Console.log statement found in production code',
        suggestion: 'Remove console.log or use proper logging',
        rule: 'no-console-log'
      })
    }

    // Check for TODO comments
    const todoPattern = /\/\/\s*TODO|\/\*\s*TODO/gi
    while ((match = todoPattern.exec(file.content)) !== null) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'medium',
        file: file.filePath,
        line: this.getLineNumber(file.content, match.index),
        message: 'TODO comment found - incomplete implementation',
        suggestion: 'Complete the implementation or remove TODO',
        rule: 'no-todo-comments'
      })
    }

    return violations
  }

  private checkRequiredImports(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for Supabase client imports
    if (file.content.includes('supabase') && !file.content.includes('@supabase/')) {
      violations.push({
        type: 'ARCHITECTURE_VIOLATION',
        severity: 'high',
        file: file.filePath,
        message: 'Missing Supabase client import',
        suggestion: 'Import Supabase client from @supabase/supabase-js or @supabase/ssr',
        rule: 'required-imports'
      })
    }

    // Check for server-side imports in server actions
    if (this.isServerAction(file.content)) {
      if (!file.content.includes("'use server'")) {
        violations.push({
          type: 'ARCHITECTURE_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          message: 'Missing "use server" directive in server action',
          suggestion: 'Add "use server" at the top of the file',
          rule: 'server-action-directive'
        })
      }

      if (!file.content.includes('next/headers')) {
        violations.push({
          type: 'ARCHITECTURE_VIOLATION',
          severity: 'high',
          file: file.filePath,
          message: 'Server action should import cookies from next/headers',
          suggestion: 'Add: import { cookies } from "next/headers"',
          rule: 'server-action-imports'
        })
      }
    }

    return violations
  }

  private checkMiddlewareCompliance(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for required middleware exports
    if (!file.content.includes('export async function middleware')) {
      violations.push({
        type: 'ARCHITECTURE_VIOLATION',
        severity: 'critical',
        file: file.filePath,
        message: 'Middleware file missing middleware function export',
        suggestion: 'Add: export async function middleware(request: NextRequest)',
        rule: 'middleware-export'
      })
    }

    if (!file.content.includes('export const config')) {
      violations.push({
        type: 'ARCHITECTURE_VIOLATION',
        severity: 'high',
        file: file.filePath,
        message: 'Middleware file missing config export',
        suggestion: 'Add: export const config = { matcher: [...] }',
        rule: 'middleware-config'
      })
    }

    return violations
  }

  private checkServerActionCompliance(file: GeneratedFile, sourceFile: ts.SourceFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for proper error handling
    if (!file.content.includes('try {') || !file.content.includes('} catch')) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'high',
        file: file.filePath,
        message: 'Server action missing error handling',
        suggestion: 'Wrap server action logic in try-catch block',
        rule: 'server-action-error-handling'
      })
    }

    return violations
  }

  private validateSQLFile(file: GeneratedFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for workspace_id column in table creation
    if (file.content.includes('CREATE TABLE') && !file.content.includes('workspace_id')) {
      violations.push({
        type: 'TENANCY_VIOLATION',
        severity: 'critical',
        file: file.filePath,
        message: 'Table creation missing workspace_id column',
        suggestion: 'Add: workspace_id UUID NOT NULL REFERENCES workspace(id)',
        rule: 'table-workspace-column'
      })
    }

    // Check for Row-Level Security
    if (file.content.includes('CREATE TABLE') && !file.content.includes('ENABLE ROW LEVEL SECURITY')) {
      violations.push({
        type: 'SECURITY_VIOLATION',
        severity: 'critical',
        file: file.filePath,
        message: 'Table missing Row-Level Security enablement',
        suggestion: 'Add: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;',
        rule: 'table-rls'
      })
    }

    return violations
  }

  private validateJSONFile(file: GeneratedFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    try {
      const json = JSON.parse(file.content)

      // Check package.json for required dependencies
      if (file.filePath.includes('package.json')) {
        const requiredDeps = [
          'next',
          'react',
          'react-dom',
          '@supabase/ssr',
          '@supabase/supabase-js',
          'tailwindcss'
        ]

        for (const dep of requiredDeps) {
          if (!json.dependencies?.[dep] && !json.devDependencies?.[dep]) {
            violations.push({
              type: 'ARCHITECTURE_VIOLATION',
              severity: 'high',
              file: file.filePath,
              message: `Missing required dependency: ${dep}`,
              suggestion: `Add ${dep} to dependencies`,
              rule: 'required-dependencies'
            })
          }
        }

        // Check for forbidden dependencies
        const forbiddenDeps = ['@supabase/supabase-js-v1']
        for (const dep of forbiddenDeps) {
          if (json.dependencies?.[dep] || json.devDependencies?.[dep]) {
            violations.push({
              type: 'ARCHITECTURE_VIOLATION',
              severity: 'high',
              file: file.filePath,
              message: `Forbidden dependency: ${dep}`,
              suggestion: `Remove ${dep} and use approved alternative`,
              rule: 'forbidden-dependencies'
            })
          }
        }
      }

    } catch (error) {
      violations.push({
        type: 'QUALITY_VIOLATION',
        severity: 'high',
        file: file.filePath,
        message: `Invalid JSON syntax: ${error}`,
        rule: 'valid-json'
      })
    }

    return violations
  }

  private validateSecrets(file: GeneratedFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Common secret patterns
    const secretPatterns = [
      { pattern: /sk_[a-zA-Z0-9]{32,}/, name: 'Stripe Secret Key' },
      { pattern: /sk_test_[a-zA-Z0-9]{32,}/, name: 'Stripe Test Key' },
      { pattern: /pk_[a-zA-Z0-9]{32,}/, name: 'Stripe Public Key' },
      { pattern: /AIza[0-9A-Za-z\\-_]{35}/, name: 'Google API Key' },
      { pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/, name: 'UUID/API Key' },
      { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'GitHub Personal Access Token' },
      { pattern: /xoxb-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{24}/, name: 'Slack Bot Token' }
    ]

    for (const { pattern, name } of secretPatterns) {
      let match
      while ((match = pattern.exec(file.content)) !== null) {
        violations.push({
          type: 'SECURITY_VIOLATION',
          severity: 'critical',
          file: file.filePath,
          line: this.getLineNumber(file.content, match.index),
          message: `Potential ${name} found in code`,
          suggestion: 'Move secrets to environment variables',
          rule: 'no-hardcoded-secrets'
        })
      }
    }

    return violations
  }

  private validateArchitecturePatterns(file: GeneratedFile): ComplianceViolation[] {
    const violations: ComplianceViolation[] = []

    // Check for direct database connections (should use Supabase)
    const directDbPatterns = [
      /new Pool\(/,
      /pg\.connect/,
      /mysql\.connect/,
      /mongoose\.connect/
    ]

    for (const pattern of directDbPatterns) {
      if (pattern.test(file.content)) {
        violations.push({
          type: 'ARCHITECTURE_VIOLATION',
          severity: 'high',
          file: file.filePath,
          message: 'Direct database connection detected - use Supabase client instead',
          suggestion: 'Use Supabase client for database operations',
          rule: 'no-direct-db'
        })
      }
    }

    return violations
  }

  private isServerAction(content: string): boolean {
    return content.includes("'use server'") || content.includes('"use server"')
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length
  }

  private extractQueryBlock(content: string, startLine: number): string {
    const lines = content.split('\n')
    const start = Math.max(0, startLine - 3)
    const end = Math.min(lines.length, startLine + 10)
    return lines.slice(start, end).join('\n')
  }

  private calculateSummary(violations: ComplianceViolation[]) {
    return {
      critical: violations.filter(v => v.severity === 'critical').length,
      high: violations.filter(v => v.severity === 'high').length,
      medium: violations.filter(v => v.severity === 'medium').length,
      low: violations.filter(v => v.severity === 'low').length
    }
  }

  private calculateComplianceScore(violations: ComplianceViolation[]): number {
    const weights = { critical: 25, high: 10, medium: 5, low: 1 }
    const totalDeductions = violations.reduce((sum, v) => sum + weights[v.severity], 0)
    return Math.max(0, 100 - totalDeductions)
  }

  private generateRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations = new Set<string>()

    const criticalCount = violations.filter(v => v.severity === 'critical').length
    if (criticalCount > 0) {
      recommendations.add(`Fix ${criticalCount} critical security/tenancy violations immediately`)
    }

    const tenancyViolations = violations.filter(v => v.type === 'TENANCY_VIOLATION').length
    if (tenancyViolations > 0) {
      recommendations.add('Ensure all database queries include workspace_id filtering')
    }

    const authViolations = violations.filter(v => v.rule.includes('auth')).length
    if (authViolations > 0) {
      recommendations.add('Implement proper authentication patterns in server actions')
    }

    const qualityViolations = violations.filter(v => v.type === 'QUALITY_VIOLATION').length
    if (qualityViolations > 5) {
      recommendations.add('Improve code quality by fixing TypeScript and formatting issues')
    }

    return Array.from(recommendations)
  }
}

export const createComplianceEngine = (workspaceId: string) => 
  new PRIAComplianceEngine(workspaceId)