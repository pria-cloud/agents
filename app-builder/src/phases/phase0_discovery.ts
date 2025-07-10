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
    description: z.string().max(500).optional(),
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
  let raw: string;
  try {
    raw = await generateWithGemini({ prompt, system, responseSchema: DiscoveryResponseSchema });
  } catch (err: any) {
    logger.warn({ event: 'phase.discovery.structured_fail', err: err?.message }, 'Structured generation failed, falling back to plain text');
    raw = await generateWithGemini({ prompt, system });
  }
  logger.info({ event: 'phase.discovery.raw_output', conversationId, raw }, 'Raw LLM output from discovery phase');

  try {
    // Robust JSON extraction -----------------------------------
    let jsonString: string | null = null;

    // 1) Try to capture content between the first ```json ... ``` fence
    const fenceMatch = raw.match(/```json[\s\r\n]*([\s\S]*?)```/i);
    if (fenceMatch) {
      jsonString = fenceMatch[1];
      try {
        const parsedAttempt = JSON.parse(jsonString);
        jsonString = JSON.stringify(parsedAttempt); // normalise
      } catch (_err) {
        // The fence capture was incomplete (e.g. nested ``` inside README). Fall back.
        jsonString = null;
      }
    }

    // 2) Fallback: slice from the first '{' to the last '}'; handles outputs with nested fences
    if (!jsonString) {
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

    const clean = validationResult.data;
    const desc = (clean.updatedAppSpec as any)?.description;
    if (typeof desc === 'string' && desc.length > 1000) {
      (clean.updatedAppSpec as any).description = desc.slice(0, 1000) + '…';
      logger.info({ event: 'phase.discovery.truncate', originalLen: desc.length }, 'Truncated oversized description field in discovery spec');
    }

    return clean;
  } catch (error) {
    logger.error({ event: 'phase.discovery.json_parse_error', raw, error }, 'Failed to parse JSON from LLM output in discovery phase');
    return {
      updatedAppSpec: currentSpec,
      responseToUser: "I'm sorry, I encountered an issue processing that. Could you please try rephrasing your request?",
      isComplete: false,
    };
  }
}