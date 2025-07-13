import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({
  name: 'progress-service',
  level: process.env.LOG_LEVEL || 'info',
});

// Initialize Supabase client for progress updates
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
export async function sendProgress(
  conversationId: string,
  phase: string,
  progress: number,
  message: string,
  metadata?: any
): Promise<void> {
  try {
    const update: ProgressUpdate = {
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
  } catch (error: any) {
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
export async function sendStageTransition(
  conversationId: string,
  fromStage: string,
  toStage: string,
  message?: string
): Promise<void> {
  const progressMap = {
    understanding: 25,
    building: 60,
    reviewing: 85,
    completed: 100,
  };

  const progress = progressMap[toStage as keyof typeof progressMap] || 0;
  const defaultMessage = `Transitioning from ${fromStage} to ${toStage}`;

  await sendProgress(
    conversationId,
    toStage,
    progress,
    message || defaultMessage,
    { transition: { from: fromStage, to: toStage } }
  );
}

/**
 * Send error update
 */
export async function sendError(
  conversationId: string,
  error: string,
  phase?: string
): Promise<void> {
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
  } catch (sendError: any) {
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
export async function sendCompletion(
  conversationId: string,
  files: any[],
  summary: string
): Promise<void> {
  await sendProgress(
    conversationId,
    'completed',
    100,
    summary,
    { 
      files: files.map(f => ({ filePath: f.filePath, operation: f.operation })),
      fileCount: files.length,
    }
  );
}

/**
 * Send compliance update
 */
export async function sendComplianceUpdate(
  conversationId: string,
  complianceReport: any
): Promise<void> {
  const { overall, summary } = complianceReport;
  const message = overall === 'pass' 
    ? `Compliance check passed (${summary.passed}/${summary.total})`
    : `Compliance issues found (${summary.failed} failures, ${summary.critical} critical)`;

  await sendProgress(
    conversationId,
    'compliance',
    overall === 'pass' ? 100 : 50,
    message,
    { complianceReport }
  );
} 