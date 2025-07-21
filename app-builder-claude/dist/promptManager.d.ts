/**
 * Comprehensive prompt management system for Claude Code SDK agent
 * Includes all critical rules and instructions from the original app-builder's partials
 */
export declare class PromptManager {
    static getScaffoldContext(): string;
    static getForbiddenFilesContext(): string;
    static getSupabaseContext(): string;
    static getCriticalOutputRules(): string;
    static getCriticalSchemaRules(): string;
    static getGeneralQualityRules(): string;
    static getDiscoveryInstructions(): string;
    static getPlanningInstructions(): string;
    static getCodegenInstructions(): string;
    static getCorrectionInstructions(): string;
    static getReviewInstructions(): string;
    static buildDiscoverySystemPrompt(): string;
    static buildPlanningSystemPrompt(): string;
    static buildCodegenSystemPrompt(): string;
    static buildReviewSystemPrompt(): string;
    static buildCorrectionSystemPrompt(): string;
}
//# sourceMappingURL=promptManager.d.ts.map