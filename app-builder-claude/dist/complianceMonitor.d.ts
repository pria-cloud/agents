export interface ComplianceCheck {
    id: string;
    name: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'security' | 'architecture' | 'quality' | 'performance';
}
export interface ComplianceResult {
    check: ComplianceCheck;
    passed: boolean;
    message: string;
    evidence?: string;
    suggestion?: string;
}
export interface ComplianceReport {
    overall: 'pass' | 'fail' | 'warning';
    results: ComplianceResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
        critical: number;
    };
}
export declare class ComplianceMonitor {
    private checks;
    /**
     * Run compliance checks on conversation content
     */
    checkConversationCompliance(conversationContent: string, files?: any[], context?: any): Promise<ComplianceReport>;
    /**
     * Run a single compliance check
     */
    private runSingleCheck;
    /**
     * Check tenant isolation compliance
     */
    private checkTenantIsolation;
    /**
     * Check user registration pattern compliance
     */
    private checkUserRegistration;
    /**
     * Check for hardcoded secrets
     */
    private checkNoHardcodedSecrets;
    /**
     * Check for PII logging
     */
    private checkNoPIILogging;
    /**
     * Check access control validation
     */
    private checkAccessControl;
    /**
     * Check Next.js App Router usage
     */
    private checkNextJSAppRouter;
    /**
     * Check TypeScript usage
     */
    private checkTypeScriptUsage;
    /**
     * Check Supabase patterns
     */
    private checkSupabasePatterns;
    /**
     * Check import aliases
     */
    private checkImportAliases;
    /**
     * Check file structure compliance
     */
    private checkFileStructure;
    /**
     * Check production ready code
     */
    private checkProductionReady;
    /**
     * Check for console logs
     */
    private checkNoConsoleLogs;
    /**
     * Check complete implementations
     */
    private checkCompleteImplementations;
    /**
     * Check proper error handling
     */
    private checkProperErrorHandling;
    /**
     * Check TypeScript typing
     */
    private checkTypeScriptTyping;
    /**
     * Generate summary of compliance results
     */
    private generateSummary;
    /**
     * Determine overall compliance status
     */
    private determineOverallStatus;
    /**
     * Get all compliance checks
     */
    getChecks(): ComplianceCheck[];
    /**
     * Get checks by category
     */
    getChecksByCategory(category: ComplianceCheck['category']): ComplianceCheck[];
    /**
     * Get checks by severity
     */
    getChecksBySeverity(severity: ComplianceCheck['severity']): ComplianceCheck[];
}
//# sourceMappingURL=complianceMonitor.d.ts.map