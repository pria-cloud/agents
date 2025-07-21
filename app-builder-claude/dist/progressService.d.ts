export interface ProgressUpdate {
    conversationId: string;
    phase: string;
    progress: number;
    message: string;
    timestamp: string;
    metadata?: any;
}
/**
 * Send progress update via Supabase Realtime
 * This matches the existing pattern used by the original app-builder
 */
export declare function sendProgress(conversationId: string, phase: string, progress: number, message: string, metadata?: any): Promise<void>;
/**
 * Send stage transition update
 */
export declare function sendStageTransition(conversationId: string, fromStage: string, toStage: string, message?: string): Promise<void>;
/**
 * Send error update
 */
export declare function sendError(conversationId: string, error: string, phase?: string): Promise<void>;
/**
 * Send completion update
 */
export declare function sendCompletion(conversationId: string, files: any[], summary: string): Promise<void>;
/**
 * Send compliance update
 */
export declare function sendComplianceUpdate(conversationId: string, complianceReport: any): Promise<void>;
//# sourceMappingURL=progressService.d.ts.map