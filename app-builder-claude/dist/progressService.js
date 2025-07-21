"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendProgress = sendProgress;
exports.sendStageTransition = sendStageTransition;
exports.sendError = sendError;
exports.sendCompletion = sendCompletion;
exports.sendComplianceUpdate = sendComplianceUpdate;
const supabase_js_1 = require("@supabase/supabase-js");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'progress-service',
    level: process.env.LOG_LEVEL || 'info',
});
// Initialize Supabase client for progress updates
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Send progress update via Supabase Realtime
 * This matches the existing pattern used by the original app-builder
 */
async function sendProgress(conversationId, phase, progress, message, metadata) {
    try {
        const update = {
            conversationId,
            phase,
            progress,
            message,
            timestamp: new Date().toISOString(),
            metadata,
        };
        logger.info({ event: 'progress.send', update }, 'Sending progress update');
        // Send to Supabase Realtime channel
        const channel = supabase.channel(`conversation:${conversationId}`);
        await channel.send({
            type: 'broadcast',
            event: 'progress',
            payload: update,
        });
        logger.info({ event: 'progress.sent', conversationId, phase, progress }, 'Progress update sent');
    }
    catch (error) {
        logger.error({
            event: 'progress.send.error',
            conversationId,
            phase,
            error: error.message
        }, 'Failed to send progress update');
        // Don't throw error - progress updates are nice-to-have
    }
}
/**
 * Send stage transition update
 */
async function sendStageTransition(conversationId, fromStage, toStage, message) {
    const progressMap = {
        understanding: 25,
        building: 60,
        reviewing: 85,
        completed: 100,
    };
    const progress = progressMap[toStage] || 0;
    const defaultMessage = `Transitioning from ${fromStage} to ${toStage}`;
    await sendProgress(conversationId, toStage, progress, message || defaultMessage, { transition: { from: fromStage, to: toStage } });
}
/**
 * Send error update
 */
async function sendError(conversationId, error, phase) {
    try {
        const update = {
            conversationId,
            phase: phase || 'error',
            progress: -1,
            message: error,
            timestamp: new Date().toISOString(),
            error: true,
        };
        logger.error({ event: 'progress.error', update }, 'Sending error update');
        const channel = supabase.channel(`conversation:${conversationId}`);
        await channel.send({
            type: 'broadcast',
            event: 'error',
            payload: update,
        });
        logger.info({ event: 'progress.error.sent', conversationId }, 'Error update sent');
    }
    catch (sendError) {
        logger.error({
            event: 'progress.error.send.error',
            conversationId,
            error: sendError.message
        }, 'Failed to send error update');
    }
}
/**
 * Send completion update
 */
async function sendCompletion(conversationId, files, summary) {
    await sendProgress(conversationId, 'completed', 100, summary, {
        files: files.map(f => ({ filePath: f.filePath, operation: f.operation })),
        fileCount: files.length,
    });
}
/**
 * Send compliance update
 */
async function sendComplianceUpdate(conversationId, complianceReport) {
    const { overall, summary } = complianceReport;
    const message = overall === 'pass'
        ? `Compliance check passed (${summary.passed}/${summary.total})`
        : `Compliance issues found (${summary.failed} failures, ${summary.critical} critical)`;
    await sendProgress(conversationId, 'compliance', overall === 'pass' ? 100 : 50, message, { complianceReport });
}
//# sourceMappingURL=progressService.js.map