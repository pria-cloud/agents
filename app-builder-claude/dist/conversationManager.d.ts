import { ClaudeCodeClient } from './claudeCodeClient';
export interface ConversationContext {
    conversationId: string;
    sessionId?: string;
    userInput: string;
    appSpec?: any;
    currentStage: 'understanding' | 'building' | 'reviewing' | 'completed';
    conversationHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    requirements?: any;
    technicalDecisions?: any;
    generatedFiles?: any[];
    complianceChecks?: string[];
    totalCost: number;
}
export interface ConversationResult {
    success: boolean;
    context: ConversationContext;
    response?: string;
    files?: any[];
    error?: string;
    needsUserInput?: boolean;
    progressUpdate?: {
        stage: string;
        progress: number;
        message: string;
    };
}
export declare class ConversationManager {
    private claudeClient;
    private contexts;
    constructor(claudeClient: ClaudeCodeClient);
    /**
     * Start or continue a conversation for app composition
     * This is the main entry point that handles the conversational flow
     */
    processAppCompose(conversationId: string, userInput: string, appSpec?: any, sessionId?: string): Promise<ConversationResult>;
    /**
     * Handle conversational flow - adaptive and non-deterministic
     * Claude decides what to do next based on context and PRIA guidelines
     */
    private handleConversationalFlow;
    /**
     * Build adaptive system prompt that provides PRIA guidelines contextually
     * Rather than rigid phases, we provide architectural guidance that Claude can use flexibly
     */
    private buildAdaptiveSystemPrompt;
    /**
     * Build conversation prompt with full context
     */
    private buildConversationPrompt;
    /**
     * Analyze Claude's response to determine next steps and extract information
     */
    private analyzeConversationResponse;
    /**
     * Extract files from Claude's tool usage
     */
    private extractFilesFromToolUse;
    /**
     * Extract requirements from response text
     */
    private extractRequirementsFromResponse;
    /**
     * Extract technical decisions from response text
     */
    private extractTechnicalDecisionsFromResponse;
    /**
     * Get PRIA architecture guidelines
     */
    private getPRIAArchitectureGuidelines;
    /**
     * Get security guidelines
     */
    private getSecurityGuidelines;
    /**
     * Get quality guidelines
     */
    private getQualityGuidelines;
    /**
     * Get conversation context
     */
    getContext(conversationId: string): ConversationContext | undefined;
    /**
     * Clean up conversation context
     */
    cleanup(conversationId: string): void;
}
//# sourceMappingURL=conversationManager.d.ts.map