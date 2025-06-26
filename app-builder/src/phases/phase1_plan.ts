// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
import { generateWithGemini } from '../llmAdapter';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino({
  name: 'phase1-plan',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Phase 1: Analysis & Action Plan
 * Analyze the app spec, classify, and generate a structured JSON plan.
 */
export async function runPhase1Plan(appSpec: any, bestPracticeCatalogue: any): Promise<any> {
  const promptPath = path.join(__dirname, 'prompts', 'phase1_plan_prompt.md');
  let system = fs.readFileSync(promptPath, 'utf8');

  // Substitute placeholders
  system = system
    .replace('{appSpec}', JSON.stringify(appSpec, null, 2))
    .replace('{bestPracticeCatalogue}', JSON.stringify(bestPracticeCatalogue, null, 2));

  const prompt = `Please generate the JSON plan as requested in the system prompt.`;

  logger.info({ event: 'phase.plan.prompt', prompt, system }, 'Prompt and system sent to LLM in plan phase');
  const raw = await generateWithGemini({ prompt, system });
  logger.info({ event: 'phase.plan.raw_output', raw }, 'Raw LLM output from plan phase');
  let plan: any = null;

  // Pre-process the raw string to remove markdown code fences
  const cleanedRaw = raw.replace(/```json\n/g, '').replace(/\n```/g, '');

  try {
    plan = JSON.parse(cleanedRaw);
  } catch {
    // Try to extract the first JSON object from the response
    const match = cleanedRaw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        plan = JSON.parse(match[0]);
      } catch (e2) {
        console.error('Phase 1 LLM output (extracted) is not valid JSON:', match[0]);
        logger.error({ event: 'phase.plan.invalid_json', json: match[0], error: e2 }, 'Invalid JSON after extraction');
        throw new Error('Phase 1 LLM output is not valid JSON (after extraction)');
      }
    } else {
      console.error('Phase 1 LLM output is not valid JSON:', cleanedRaw, 'Type:', typeof cleanedRaw);
      logger.error({ event: 'phase.plan.invalid_json', json: cleanedRaw }, 'Invalid JSON');
      throw new Error('Phase 1 LLM output is not valid JSON');
    }
  }
  return plan;
} 