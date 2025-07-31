/**
 * Subagent System Types - Comprehensive type definitions for PRIA subagent architecture
 */

export interface SubagentConfig {
  name: string
  description: string
  phase: number
  capabilities: string[]
  tools: string[]
  systemPrompt: string
  contextPrompts: {
    phase_entry: string
    cross_phase_collaboration?: string
    quality_focus?: string
    compliance_focus?: string
    security_standards?: string
    [key: string]: string | undefined
  }
  validationRules: string[]
  outputFormats: string[]
}

export interface SubagentCapabilities {
  canGenerateCode: boolean
  canExecuteTests: boolean
  canAnalyzeArtifacts: boolean
  canReferencePhases: number[]
  canProduceArtifacts: string[]
  canConsumeArtifacts: string[]
  specializations: string[]
}

export interface SubagentContext {
  sessionId: string
  workspaceId: string
  currentPhase: number
  agentName: string
  preservedContext?: any
  artifactReferences?: ArtifactReference[]
  qualityRequirements?: QualityRequirement[]
  complianceRequirements?: ComplianceRequirement[]
}

export interface ArtifactReference {
  agentName: string
  artifactType?: string
  query?: string
  phase?: number
  timeframe?: 'latest' | 'all' | 'recent'
  priority?: 'high' | 'medium' | 'low'
}

export interface QualityRequirement {
  id: string
  category: 'performance' | 'security' | 'accessibility' | 'usability' | 'reliability' | 'maintainability'
  description: string
  acceptance_criteria: string[]
  validation_method: 'automated' | 'manual' | 'hybrid'
  priority: 'critical' | 'high' | 'medium' | 'low'
  compliance_frameworks: string[]
}

export interface ComplianceRequirement {
  id: string
  framework: 'PRIA' | 'OWASP' | 'GDPR' | 'SOC2' | 'ISO27001' | 'WCAG' | 'NIST'
  requirement: string
  description: string
  validation_criteria: string[]
  mandatory: boolean
  evidence_required: string[]
}

export interface SubagentResult {
  agentName: string
  phase: number
  success: boolean
  response: string
  artifacts: SubagentArtifact[]
  context: any
  duration: number
  tokensUsed?: number
  qualityMetrics?: QualityMetrics
  complianceStatus?: ComplianceStatus
  error?: string
}

export interface SubagentArtifact {
  type: ArtifactType
  content: any
  metadata: ArtifactMetadata
}

export type ArtifactType = 
  | 'requirement'
  | 'user_story'
  | 'acceptance_criteria'
  | 'specification'
  | 'architecture'
  | 'design_decision'
  | 'api_spec'
  | 'task'
  | 'sprint'
  | 'milestone'
  | 'dependency_map'
  | 'component'
  | 'api'
  | 'util'
  | 'type'
  | 'documentation'
  | 'test'
  | 'test_suite'
  | 'coverage_report'
  | 'quality_metric'
  | 'security_report'
  | 'vulnerability'
  | 'compliance_check'
  | 'validation'
  | 'deployment_config'
  | 'infrastructure'
  | 'monitoring'
  | 'pipeline'

export interface ArtifactMetadata {
  phase: number
  agent: string
  confidence?: number
  references?: string[]
  created_at: string
  updated_at: string
  version?: number
  tags?: string[]
  dependencies?: string[]
  quality_score?: number
  compliance_status?: string
}

export interface QualityMetrics {
  overall_score: number
  categories: {
    functionality: number
    reliability: number
    usability: number
    efficiency: number
    maintainability: number
    portability: number
  }
  coverage_metrics?: {
    code_coverage: number
    test_coverage: number
    requirement_coverage: number
  }
  performance_metrics?: {
    response_time: number
    throughput: number
    resource_usage: number
  }
  security_metrics?: {
    vulnerability_count: number
    security_score: number
    compliance_score: number
  }
}

export interface ComplianceStatus {
  framework: string
  overall_compliance: boolean
  compliance_score: number
  passed_requirements: string[]
  failed_requirements: string[]
  pending_requirements: string[]
  evidence_artifacts: string[]
  recommendations: string[]
}

// QA Engineer Specific Types
export interface TestSuite {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility' | 'security'
  framework: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  test_cases: TestCase[]
  setup_requirements: string[]
  dependencies: string[]
  estimated_execution_time: string
  coverage_target: number
  automation_level: 'fully_automated' | 'semi_automated' | 'manual'
}

export interface TestCase {
  id: string
  name: string
  description: string
  preconditions: string[]
  test_steps: TestStep[]
  expected_results: string[]
  test_data?: any
  cleanup_steps?: string[]
  automation_level: 'automated' | 'manual' | 'semi_automated'
  priority: 'critical' | 'high' | 'medium' | 'low'
  tags: string[]
  requirements_mapping: string[]
}

export interface TestStep {
  step_number: number
  action: string
  input_data?: any
  expected_result: string
  validation_criteria: string[]
}

export interface TestExecutionResult {
  test_suite_id: string
  test_case_id: string
  status: 'passed' | 'failed' | 'skipped' | 'pending'
  execution_time: number
  error_message?: string
  stack_trace?: string
  screenshots?: string[]
  logs?: string[]
  metrics?: {
    performance?: any
    coverage?: any
    accessibility?: any
  }
}

// Security Auditor Specific Types
export interface SecurityVulnerability {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cwe_id?: string
  owasp_category?: string
  cvss_score?: number
  description: string
  impact: string
  likelihood: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  affected_components: string[]
  proof_of_concept?: string
  remediation: SecurityRemediation
  references: string[]
  discovered_by: string
  discovery_method: 'automated' | 'manual' | 'hybrid'
  verification_status: 'confirmed' | 'probable' | 'possible' | 'false_positive'
}

export interface SecurityRemediation {
  recommendation: string
  code_fix?: string
  configuration_change?: string
  priority: 'immediate' | 'urgent' | 'normal' | 'low'
  effort_level: 'trivial' | 'easy' | 'moderate' | 'complex' | 'major'
  estimated_time: string
  risk_reduction: 'high' | 'medium' | 'low'
  implementation_steps: string[]
  validation_criteria: string[]
}

export interface ThreatModel {
  id: string
  name: string
  description: string
  scope: string[]
  assets: ThreatAsset[]
  threats: Threat[]
  vulnerabilities: string[]
  mitigations: Mitigation[]
  risk_assessment: RiskAssessment
}

export interface ThreatAsset {
  id: string
  name: string
  type: 'data' | 'process' | 'external_entity' | 'data_store'
  description: string
  confidentiality_requirement: 'high' | 'medium' | 'low'
  integrity_requirement: 'high' | 'medium' | 'low'
  availability_requirement: 'high' | 'medium' | 'low'
}

export interface Threat {
  id: string
  name: string
  description: string
  category: string
  attack_vectors: string[]
  likelihood: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  impact: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  affected_assets: string[]
}

export interface Mitigation {
  id: string
  name: string
  description: string
  type: 'preventive' | 'detective' | 'corrective'
  implementation_status: 'implemented' | 'planned' | 'not_implemented'
  effectiveness: 'high' | 'medium' | 'low'
  cost: 'high' | 'medium' | 'low'
  addressed_threats: string[]
}

export interface RiskAssessment {
  overall_risk_level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  risk_factors: RiskFactor[]
  risk_matrix: RiskMatrixEntry[]
  recommendations: string[]
  residual_risk: 'acceptable' | 'review_required' | 'unacceptable'
}

export interface RiskFactor {
  category: string
  description: string
  likelihood: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  impact: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  risk_level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  mitigation_required: boolean
}

export interface RiskMatrixEntry {
  threat_id: string
  likelihood: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  impact: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  risk_level: 'very_high' | 'high' | 'medium' | 'low' | 'very_low'
  current_mitigations: string[]
  additional_mitigations_needed: string[]
}

// Subagent Registry Types
export interface SubagentRegistry {
  [agentName: string]: SubagentConfig
}

export interface PhaseAgentMapping {
  [phase: number]: string
}

export interface SubagentExecutionOptions {
  tools?: string[]
  maxTurns?: number
  timeout?: number
  preserveContext?: boolean
  qualityRequirements?: QualityRequirement[]
  complianceRequirements?: ComplianceRequirement[]
  artifactReferences?: ArtifactReference[]
}

export interface SubagentValidationResult {
  isValid: boolean
  violations: ValidationViolation[]
  warnings: ValidationWarning[]
  qualityScore: number
  complianceScore: number
}

export interface ValidationViolation {
  rule: string
  severity: 'error' | 'warning' | 'info'
  description: string
  location?: string
  remediation?: string
}

export interface ValidationWarning {
  type: string
  message: string
  suggestion?: string
  impact: 'high' | 'medium' | 'low'
}