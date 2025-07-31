/**
 * PRIA E2B Template Configuration
 * 
 * This file centralizes all E2B template configuration to ensure consistency
 * across all sandbox managers and prevent template name mismatches.
 */

export const E2B_TEMPLATE_CONFIG = {
  // Official PRIA E2B template name (for display only - E2B doesn't use this)
  TEMPLATE_NAME: 'pria-dev-env',
  
  // Template version for tracking
  TEMPLATE_VERSION: '2.0.0',
  
  // Template ID - THIS IS WHAT E2B ACTUALLY USES!
  // Replace with your actual template ID from when you built the template
  TEMPLATE_ID: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2',
  
  // Template features and capabilities
  FEATURES: [
    'claude-code-sdk',
    'subagent-framework',
    'pria-compliance',
    'github-integration',
    'performance-monitoring',
    'context-preservation'
  ] as const,
  
  // Default configuration for sandbox creation
  DEFAULT_CONFIG: {
    template: process.env.E2B_TEMPLATE_ID || 'go8un62yavi0der0vec2', // MUST use template ID for custom templates!
    timeoutMs: 300000, // 5 minutes
    apiKey: process.env.E2B_API_KEY || '',
  },
  
  // Metadata for tracking and debugging
  METADATA: {
    template_version: '2.0.0',
    created_at: new Date().toISOString(),
    pria_version: '1.0.0',
    claude_sdk_version: 'latest',
    nodejs_version: '22',
  }
} as const

/**
 * Get E2B sandbox configuration with proper template settings
 */
export function getE2BSandboxConfig(overrides: Partial<typeof E2B_TEMPLATE_CONFIG.DEFAULT_CONFIG> = {}) {
  return {
    ...E2B_TEMPLATE_CONFIG.DEFAULT_CONFIG,
    ...overrides,
    // Ensure template ID is always used (E2B requires template ID for custom templates)
    template: E2B_TEMPLATE_CONFIG.TEMPLATE_ID,
  }
}

/**
 * Validate E2B template configuration
 */
export function validateE2BConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!process.env.E2B_API_KEY) {
    errors.push('E2B_API_KEY environment variable is required')
  }
  
  if (!E2B_TEMPLATE_CONFIG.TEMPLATE_NAME) {
    errors.push('Template name is required')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get template metadata for sandbox creation
 */
export function getTemplateMetadata(sessionId: string, workspaceId: string) {
  return {
    ...E2B_TEMPLATE_CONFIG.METADATA,
    session_id: sessionId,
    workspace_id: workspaceId,
    initialized_at: new Date().toISOString(),
  }
}