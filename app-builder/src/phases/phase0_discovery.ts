import { generateWithGemini } from '../llmAdapter';
import { z } from 'zod';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logger = pino({
  name: 'phase0-discovery',
  level: process.env.LOG_LEVEL || 'info',
});

// Zod schema for the AppSpec
const AppSpecSchema = z.object({
    // description is helpful but not strictly required in early discovery iterations
    description: z.string().optional(),
    /*
     * Allow the spec to include any other keys while the user and LLM iterate.
     * We intentionally keep this schema very loose so that minor field-name
     * variations (e.g. `appDescription` vs `description`) do not cause the
     * entire discovery phase to reject the response. Down-stream phases work
     * with the spec generically, so strict validation is unnecessary here.
     */
}).passthrough();

// Zod schema for the LLM's response
const DiscoveryResponseSchema = z.object({
    updatedAppSpec: AppSpecSchema,
    responseToUser: z.string(),
    isComplete: z.boolean(),
});

// JSON schema for Gemini (must not contain empty `properties`)
const GeminiSchema = {
  type: 'object',
  properties: {
    updatedAppSpec: {
      type: 'object',
      additionalProperties: true,
    },
    responseToUser: { type: 'string' },
    isComplete: { type: 'boolean' },
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
export async function runPhase0ProductDiscovery(
  userInput: string,
  currentSpec: any,
  conversationId: string,
  history: Array<{ role: string; content: string }> = []
): Promise<{updatedAppSpec: any, responseToUser: string, isComplete: boolean}> {
  const partials = [
    'instructions_discovery.md',
    'rules_critical_output.md',
  ];
  const system = assemblePrompt(partials);

  const historyBlock = history
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const prompt = `Here is the conversation so far:\n${historyBlock}\n\nCurrent user input: "${userInput}"\n\nCurrentSpec: ${JSON.stringify(currentSpec, null, 2)}\n\nPlease continue with product discovery and indicate if it is complete.`;

  logger.info({ event: 'phase.discovery.prompt', conversationId }, 'Prompt sent to LLM for product discovery');
  const raw = await generateWithGemini({ prompt, system });
  logger.info({ event: 'phase.discovery.raw_output', conversationId, raw }, 'Raw LLM output from discovery phase');

  try {
    // Robust JSON extraction -----------------------------------
    let jsonString: string | null = null;

    // 1) Strip ```json fences if present
    const fenceMatch = raw.match(/```json[\s\r\n]*([\s\S]*?)```/i);
    if (fenceMatch) {
      jsonString = fenceMatch[1];
    } else {
      // 2) Fallback: slice from first '{' to last '}'
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = raw.slice(firstBrace, lastBrace + 1);
      }
    }

    if (!jsonString) throw new Error('LLM output did not contain JSON');

    const parsed = JSON.parse(jsonString);

    // Debug log of the parsed structure before validation
    logger.debug({ parsed }, 'Parsed JSON from discovery');

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