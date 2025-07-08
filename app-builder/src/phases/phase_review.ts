import { generateWithGemini } from '../llmAdapter';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import pLimit from 'p-limit';

const logger = pino({
  name: 'phase-review',
  level: process.env.LOG_LEVEL || 'info',
});

export interface ReviewInputFile {
  filePath: string;
  content: string;
}

export interface ReviewResult {
  filePath: string;
  pass: boolean;
  feedback: string;
}

// Helper function to assemble prompts from partials
function assemblePrompt(partials: string[]): string {
  return partials.map(partial => 
    fs.readFileSync(path.resolve(__dirname, '../prompts/partials', partial), 'utf-8')
  ).join('\n\n');
}

export async function runPhaseReview(files: ReviewInputFile[], schema: any): Promise<ReviewResult[]> {
  const concurrency = Number(process.env.REVIEW_CONCURRENCY || 4);
  const limit = pLimit(concurrency);
  const partials = [
    'instructions_review.md',
    'context_scaffold.md',
    'context_supabase_patterns.md',
    'context_forbidden_files.md',
    'rules_critical_schema.md',
    'rules_critical_output.md',
    'rules_general_quality.md',
  ];
  
  let system = assemblePrompt(partials);
  system = system.replace('{schema}', JSON.stringify(schema, null, 2));

  const tasks = files.map(file => limit(async () => {
    const userPrompt = `You are the PRIA Code Reviewer. Your task is to analyze the following generated file for quality, correctness, and adherence to the system prompt's rules.

Review the following file for correctness, completeness, and adherence to the PRIA architecture.

File: ${file.filePath}

Content:
\`\`\`
${file.content}
\`\`\``;

    logger.info({ event: 'phase.review.prompt', filePath: file.filePath }, 'Sending file for review');
    const raw = await generateWithGemini({ prompt: userPrompt, system });

    // Remove markdown code block wrappers if present
    const cleanedRaw = raw.replace(/^\`\`\`(json)?[\r\n]+|\`\`\`$/gim, '').trim();

    try {
      const parsed = JSON.parse(cleanedRaw);
      logger.info({ event: 'phase.review.result', filePath: file.filePath, pass: parsed.pass }, 'File review completed.');
      return { filePath: file.filePath, pass: !!parsed.pass, feedback: parsed.feedback || '' } as ReviewResult;
    } catch {
      const feedback = 'Review LLM output was not valid JSON: ' + cleanedRaw;
      logger.error({ event: 'phase.review.invalid_json', filePath: file.filePath, json: cleanedRaw }, feedback);
      return { filePath: file.filePath, pass: false, feedback } as ReviewResult;
    }
  }));

  const results = await Promise.all(tasks);
  return results;
}
