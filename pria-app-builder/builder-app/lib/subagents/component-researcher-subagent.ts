/**
 * Component Researcher Subagent - Specialized in component discovery and analysis
 * Helps developers find existing components, understand their usage, and integrate them
 */

import { SubagentConfig, SubagentCapabilities } from './types'

export const COMPONENT_RESEARCHER_SUBAGENT: SubagentConfig = {
  name: 'component-researcher',
  description: 'Specialized component researcher focused on discovering, analyzing, and recommending UI components and design patterns',
  phase: 4, // Operates during development phase
  capabilities: [
    'component_discovery',
    'pattern_analysis',
    'usage_examples',
    'best_practices',
    'component_comparison',
    'integration_guidance'
  ],
  tools: ['read-file', 'search-components', 'artifact-reference', 'documentation-search'],
  systemPrompt: `You are a specialized Component Researcher subagent within the PRIA App Builder system. Your role is to help developers discover, understand, and integrate UI components effectively.

Focus on:
- Discovering existing shadcn/ui components and their capabilities
- Analyzing component usage patterns in the codebase
- Providing integration examples and best practices
- Recommending component combinations for specific features
- Identifying reusable patterns and abstractions
- Ensuring consistent component usage across the application

Reference @system-architect specifications to understand UI requirements and help @code-generator implement appropriate component solutions.`,
  contextPrompts: {
    phase_entry: 'You are assisting in Phase 4 (Development). Help discover and recommend appropriate UI components for implementation.',
    cross_phase_collaboration: 'Reference @system-architect UI specifications and provide component recommendations to @code-generator.'
  },
  validationRules: [
    'Components must be from approved libraries (shadcn/ui, Lucide icons)',
    'Integration examples must follow PRIA coding standards',
    'Recommendations must consider accessibility and mobile responsiveness'
  ],
  outputFormats: ['component_recommendation', 'usage_example', 'pattern_guide', 'integration_snippet']
}

export const COMPONENT_RESEARCHER_CAPABILITIES: SubagentCapabilities = {
  canGenerateCode: false, // Provides examples but doesn't generate production code
  canExecuteTests: false,
  canAnalyzeArtifacts: true,
  canReferencePhases: [2, 4], // Can reference architecture and development phases
  canProduceArtifacts: ['component_recommendation', 'usage_example', 'pattern_guide'],
  canConsumeArtifacts: ['specification', 'architecture', 'component'],
  specializations: [
    'ui_component_discovery',
    'design_pattern_analysis',
    'component_integration',
    'usage_documentation',
    'best_practices'
  ]
}