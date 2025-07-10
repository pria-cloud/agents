import { generateObject, generateText } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { ZodType } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';
import pino from 'pino';

const logger = pino({ name: 'llm-adapter', level: process.env.LOG_LEVEL || 'info' });

export interface GeminiRequest {
  prompt: string;
  system?: string;
  tools?: any[];
  /**
   * A Zod schema describing the expected JSON output. If omitted, the raw text
   * response from the model will be returned.
   */
  responseSchema?: ZodType<any>;
}

// Use Gemini 2.5 Flash everywhere, per project requirements and official model name
const GEMINI_MODEL = 'gemini-2.5-flash'; // Consistent model id for Google provider

export async function generateWithGemini({ prompt, system, responseSchema }: GeminiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const combinedPrompt = system ? `${system}\n\n---\n\n${prompt}` : prompt;

  // Start timing for diagnostics
  const callStart = Date.now();
  logger.info({ event: 'llm.call.start', hasSchema: !!responseSchema, promptChars: prompt.length, systemChars: system?.length || 0 }, 'Gemini request initiated');

  /*
   * 1) Try the official Google GenAI client with a responseSchema → returns pure JSON.
   *    If this fails (model error, library error, quota), we fall back to the
   *    ai-sdk helper which worked previously.
   */
  if (responseSchema) {
    // Build a corresponding JSON schema for the GenAI client based on known response shapes.
    let googleSchema: any | null = null;

    const maybeShape = (responseSchema as any)?._def?.shape?.();

    // Discovery schema: updatedAppSpec / responseToUser / isComplete
    if (maybeShape && maybeShape.updatedAppSpec && maybeShape.responseToUser && maybeShape.isComplete) {
      googleSchema = {
        type: Type.OBJECT,
        properties: {
          updatedAppSpec: {
            type: Type.OBJECT,
            properties: { description: { type: Type.STRING } },
            required: ["description"],
          },
          responseToUser: { type: Type.STRING },
          isComplete: { type: Type.BOOLEAN },
        },
        required: ["updatedAppSpec", "responseToUser", "isComplete"],
        propertyOrdering: ["updatedAppSpec", "responseToUser", "isComplete"],
      };
    }

    // Codegen schema: dependencies / files
    if (!googleSchema && maybeShape && maybeShape.dependencies && maybeShape.files) {
      googleSchema = {
        type: Type.OBJECT,
        properties: {
          dependencies: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          files: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                filePath: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ['filePath', 'content'],
              propertyOrdering: ['filePath', 'content'],
            },
          },
        },
        required: ['dependencies', 'files'],
        propertyOrdering: ['dependencies', 'files'],
      };
    }

    if (googleSchema) {
      try {
        const aiDirect = new GoogleGenAI({ apiKey });
        const directResponse: any = await aiDirect.models.generateContent({
          model: GEMINI_MODEL,
          contents: combinedPrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: googleSchema,
          },
        });

        const jsonText = typeof directResponse.text === 'function' ? directResponse.text() : directResponse.text;
        logger.info({ event: 'llm.call.success', path: 'genai.direct', durationMs: Date.now() - callStart, responseChars: (typeof jsonText === 'string' ? jsonText.length : 0) }, 'Gemini direct structured call succeeded');
        if (typeof jsonText === 'string' && jsonText.trim().startsWith('{')) {
          return jsonText;
        }
        throw new Error('Direct structured call did not return JSON');
      } catch (directErr) {
        logger.warn({ event: 'llm.call.error', path: 'genai.direct', durationMs: Date.now() - callStart, error: (directErr as any)?.message }, 'Gemini direct structured output failed – falling back');
      }
    }
  }

  // 2) Legacy ai-sdk path (unchanged)
  const googleWithKey = createGoogleGenerativeAI({ apiKey });
  const model = googleWithKey(GEMINI_MODEL);

  try {
    if (responseSchema) {
      const { object } = await generateObject({
        model,
        schema: responseSchema,
        prompt: combinedPrompt,
      });
      logger.info({ event: 'llm.call.success', path: 'ai-sdk.object', durationMs: Date.now() - callStart, responseChars: JSON.stringify(object).length }, 'Gemini ai-sdk structured call succeeded');
      return JSON.stringify(object);
    }

    const { text } = await generateText({ model, prompt: combinedPrompt });
    logger.info({ event: 'llm.call.success', path: 'ai-sdk.text', durationMs: Date.now() - callStart, responseChars: text.length }, 'Gemini ai-sdk text call succeeded');
    return text;
  } catch (err: any) {
    logger.error({ event: 'llm.call.error', path: 'ai-sdk', durationMs: Date.now() - callStart, error: err?.message }, 'Gemini (AI SDK) error');
    throw err;
  }
}