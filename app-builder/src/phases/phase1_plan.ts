import { generateWithGemini } from '../llmAdapter';
import { z } from 'zod';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({
  name: 'phase1-plan',
  level: process.env.LOG_LEVEL || 'info',
});

const PlanResponseSchema = z.object({
  classification: z.string(),
  actionPlan: z.array(z.object({
    filePath: z.string(),
    description: z.string(),
  })),
});

// Helper function to assemble prompts from partials
function assemblePrompt(partials: string[]): string {
  return partials.map(partial => 
    fs.readFileSync(path.resolve(__dirname, '../prompts/partials', partial), 'utf-8')
  ).join('\\n\\n');
}

/**
 * Phase 1: Analysis & Action Plan
 * Analyze the app spec and generate a structured JSON plan.
 */
export async function runPhase1Plan(appSpec: any): Promise<{ classification: string; actionPlan: { filePath: string; description: string }[] }> {
  const partials = [
    'instructions_planning.md',
    'context_scaffold.md',
    'context_supabase_patterns.md', // Provides context on tenancy for the planner
    'context_forbidden_files.md',
    'rules_critical_output.md', // To ensure the planner outputs valid JSON
  ];
  const system = assemblePrompt(partials);

  const prompt = `Here is the application specification. Please generate the JSON plan as requested in the system prompt.\n\n${JSON.stringify(appSpec, null, 2)}`;

  logger.info({ event: 'phase.plan.prompt' }, 'Prompt sent to LLM in plan phase');
  const raw = await generateWithGemini({ prompt, system, responseSchema: PlanResponseSchema });
  logger.info({ event: 'phase.plan.raw_output', raw }, 'Raw LLM output from plan phase');
  
  try {
    const parsed = JSON.parse(raw);
    const validationResult = PlanResponseSchema.safeParse(parsed);
    if (!validationResult.success) {
      logger.error({ event: 'phase.plan.validation_error', errors: validationResult.error.issues, data: parsed }, 'LLM response failed validation');
      throw new Error('LLM response validation failed.');
    }
    return validationResult.data;
  } catch (error) {
    logger.error({ event: 'phase.plan.invalid_json', json: raw, error }, 'Failed to parse valid JSON plan from LLM output');
    return {
      classification: 'error',
      actionPlan: [{
        filePath: 'error.log',
        description: `Failed to generate a valid action plan. LLM output was: ${raw}`
      }]
    };
  }
}