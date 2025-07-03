import { generateWithGemini } from '../llmAdapter';
import { z } from 'zod';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { Type } from '@google/genai';

const logger = pino({
  name: 'phase0-discovery',
  level: process.env.LOG_LEVEL || 'info',
});

// Zod schema for the AppSpec
const AppSpecSchema = z.object({
    spec_version: z.string(),
    description: z.string(),
    domain: z.string(),
    schema: z.record(z.any()), // A record of tables
    userActions: z.array(z.record(z.any())), // An array of user actions
    isConfirmed: z.boolean().optional().nullable(),
});

// Zod schema for the LLM's response
const DiscoveryResponseSchema = z.object({
    updatedAppSpec: AppSpecSchema,
    responseToUser: z.string(),
    isComplete: z.boolean(),
});

// Define the JSON schema for the Gemini API based on the Zod schema
const GeminiSchema = {
    type: Type.OBJECT,
    properties: {
        updatedAppSpec: {
            type: Type.OBJECT,
            properties: {
                spec_version: { type: Type.STRING },
                description: { type: Type.STRING },
                domain: { type: Type.STRING },
                schema: {}, // Allow any object
                userActions: { type: Type.ARRAY, items: {} }, // Allow any object in the array
                isConfirmed: { type: Type.BOOLEAN, nullable: true },
            },
            required: ['spec_version', 'description', 'domain', 'schema', 'userActions']
        },
        responseToUser: { type: Type.STRING },
        isComplete: { type: Type.BOOLEAN },
    },
    required: ['updatedAppSpec', 'responseToUser', 'isComplete'],
};

// Helper function to assemble prompts from partials
function assemblePrompt(partials: string[]): string {
  return partials.map(partial => 
    fs.readFileSync(path.resolve(__dirname, '../prompts/partials', partial), 'utf-8')
  ).join('\\n\\n');
}

/**
 * Phase 0: Product Discovery
 * Iteratively builds an application specification through a conversation with the user.
 */
export async function runPhase0ProductDiscovery(userInput: string, currentSpec: any, conversationId: string): Promise<{updatedAppSpec: any, responseToUser: string, isComplete: boolean}> {
  const partials = [
    'instructions_discovery.md',
    'rules_critical_output.md',
  ];
  const system = assemblePrompt(partials);

  const prompt = `Here is the current state of our conversation. Please continue the product discovery based on my latest input.\n\nUserInput: "${userInput}"\n\nCurrentSpec: ${JSON.stringify(currentSpec, null, 2)}`;

  logger.info({ event: 'phase.discovery.prompt', conversationId }, 'Prompt sent to LLM for product discovery');
  const raw = await generateWithGemini({ prompt, system, responseSchema: GeminiSchema });
  logger.info({ event: 'phase.discovery.raw_output', conversationId, raw }, 'Raw LLM output from discovery phase');

  try {
    const parsed = JSON.parse(raw);
    const validationResult = DiscoveryResponseSchema.safeParse(parsed);
    
    if (!validationResult.success) {
      logger.error({ event: 'phase.discovery.validation_error', errors: validationResult.error.issues, data: parsed }, 'LLM response failed validation');
      throw new Error('LLM response validation failed.');
    }

    return validationResult.data;
  } catch (error) {
    logger.error({ event: 'phase.discovery.json_parse_error', raw, error }, 'Failed to parse JSON from LLM output in discovery phase');
    return {
      updatedAppSpec: currentSpec,
      responseToUser: "I'm sorry, I encountered an issue processing that. Could you please try rephrasing your request?",
      isComplete: false,
    };
  }
}