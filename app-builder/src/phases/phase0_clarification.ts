// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
import { generateWithGemini } from '../llmAdapter';
import fs from 'fs';
import path from 'path';

/**
 * Phase 0: Requirement Elicitation & Clarification
 * If the initial app.compose intent lacks sufficient detail, generate clarifying questions.
 */
export async function runPhase0Clarification(userInput: string): Promise<string[]> {
  const promptPath = path.join(__dirname, 'prompts', 'phase0_clarification_prompt.md');
  let system = fs.readFileSync(promptPath, 'utf8');

  // Substitute placeholder
  system = system.replace('{userInput}', userInput);

  const prompt = `Please generate the questions as requested in the system prompt.`;

  const response = await generateWithGemini({ prompt, system });
  // Try to parse as a list of questions (either JSON array or numbered list)
  let questions: string[] = [];
  try {
    // Try JSON parse first
    questions = JSON.parse(response);
    if (!Array.isArray(questions)) throw new Error('Not an array');
  } catch {
    // Fallback: split by line/number
    questions = response
      .split(/\n|\r/)
      .map(line => line.replace(/^\d+\.?\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  return questions;
} 