/**
 * Technical Specifications Extractor for Phase 2 (Architecture & Technical Design)
 * Automatically extracts technical specifications from Claude's architecture responses
 */

export interface TechnicalSpecification {
  id?: string
  workspace_id?: string
  session_id?: string
  type: 'architecture' | 'component' | 'api' | 'database' | 'testing' | 'deployment'
  title: string
  description: string
  content: Record<string, any>
  status: 'draft' | 'approved' | 'implemented' | 'outdated'
  version: number
  priority: 'high' | 'medium' | 'low'
  metadata: {
    extracted_from?: string
    extraction_confidence?: number
    workflow_phase?: number
    context7_sources?: string[]
    pria_compliance?: boolean
  }
  created_at?: string
  updated_at?: string
}

export class TechnicalSpecsExtractor {
  /**
   * Extract technical specifications from Claude's architecture and design responses
   */
  static extractFromText(
    text: string, 
    context: {
      workflow_phase?: number
      session_id?: string
      workspace_id?: string
    }
  ): TechnicalSpecification[] {
    const specifications: TechnicalSpecification[] = []
    
    // Architecture Specifications
    const architectureSpecs = this.extractArchitectureSpecs(text)
    specifications.push(...architectureSpecs.map(spec => ({
      ...spec,
      metadata: {
        ...spec.metadata,
        ...context,
        extraction_confidence: this.calculateConfidence(spec.content),
        pria_compliance: this.checkPRIACompliance(spec.content)
      }
    })))

    // Database Specifications
    const databaseSpecs = this.extractDatabaseSpecs(text)
    specifications.push(...databaseSpecs.map(spec => ({
      ...spec,
      metadata: {
        ...spec.metadata,
        ...context,
        extraction_confidence: this.calculateConfidence(spec.content),
        pria_compliance: this.checkPRIACompliance(spec.content)
      }
    })))

    // API Specifications
    const apiSpecs = this.extractAPISpecs(text)
    specifications.push(...apiSpecs.map(spec => ({
      ...spec,
      metadata: {
        ...spec.metadata,
        ...context,
        extraction_confidence: this.calculateConfidence(spec.content),
        pria_compliance: this.checkPRIACompliance(spec.content)
      }
    })))

    // Component Specifications
    const componentSpecs = this.extractComponentSpecs(text)
    specifications.push(...componentSpecs.map(spec => ({
      ...spec,
      metadata: {
        ...spec.metadata,
        ...context,
        extraction_confidence: this.calculateConfidence(spec.content),
        pria_compliance: this.checkPRIACompliance(spec.content)
      }
    })))

    // Security Specifications
    const securitySpecs = this.extractSecuritySpecs(text)
    specifications.push(...securitySpecs.map(spec => ({
      ...spec,
      metadata: {
        ...spec.metadata,
        ...context,
        extraction_confidence: this.calculateConfidence(spec.content),
        pria_compliance: this.checkPRIACompliance(spec.content)
      }
    })))

    return specifications.filter(spec => spec.metadata.extraction_confidence > 0.3)
  }

  /**
   * Extract system architecture specifications
   */
  private static extractArchitectureSpecs(text: string): Partial<TechnicalSpecification>[] {
    const specs: Partial<TechnicalSpecification>[] = []
    
    // Look for architecture patterns
    const architecturePatterns = [
      /(?:system architecture|architectural design|architecture overview)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:microservices|monolith|layered architecture)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:component diagram|system diagram)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    architecturePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTitle(match) || 'System Architecture'
          specs.push({
            type: 'architecture',
            title,
            description: this.extractDescription(match),
            content: {
              specification: match.trim(),
              architecture_type: this.detectArchitectureType(match),
              components: this.extractComponents(match),
              patterns: this.extractPatterns(match),
              scalability: this.extractScalabilityInfo(match),
              technology_stack: this.extractTechnologyStack(match)
            },
            status: 'draft',
            version: 1,
            priority: 'high',
            metadata: {
              extracted_from: 'architecture_analysis'
            }
          })
        })
      }
    })

    return specs
  }

  /**
   * Extract database schema and design specifications
   */
  private static extractDatabaseSpecs(text: string): Partial<TechnicalSpecification>[] {
    const specs: Partial<TechnicalSpecification>[] = []

    // Database-related patterns
    const databasePatterns = [
      /(?:database schema|data model|table structure)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:CREATE TABLE|database design|schema design)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:supabase|postgresql|database)[\s\S]*?(?:RLS|row level security|multi.?tenant)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    databasePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTitle(match) || 'Database Schema'
          specs.push({
            type: 'database',
            title,
            description: this.extractDescription(match),
            content: {
              specification: match.trim(),
              schema_design: this.extractSchemaDesign(match),
              tables: this.extractTables(match),
              relationships: this.extractRelationships(match),
              rls_policies: this.extractRLSPolicies(match),
              multi_tenancy: this.checkMultiTenancy(match),
              migrations: this.extractMigrations(match)
            },
            status: 'draft',
            version: 1,
            priority: 'high',
            metadata: {
              extracted_from: 'database_analysis'
            }
          })
        })
      }
    })

    return specs
  }

  /**
   * Extract API design specifications
   */
  private static extractAPISpecs(text: string): Partial<TechnicalSpecification>[] {
    const specs: Partial<TechnicalSpecification>[] = []

    // API-related patterns
    const apiPatterns = [
      /(?:API design|REST API|API endpoints)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:route|endpoint|API specification)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:authentication|authorization|API security)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    apiPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTitle(match) || 'API Specification'
          specs.push({
            type: 'api',
            title,
            description: this.extractDescription(match),
            content: {
              specification: match.trim(),
              endpoints: this.extractEndpoints(match),
              authentication: this.extractAuthenticationMethod(match),
              rate_limiting: this.extractRateLimiting(match),
              versioning: this.extractVersioning(match),
              error_handling: this.extractErrorHandling(match),
              data_contracts: this.extractDataContracts(match)
            },
            status: 'draft',
            version: 1,
            priority: 'high',
            metadata: {
              extracted_from: 'api_analysis'
            }
          })
        })
      }
    })

    return specs
  }

  /**
   * Extract component specifications
   */
  private static extractComponentSpecs(text: string): Partial<TechnicalSpecification>[] {
    const specs: Partial<TechnicalSpecification>[] = []

    // Component-related patterns
    const componentPatterns = [
      /(?:component|UI component|React component)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:shadcn\/ui|tailwind|styling)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:responsive design|accessibility|UI\/UX)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    componentPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTitle(match) || 'Component Specification'
          specs.push({
            type: 'component',
            title,
            description: this.extractDescription(match),
            content: {
              specification: match.trim(),
              component_type: this.extractComponentType(match),
              props_interface: this.extractPropsInterface(match),
              styling_approach: this.extractStylingApproach(match),
              accessibility: this.extractAccessibilityFeatures(match),
              responsive_design: this.extractResponsiveDesign(match),
              dependencies: this.extractComponentDependencies(match)
            },
            status: 'draft',
            version: 1,
            priority: 'medium',
            metadata: {
              extracted_from: 'component_analysis'
            }
          })
        })
      }
    })

    return specs
  }

  /**
   * Extract security specifications
   */
  private static extractSecuritySpecs(text: string): Partial<TechnicalSpecification>[] {
    const specs: Partial<TechnicalSpecification>[] = []

    // Security-related patterns
    const securityPatterns = [
      /(?:security|authentication|authorization)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:GDPR|SOC2|compliance|privacy)[\s\S]*?(?=\n\n|\n#|$)/gi,
      /(?:OWASP|security audit|vulnerability)[\s\S]*?(?=\n\n|\n#|$)/gi
    ]

    securityPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const title = this.extractTitle(match) || 'Security Specification'
          specs.push({
            type: 'deployment', // Security specs can be categorized under deployment
            title,
            description: this.extractDescription(match),
            content: {
              specification: match.trim(),
              authentication_method: this.extractAuthenticationMethod(match),
              authorization_model: this.extractAuthorizationModel(match),
              data_protection: this.extractDataProtection(match),
              compliance_requirements: this.extractComplianceRequirements(match),
              security_patterns: this.extractSecurityPatterns(match),
              threat_model: this.extractThreatModel(match)
            },
            status: 'draft',
            version: 1,
            priority: 'high',
            metadata: {
              extracted_from: 'security_analysis'
            }
          })
        })
      }
    })

    return specs
  }

  // Helper methods for extraction
  private static extractTitle(text: string): string | null {
    const titlePatterns = [
      /^#+\s*(.+)$/m,
      /^(.+):/m,
      /^(.+)\n=+/m,
      /^(.+)\n-+/m
    ]

    for (const pattern of titlePatterns) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    // Fallback: use first sentence
    const firstSentence = text.split(/[.!?]/)[0]
    return firstSentence.length > 5 && firstSentence.length < 100 ? firstSentence.trim() : null
  }

  private static extractDescription(text: string): string {
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10)
    return sentences.slice(0, 2).join('. ').trim() + (sentences.length > 2 ? '.' : '')
  }

  private static detectArchitectureType(text: string): string {
    const types = {
      'microservices': /microservices?/i,
      'monolith': /monolith|monolithic/i,
      'layered': /layered|n-tier|three-tier/i,
      'event-driven': /event.driven|event.sourcing/i,
      'serverless': /serverless|lambda|function/i
    }

    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type
    }

    return 'unknown'
  }

  private static extractComponents(text: string): string[] {
    const components = []
    const componentPatterns = [
      /component[s]?[\s:]*([^.\n]+)/gi,
      /module[s]?[\s:]*([^.\n]+)/gi,
      /service[s]?[\s:]*([^.\n]+)/gi
    ]

    componentPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].trim().length > 2) {
          components.push(match[1].trim())
        }
      })
    })

    return [...new Set(components)].slice(0, 10) // Limit to 10 unique components
  }

  private static extractPatterns(text: string): string[] {
    const patterns = []
    const patternKeywords = [
      'MVC', 'MVVM', 'Repository', 'Factory', 'Observer', 'Singleton',
      'Strategy', 'Command', 'Decorator', 'Adapter', 'Facade'
    ]

    patternKeywords.forEach(keyword => {
      if (new RegExp(keyword, 'i').test(text)) {
        patterns.push(keyword)
      }
    })

    return patterns
  }

  private static extractScalabilityInfo(text: string): Record<string, any> {
    return {
      horizontal_scaling: /horizontal.?scal/i.test(text),
      vertical_scaling: /vertical.?scal/i.test(text),
      load_balancing: /load.?balanc/i.test(text),
      caching: /cach/i.test(text),
      cdn: /CDN|content.?delivery/i.test(text)
    }
  }

  private static extractTechnologyStack(text: string): string[] {
    const technologies = []
    const techPatterns = [
      /Next\.js/i, /React/i, /TypeScript/i, /Supabase/i, /PostgreSQL/i,
      /Tailwind/i, /shadcn/i, /Vercel/i, /Node\.js/i, /Express/i
    ]

    techPatterns.forEach(pattern => {
      const match = text.match(pattern)
      if (match) {
        technologies.push(match[0])
      }
    })

    return [...new Set(technologies)]
  }

  // Database extraction helpers
  private static extractSchemaDesign(text: string): Record<string, any> {
    return {
      has_rls: /RLS|row.?level.?security/i.test(text),
      multi_tenant: /multi.?tenant|workspace/i.test(text),
      normalized: /normal|1NF|2NF|3NF/i.test(text),
      has_indexes: /index|btree|gin|gist/i.test(text)
    }
  }

  private static extractTables(text: string): string[] {
    const tables = []
    const tablePatterns = [
      /CREATE TABLE\s+(\w+)/gi,
      /table[s]?[\s:]*(\w+)/gi
    ]

    tablePatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].length > 2) {
          tables.push(match[1])
        }
      })
    })

    return [...new Set(tables)]
  }

  private static extractRelationships(text: string): string[] {
    const relationships = []
    const relationPatterns = [
      /foreign.?key/gi,
      /one.?to.?many/gi,
      /many.?to.?one/gi,
      /many.?to.?many/gi,
      /one.?to.?one/gi
    ]

    relationPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        relationships.push(...matches)
      }
    })

    return [...new Set(relationships)]
  }

  private static extractRLSPolicies(text: string): string[] {
    const policies = []
    const policyPattern = /CREATE POLICY\s+(\w+)/gi
    const matches = Array.from(text.matchAll(policyPattern))
    
    matches.forEach(match => {
      if (match[1]) {
        policies.push(match[1])
      }
    })

    return policies
  }

  private static checkMultiTenancy(text: string): boolean {
    return /workspace_id|tenant_id|multi.?tenant/i.test(text)
  }

  private static extractMigrations(text: string): string[] {
    const migrations = []
    const migrationPattern = /migration|ALTER TABLE|DROP TABLE|ADD COLUMN/gi
    const matches = text.match(migrationPattern)
    
    if (matches) {
      migrations.push(...matches)
    }

    return [...new Set(migrations)]
  }

  // API extraction helpers
  private static extractEndpoints(text: string): string[] {
    const endpoints = []
    const endpointPatterns = [
      /\/api\/[\w\/]+/gi,
      /GET|POST|PUT|DELETE|PATCH\s+\/[\w\/]+/gi
    ]

    endpointPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        endpoints.push(...matches)
      }
    })

    return [...new Set(endpoints)]
  }

  private static extractAuthenticationMethod(text: string): string {
    const authMethods = {
      'JWT': /JWT|json.?web.?token/i,
      'OAuth': /OAuth/i,
      'Supabase Auth': /supabase.?auth/i,
      'Session': /session/i,
      'API Key': /api.?key/i
    }

    for (const [method, pattern] of Object.entries(authMethods)) {
      if (pattern.test(text)) return method
    }

    return 'unknown'
  }

  private static extractRateLimiting(text: string): Record<string, any> {
    return {
      enabled: /rate.?limit/i.test(text),
      strategy: /token.?bucket|sliding.?window|fixed.?window/i.test(text) ? 'advanced' : 'basic'
    }
  }

  private static extractVersioning(text: string): Record<string, any> {
    return {
      enabled: /version|v\d+|api\/v\d+/i.test(text),
      strategy: /header|url|query/i.test(text) ? 'explicit' : 'implicit'
    }
  }

  private static extractErrorHandling(text: string): Record<string, any> {
    return {
      structured: /error.?response|error.?code/i.test(text),
      http_codes: /404|500|401|403|400/i.test(text),
      logging: /log|error.?track/i.test(text)
    }
  }

  private static extractDataContracts(text: string): string[] {
    const contracts = []
    const contractPatterns = [
      /interface\s+(\w+)/gi,
      /type\s+(\w+)/gi,
      /schema\s+(\w+)/gi
    ]

    contractPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && match[1].length > 2) {
          contracts.push(match[1])
        }
      })
    })

    return [...new Set(contracts)]
  }

  // Component extraction helpers
  private static extractComponentType(text: string): string {
    const types = {
      'React Component': /react.?component|jsx|tsx/i,
      'UI Component': /ui.?component|shadcn/i,
      'Layout Component': /layout|header|footer|sidebar/i,
      'Form Component': /form|input|button/i,
      'Data Component': /table|list|grid|chart/i
    }

    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type
    }

    return 'Generic Component'
  }

  private static extractPropsInterface(text: string): Record<string, any> {
    const propsMatch = text.match(/interface\s+\w*Props\s*{([^}]+)}/i)
    if (propsMatch) {
      return { definition: propsMatch[0] }
    }
    return { typescript: /:\s*\w+/i.test(text) }
  }

  private static extractStylingApproach(text: string): string {
    const approaches = {
      'Tailwind CSS': /tailwind/i,
      'shadcn/ui': /shadcn/i,
      'CSS Modules': /\.module\.css/i,
      'Styled Components': /styled.?components/i,
      'CSS-in-JS': /css.?in.?js/i
    }

    for (const [approach, pattern] of Object.entries(approaches)) {
      if (pattern.test(text)) return approach
    }

    return 'CSS'
  }

  private static extractAccessibilityFeatures(text: string): string[] {
    const features = []
    const a11yPatterns = [
      /aria-\w+/gi,
      /role="\w+"/gi,
      /accessibility|a11y|WCAG/gi,
      /tabindex|focus|keyboard/gi
    ]

    a11yPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        features.push(...matches.slice(0, 5)) // Limit results
      }
    })

    return [...new Set(features)]
  }

  private static extractResponsiveDesign(text: string): Record<string, any> {
    return {
      mobile_first: /mobile.?first/i.test(text),
      breakpoints: /sm:|md:|lg:|xl:/i.test(text),
      responsive: /responsive/i.test(text)
    }
  }

  private static extractComponentDependencies(text: string): string[] {
    const deps = []
    const depPatterns = [
      /from ['"]([^'"]+)['"]/gi,
      /import\s+\w+\s+from\s+['"]([^'"]+)['"]/gi
    ]

    depPatterns.forEach(pattern => {
      const matches = Array.from(text.matchAll(pattern))
      matches.forEach(match => {
        if (match[1] && !match[1].startsWith('.')) {
          deps.push(match[1])
        }
      })
    })

    return [...new Set(deps)].slice(0, 10)
  }

  // Security extraction helpers
  private static extractAuthorizationModel(text: string): string {
    const models = {
      'RBAC': /role.?based|rbac/i,
      'ABAC': /attribute.?based|abac/i,
      'ACL': /access.?control.?list|acl/i,
      'RLS': /row.?level.?security|rls/i
    }

    for (const [model, pattern] of Object.entries(models)) {
      if (pattern.test(text)) return model
    }

    return 'unknown'
  }

  private static extractDataProtection(text: string): Record<string, any> {
    return {
      encryption: /encrypt/i.test(text),
      hashing: /hash|bcrypt|scrypt/i.test(text),
      sanitization: /sanitiz|validat/i.test(text),
      anonymization: /anonymiz|pseudonym/i.test(text)
    }
  }

  private static extractComplianceRequirements(text: string): string[] {
    const requirements = []
    const compliancePatterns = [
      /GDPR/gi, /SOC2/gi, /HIPAA/gi, /PCI/gi, /ISO/gi, /CCPA/gi
    ]

    compliancePatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        requirements.push(...matches)
      }
    })

    return [...new Set(requirements)]
  }

  private static extractSecurityPatterns(text: string): string[] {
    const patterns = []
    const securityPatterns = [
      /defense.?in.?depth/gi,
      /zero.?trust/gi,
      /principle.?of.?least.?privilege/gi,
      /input.?validation/gi,
      /output.?encoding/gi,
      /csrf.?protection/gi,
      /xss.?protection/gi
    ]

    securityPatterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        patterns.push(...matches)
      }
    })

    return [...new Set(patterns)]
  }

  private static extractThreatModel(text: string): Record<string, any> {
    return {
      stride_model: /stride/i.test(text),
      attack_vectors: /attack.?vector|threat.?vector/i.test(text),
      risk_assessment: /risk.?assessment|risk.?analysis/i.test(text),
      mitigation: /mitigat/i.test(text)
    }
  }

  // Confidence and compliance helpers
  private static calculateConfidence(content: Record<string, any>): number {
    let score = 0
    let factors = 0

    // Check for structured content
    if (content.specification && content.specification.length > 100) {
      score += 0.3
    }
    factors++

    // Check for specific technical details
    const technicalFields = ['endpoints', 'tables', 'components', 'patterns', 'dependencies']
    technicalFields.forEach(field => {
      if (content[field] && Array.isArray(content[field]) && content[field].length > 0) {
        score += 0.15
      }
      factors++
    })

    // Check for PRIA-specific content
    if (content.multi_tenancy || content.workspace_id || content.rls_policies) {
      score += 0.2
    }
    factors++

    return Math.min(1.0, score)
  }

  private static checkPRIACompliance(content: Record<string, any>): boolean {
    const complianceFactors = [
      content.multi_tenancy === true,
      content.has_rls === true,
      content.workspace_id !== undefined,
      content.technology_stack?.includes('Supabase'),
      content.technology_stack?.includes('Next.js'),
      content.authentication_method === 'Supabase Auth'
    ]

    return complianceFactors.filter(Boolean).length >= 2
  }
}