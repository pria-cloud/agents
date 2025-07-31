/**
 * E2B Service - Bridge to OptimizedE2BSandboxManager
 * Provides backward compatibility for existing imports
 */

export { OptimizedE2BSandboxManager as E2BSandboxManager } from '@/lib/e2b/sandbox-manager-optimized'
export { OptimizedE2BSandboxManager as E2BSandboxService } from '@/lib/e2b/sandbox-manager-optimized'
export type { SandboxEnvironment } from '@/lib/e2b/sandbox-manager-optimized'

// Re-export for backward compatibility
export { OptimizedE2BSandboxManager } from '@/lib/e2b/sandbox-manager-optimized'