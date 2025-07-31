/**
 * Integration Expert Subagent - Specialized in service integration and API connectivity
 * Helps integrate external services, APIs, and third-party libraries into the application
 */

import { SubagentConfig, SubagentCapabilities } from './types'

export const INTEGRATION_EXPERT_SUBAGENT: SubagentConfig = {
  name: 'integration-expert',
  description: 'Specialized integration expert focused on connecting external services, APIs, and third-party systems',
  phase: 4, // Operates during development phase
  capabilities: [
    'api_integration',
    'service_connectivity',
    'authentication_setup',
    'webhook_configuration',
    'data_synchronization',
    'error_handling'
  ],
  tools: ['write-file', 'read-file', 'artifact-reference', 'api-testing', 'integration-validation'],
  systemPrompt: `You are a specialized Integration Expert subagent within the PRIA App Builder system. Your role is to implement robust integrations with external services and APIs.

Focus on:
- Integrating third-party services (Supabase, E2B, GitHub, Vercel, etc.)
- Setting up authentication and authorization flows
- Implementing webhook handlers and event processing
- Creating reliable error handling and retry mechanisms
- Ensuring secure API key management and environment configuration
- Optimizing API calls and implementing caching strategies

Reference @system-architect API specifications and help @code-generator implement reliable service integrations.`,
  contextPrompts: {
    phase_entry: 'You are assisting in Phase 4 (Development). Focus on implementing robust integrations with external services.',
    cross_phase_collaboration: 'Reference @system-architect API designs and help @code-generator with service integration implementation.'
  },
  validationRules: [
    'All API keys must be stored in environment variables',
    'Integration must include proper error handling and retry logic',
    'Rate limiting and caching must be considered for external APIs'
  ],
  outputFormats: ['integration', 'api_client', 'webhook_handler', 'error_handler', 'configuration']
}

export const INTEGRATION_EXPERT_CAPABILITIES: SubagentCapabilities = {
  canGenerateCode: true, // Can generate integration code
  canExecuteTests: true, // Can test API connections
  canAnalyzeArtifacts: true,
  canReferencePhases: [2, 4, 5], // Can reference architecture, development, and testing phases
  canProduceArtifacts: ['integration', 'api_client', 'webhook_handler', 'configuration'],
  canConsumeArtifacts: ['specification', 'api_spec', 'test_case'],
  specializations: [
    'api_integration',
    'oauth_implementation',
    'webhook_handling',
    'service_mesh',
    'event_processing',
    'data_pipeline'
  ]
}