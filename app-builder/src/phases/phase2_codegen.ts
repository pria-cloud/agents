// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
import { generateWithGemini } from '../llmAdapter';
import { parsePriaWriteBlocks } from '../writeGeneratedApp';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({
  name: 'phase2-codegen',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Phase 2: Holistic Feature Generation
 * Generate all necessary, self-contained, and production-ready files for a single application feature.
 */
export interface Phase2CodegenInput {
  actionPlan: { filePath: string; description: string }[];
  brief: string;
  dbSchema?: string;
  failedReview?: {
    file: { filePath: string; content: string };
    feedback: string;
  };
}

export async function runPhase2Codegen({
  actionPlan,
  brief,
  dbSchema,
  failedReview,
}: Phase2CodegenInput): Promise<{ raw: string }> {
  let system: string;
  let prompt: string;

  if (failedReview) {
    // A file failed review, so we are in a correction loop.
    system = fs.readFileSync(path.resolve(__dirname, './prompts/phase2_codegen_correction_prompt.md'), 'utf-8');
    system = system.replace('{brief}', brief);
    system = system.replace('{dbSchema}', dbSchema || 'No schema provided.');
    system = system.replace('{filePath}', failedReview.file.filePath);
    
    // Create a focused user prompt for the correction task.
    prompt = `## Feedback:\n${failedReview.feedback}\n\n## Original Code for ${failedReview.file.filePath}:\n\`\`\`\n${failedReview.file.content}\n\`\`\``;

    logger.info({ event: 'phase.codegen.correction_prompt', prompt, system }, 'Correction prompt sent to LLM');

  } else {
    // This is the initial code generation, using the main prompt.
    system = fs.readFileSync(path.resolve(__dirname, './prompts/phase2_codegen_prompt.md'), 'utf-8');
    system = system.replace('{brief}', brief);
    system = system.replace('{dbSchema}', dbSchema || 'No schema provided.');
    system = system.replace('{actionPlan}', JSON.stringify(actionPlan, null, 2));

    prompt = `Please generate the code as requested in the system prompt.`;
    logger.info({ event: 'phase.codegen.prompt', prompt, system }, 'Initial prompt and system sent to LLM in codegen phase');
  }

  // Call the LLM
  const raw = await generateWithGemini({ prompt, system });
  logger.info({ event: 'phase.codegen.raw_output', raw }, 'Raw LLM output from codegen phase');
  // Parse <pria-write ...> blocks
  const files = parsePriaWriteBlocks(raw);
  logger.info({ event: 'phase.codegen.parsed_files', files }, 'Parsed files from codegen phase');
  if (!files || files.length === 0) {
    logger.warn({ event: 'phase.codegen.no_files', raw }, 'No <pria-write ...> blocks found in codegen output');
  }
  return { raw };
} 