import { ComplianceMonitor, ComplianceReport } from './complianceMonitor';
export interface PromptContext {
    stage: 'understanding' | 'building' | 'reviewing' | 'completed';
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    requirements?: any;
    technicalDecisions?: any;
    generatedFiles?: any[];
    complianceReport?: ComplianceReport;
    userInput: string;
    appSpec?: any;
}
export interface AdaptivePrompt {
    systemPrompt: string;
    userPrompt: string;
    context: PromptContext;
    guidelines: string[];
    complianceReminders: string[];
}
export declare class AdaptivePromptStrategy {
    private complianceMonitor;
    constructor();
    /**
     * Generate adaptive prompt based on conversation context
     * This is the main method that creates contextual prompts for Claude
     */
    generatePrompt(context: PromptContext): Promise<AdaptivePrompt>;
    /**
     * Build system prompt with contextual PRIA guidelines
     */
    private buildSystemPrompt;
    /**
     * Build user prompt with conversation context
     */
    private buildUserPrompt;
    /**
     * Get PRIA architecture guidelines
     */
    private getPRIAArchitecture;
    /**
     * Get security guidelines
     */
    private getSecurityGuidelines;
    /**
     * Get quality standards
     */
    private getQualityStandards;
    /**
     * Get contextual guidance based on current stage
     */
    private getContextualGuidance;
    /**
     * Get relevant guidelines based on context
     */
    private getRelevantGuidelines;
    /**
     * Get compliance reminders based on current state
     */
    private getComplianceReminders;
    /**
     * Summarize conversation history for context
     */
    private summarizeConversationHistory;
    /**
     * Get stage-specific tools guidance
     */
    getToolsGuidance(stage: PromptContext['stage']): string;
    /**
     * Check if compliance monitoring is needed
     */
    shouldCheckCompliance(context: PromptContext): boolean;
    /**
     * Get compliance monitor instance
     */
    getComplianceMonitor(): ComplianceMonitor;
}
//# sourceMappingURL=adaptivePromptStrategy.d.ts.map