import { generateObject, generateText } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { ZodType } from 'zod';

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

  // Create a provider instance with the explicit API key so we don't rely on env var names
  const googleWithKey = createGoogleGenerativeAI({ apiKey });
  const model = googleWithKey(GEMINI_MODEL);

  // Merge system + user prompt into one string similar to previous impl.
  const combinedPrompt = system ? `${system}\n\n---\n\n${prompt}` : prompt;

  try {
    if (responseSchema) {
      // Structured JSON output required
      const { object } = await generateObject({
        model,
        schema: responseSchema,
        prompt: combinedPrompt,
      });
      return JSON.stringify(object);
    }

    // No schema – return plain text
    const { text } = await generateText({
      model,
      prompt: combinedPrompt,
    });
    return text;
  } catch (err: any) {
    console.error('Gemini (AI SDK) error', err);
    throw err;
  }
}