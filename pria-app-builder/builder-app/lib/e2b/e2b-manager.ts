/**
 * E2B Manager - Bridge to OptimizedE2BSandboxManager
 * Provides backward compatibility for webhook imports
 */

export { OptimizedE2BSandboxManager as E2BManager } from './sandbox-manager-optimized'
export type { SandboxEnvironment } from './sandbox-manager-optimized'

// Re-export for backward compatibility
export { OptimizedE2BSandboxManager } from './sandbox-manager-optimized'