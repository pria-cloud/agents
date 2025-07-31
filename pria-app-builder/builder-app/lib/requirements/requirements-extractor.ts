/**
 * Requirements Extraction System for PRIA
 * Automatically extracts and structures requirements from Claude responses
 */

export interface ExtractedRequirement {
  title: string
  description: string
  type: 'functional' | 'non-functional' | 'business-rule' | 'user-interface' | 'integration' | 'performance' | 'security' | 'accessibility' | 'compliance'
  priority: 'critical' | 'high' | 'medium' | 'low' | 'nice-to-have'
  category?: string
  acceptance_criteria: string[]
  user_story?: string
  business_value?: number
  complexity?: 'simple' | 'medium' | 'complex'
  confidence: number // 0-1 score of extraction confidence
  source_text: string // Original text that generated this requirement
}

export interface RequirementExtractionResult {
  requirements: ExtractedRequirement[]
  metadata: {
    extraction_method: string
    confidence_score: number
    total_requirements_found: number
    extraction_timestamp: string
  }
}

export class RequirementsExtractor {
  
  /**
   * Extract requirements from Claude response text
   */
  static extractFromText(
    responseText: string, 
    context: {
      workflow_phase?: number
      session_id: string
      previous_requirements?: any[]
    }
  ): RequirementExtractionResult {
    const requirements: ExtractedRequirement[] = []
    let extractionMethod = 'pattern_matching'
    
    // Multiple extraction strategies
    
    // 1. Explicit requirement patterns
    const explicitRequirements = this.extractExplicitRequirements(responseText)
    requirements.push(...explicitRequirements)
    
    // 2. User story patterns
    const userStoryRequirements = this.extractUserStories(responseText)
    requirements.push(...userStoryRequirements)
    
    // 3. Feature descriptions
    const featureRequirements = this.extractFeatureDescriptions(responseText)
    requirements.push(...featureRequirements)
    
    // 4. Acceptance criteria patterns
    const criteriaRequirements = this.extractAcceptanceCriteria(responseText)
    requirements.push(...criteriaRequirements)
    
    // 5. Must/Should/Could patterns (MoSCoW)
    const moscowRequirements = this.extractMoscowRequirements(responseText)
    requirements.push(...moscowRequirements)
    
    // Deduplicate and merge similar requirements
    const deduplicatedRequirements = this.deduplicateRequirements(requirements)
    
    // Calculate overall confidence
    const overallConfidence = deduplicatedRequirements.length > 0 
      ? deduplicatedRequirements.reduce((sum, req) => sum + req.confidence, 0) / deduplicatedRequirements.length
      : 0
    
    return {
      requirements: deduplicatedRequirements,
      metadata: {
        extraction_method: extractionMethod,
        confidence_score: overallConfidence,
        total_requirements_found: deduplicatedRequirements.length,
        extraction_timestamp: new Date().toISOString()
      }
    }
  }
  
  /**
   * Extract explicit requirement statements
   */
  private static extractExplicitRequirements(text: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = []
    
    // Patterns for explicit requirements
    const patterns = [
      /(?:requirement|req)\s*#?\d*:?\s*(.+?)(?=\n|$)/gi,
      /(?:the system|application|app)\s+(?:must|should|shall|will)\s+(.+?)(?=\n|$)/gi,
      /(?:users?|system)\s+(?:need to|should be able to|must be able to|can)\s+(.+?)(?=\n|$)/gi,
      /(?:functional requirement|non-functional requirement|business rule):\s*(.+?)(?=\n|$)/gi
    ]
    
    patterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const description = match[1].trim()
        if (description.length > 10) { // Filter out very short matches
          requirements.push({
            title: this.generateTitle(description),
            description,
            type: this.inferType(description),
            priority: this.inferPriority(description),
            category: this.inferCategory(description),
            acceptance_criteria: this.extractCriteriaFromDescription(description),
            complexity: this.inferComplexity(description),
            confidence: 0.8,
            source_text: match[0]
          })
        }
      }
    })
    
    return requirements
  }
  
  /**
   * Extract user stories (As a... I want... So that...)
   */
  private static extractUserStories(text: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = []
    
    const userStoryPattern = /as\s+(?:a|an)\s+(.+?),?\s+i\s+(?:want|need)\s+(?:to\s+)?(.+?)(?:\s+so\s+that\s+(.+?))?(?=\n|$)/gi
    
    let match
    while ((match = userStoryPattern.exec(text)) !== null) {
      const userType = match[1].trim()
      const action = match[2].trim()
      const benefit = match[3]?.trim()
      
      const userStory = `As a ${userType}, I want to ${action}${benefit ? ` so that ${benefit}` : ''}`
      const description = `${action}${benefit ? ` - ${benefit}` : ''}`
      
      requirements.push({
        title: this.generateTitle(action),
        description,
        type: 'functional',
        priority: 'medium',
        category: this.inferCategory(action),
        acceptance_criteria: this.extractCriteriaFromDescription(action),
        user_story: userStory,
        complexity: this.inferComplexity(action),
        confidence: 0.9,
        source_text: match[0]
      })
    }
    
    return requirements
  }
  
  /**
   * Extract feature descriptions
   */
  private static extractFeatureDescriptions(text: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = []
    
    // Look for feature/function descriptions
    const featurePatterns = [
      /(?:feature|functionality|capability):\s*(.+?)(?=\n|$)/gi,
      /(?:implement|create|build|develop)\s+(.+?)(?=\n|$)/gi,
      /(?:add|include)\s+(?:a|an|the)?\s*(.+?)(?:\s+feature|\s+functionality)?(?=\n|$)/gi
    ]
    
    featurePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const description = match[1].trim()
        if (description.length > 15 && !this.isCodeOrTechnicalDetail(description)) {
          requirements.push({
            title: this.generateTitle(description),
            description,
            type: this.inferType(description),
            priority: this.inferPriority(description),
            category: this.inferCategory(description),
            acceptance_criteria: this.extractCriteriaFromDescription(description),
            complexity: this.inferComplexity(description),
            confidence: 0.7,
            source_text: match[0]
          })
        }
      }
    })
    
    return requirements
  }
  
  /**
   * Extract acceptance criteria patterns
   */
  private static extractAcceptanceCriteria(text: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = []
    
    // Look for acceptance criteria sections
    const criteriaPattern = /acceptance\s+criteria:?\s*((?:[-*•]\s*.+(?:\n|$))+)/gi
    
    let match
    while ((match = criteriaPattern.exec(text)) !== null) {
      const criteriaText = match[1]
      const criteria = criteriaText
        .split(/\n/)
        .map(line => line.replace(/^[-*•]\s*/, '').trim())
        .filter(line => line.length > 5)
      
      if (criteria.length > 0) {
        // Try to infer the feature from the criteria
        const inferredTitle = this.inferTitleFromCriteria(criteria)
        
        requirements.push({
          title: inferredTitle,
          description: `Feature with specific acceptance criteria: ${criteria.join(', ')}`,
          type: 'functional',
          priority: 'medium',
          acceptance_criteria: criteria,
          complexity: criteria.length > 3 ? 'complex' : 'medium',
          confidence: 0.8,
          source_text: match[0]
        })
      }
    }
    
    return requirements
  }
  
  /**
   * Extract MoSCoW prioritized requirements (Must/Should/Could/Won't)
   */
  private static extractMoscowRequirements(text: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = []
    
    const moscowPatterns = [
      { pattern: /must\s+(?:have|be|do|support|include)\s+(.+?)(?=\n|$)/gi, priority: 'critical' as const },
      { pattern: /should\s+(?:have|be|do|support|include)\s+(.+?)(?=\n|$)/gi, priority: 'high' as const },
      { pattern: /could\s+(?:have|be|do|support|include)\s+(.+?)(?=\n|$)/gi, priority: 'medium' as const },
      { pattern: /would\s+like\s+to\s+(?:have|be|do|support|include)\s+(.+?)(?=\n|$)/gi, priority: 'low' as const }
    ]
    
    moscowPatterns.forEach(({ pattern, priority }) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const description = match[1].trim()
        if (description.length > 10) {
          requirements.push({
            title: this.generateTitle(description),
            description,
            type: this.inferType(description),
            priority,
            category: this.inferCategory(description),
            acceptance_criteria: this.extractCriteriaFromDescription(description),
            complexity: this.inferComplexity(description),
            confidence: 0.7,
            source_text: match[0]
          })
        }
      }
    })
    
    return requirements
  }
  
  /**
   * Helper methods
   */
  
  private static generateTitle(description: string): string {
    // Extract key action and object from description
    const words = description.split(' ').slice(0, 6)
    let title = words.join(' ')
    
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1)
    
    // Remove trailing punctuation
    title = title.replace(/[.,:;!?]+$/, '')
    
    return title.length > 50 ? title.substring(0, 47) + '...' : title
  }
  
  private static inferType(description: string): ExtractedRequirement['type'] {
    const lowerDesc = description.toLowerCase()
    
    if (lowerDesc.includes('performance') || lowerDesc.includes('speed') || lowerDesc.includes('load time')) {
      return 'performance'
    }
    if (lowerDesc.includes('security') || lowerDesc.includes('authentication') || lowerDesc.includes('authorization')) {
      return 'security'
    }
    if (lowerDesc.includes('ui') || lowerDesc.includes('interface') || lowerDesc.includes('design') || lowerDesc.includes('display')) {
      return 'user-interface'
    }
    if (lowerDesc.includes('integration') || lowerDesc.includes('api') || lowerDesc.includes('connect')) {
      return 'integration'
    }
    if (lowerDesc.includes('accessibility') || lowerDesc.includes('a11y') || lowerDesc.includes('screen reader')) {
      return 'accessibility'
    }
    if (lowerDesc.includes('compliance') || lowerDesc.includes('regulation') || lowerDesc.includes('gdpr')) {
      return 'compliance'
    }
    if (lowerDesc.includes('business rule') || lowerDesc.includes('policy') || lowerDesc.includes('process')) {
      return 'business-rule'
    }
    
    return 'functional' // Default
  }
  
  private static inferPriority(description: string): ExtractedRequirement['priority'] {
    const lowerDesc = description.toLowerCase()
    
    if (lowerDesc.includes('critical') || lowerDesc.includes('essential') || lowerDesc.includes('required')) {
      return 'critical'
    }
    if (lowerDesc.includes('important') || lowerDesc.includes('should') || lowerDesc.includes('must')) {
      return 'high'
    }
    if (lowerDesc.includes('nice to have') || lowerDesc.includes('could') || lowerDesc.includes('optional')) {
      return 'low'
    }
    
    return 'medium' // Default
  }
  
  private static inferCategory(description: string): string {
    const lowerDesc = description.toLowerCase()
    
    if (lowerDesc.includes('user') || lowerDesc.includes('account') || lowerDesc.includes('profile')) {
      return 'User Management'
    }
    if (lowerDesc.includes('payment') || lowerDesc.includes('billing') || lowerDesc.includes('invoice')) {
      return 'Payment Processing'
    }
    if (lowerDesc.includes('data') || lowerDesc.includes('database') || lowerDesc.includes('storage')) {
      return 'Data Management'
    }
    if (lowerDesc.includes('report') || lowerDesc.includes('analytics') || lowerDesc.includes('dashboard')) {
      return 'Reporting & Analytics'
    }
    if (lowerDesc.includes('notification') || lowerDesc.includes('email') || lowerDesc.includes('alert')) {
      return 'Communications'
    }
    if (lowerDesc.includes('admin') || lowerDesc.includes('configuration') || lowerDesc.includes('settings')) {
      return 'Administration'
    }
    
    return 'General'
  }
  
  private static inferComplexity(description: string): ExtractedRequirement['complexity'] {
    const lowerDesc = description.toLowerCase()
    
    if (lowerDesc.includes('complex') || lowerDesc.includes('multiple') || lowerDesc.includes('integration') || 
        lowerDesc.includes('workflow') || description.length > 200) {
      return 'complex'
    }
    if (lowerDesc.includes('simple') || lowerDesc.includes('basic') || description.length < 50) {
      return 'simple'
    }
    
    return 'medium'
  }
  
  private static extractCriteriaFromDescription(description: string): string[] {
    const criteria: string[] = []
    
    // Look for explicit criteria in the description
    const criteriaPatterns = [
      /(?:when|if)\s+(.+?)(?:then|,|\.|$)/gi,
      /(?:should|must|will)\s+(.+?)(?:\.|,|$)/gi
    ]
    
    criteriaPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(description)) !== null) {
        const criterion = match[1].trim()
        if (criterion.length > 5 && !criteria.includes(criterion)) {
          criteria.push(criterion)
        }
      }
    })
    
    // If no explicit criteria found, generate basic ones
    if (criteria.length === 0) {
      criteria.push(`System successfully performs: ${description}`)
      criteria.push('Appropriate error handling is implemented')
      criteria.push('User receives clear feedback')
    }
    
    return criteria
  }
  
  private static isCodeOrTechnicalDetail(text: string): boolean {
    // Check if text looks like code or technical implementation details
    const codePatterns = [
      /[{}();]/, // Contains code brackets/parentheses
      /\w+\.\w+/, // Contains method calls
      /import|export|function|class|const|let|var/, // Contains code keywords
      /https?:\/\//, // Contains URLs
      /\w+@\w+\.\w+/ // Contains email addresses
    ]
    
    return codePatterns.some(pattern => pattern.test(text))
  }
  
  private static inferTitleFromCriteria(criteria: string[]): string {
    // Extract common actions/objects from criteria to infer feature title
    const words = criteria.join(' ').split(' ')
    const actionWords = words.filter(word => 
      ['create', 'update', 'delete', 'view', 'manage', 'handle', 'process'].includes(word.toLowerCase())
    )
    const objectWords = words.filter(word => 
      ['user', 'data', 'file', 'report', 'payment', 'order', 'item'].includes(word.toLowerCase())
    )
    
    if (actionWords.length > 0 && objectWords.length > 0) {
      return `${actionWords[0]} ${objectWords[0]}`.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ')
    }
    
    return 'Feature from Acceptance Criteria'
  }
  
  private static deduplicateRequirements(requirements: ExtractedRequirement[]): ExtractedRequirement[] {
    const deduplicated: ExtractedRequirement[] = []
    
    for (const req of requirements) {
      // Check for similar requirements
      const similar = deduplicated.find(existing => 
        this.calculateSimilarity(req.title, existing.title) > 0.7 ||
        this.calculateSimilarity(req.description, existing.description) > 0.6
      )
      
      if (similar) {
        // Merge with existing requirement (keep higher confidence one)
        if (req.confidence > similar.confidence) {
          // Replace with higher confidence version
          const index = deduplicated.indexOf(similar)
          deduplicated[index] = {
            ...req,
            acceptance_criteria: [...new Set([...req.acceptance_criteria, ...similar.acceptance_criteria])]
          }
        } else {
          // Merge acceptance criteria into existing
          similar.acceptance_criteria = [...new Set([...similar.acceptance_criteria, ...req.acceptance_criteria])]
        }
      } else {
        deduplicated.push(req)
      }
    }
    
    return deduplicated
  }
  
  private static calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity coefficient
    const words1 = new Set(str1.toLowerCase().split(' '))
    const words2 = new Set(str2.toLowerCase().split(' '))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }
}