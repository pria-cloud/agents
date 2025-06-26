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
}

export async function runPhase2Codegen({
  actionPlan,
  brief,
}: Phase2CodegenInput): Promise<{ raw: string }> {
  let system = fs.readFileSync(
    path.resolve(__dirname, './prompts/phase2_codegen_prompt.md'),
    'utf-8'
  );

  // Substitute placeholders in the system prompt
  system = system.replace('{brief}', brief);
  system = system.replace('{actionPlan}', JSON.stringify(actionPlan, null, 2));

  const prompt = `Please generate the code as requested in the system prompt.`;

  logger.info({ event: 'phase.codegen.prompt', prompt, system }, 'Prompt and system sent to LLM in codegen phase');
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