import { generateObject, generateText } from 'ai';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { ZodType } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';

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

  /*
   * 1) Try the official Google GenAI client with a responseSchema → returns pure JSON.
   *    If this fails (model error, library error, quota), we fall back to the
   *    ai-sdk helper which worked previously.
   */
  if (responseSchema) {
    try {
      const aiDirect = new GoogleGenAI({ apiKey });
      const directResponse: any = await aiDirect.models.generateContent({
        model: GEMINI_MODEL,
        contents: combinedPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              updatedAppSpec: { type: Type.OBJECT },
              responseToUser: { type: Type.STRING },
              isComplete: { type: Type.BOOLEAN },
            },
            propertyOrdering: ['updatedAppSpec', 'responseToUser', 'isComplete'],
          },
        },
      });

      const jsonText = typeof directResponse.text === 'function' ? directResponse.text() : directResponse.text;
      if (typeof jsonText === 'string' && jsonText.trim().startsWith('{')) {
        return jsonText;
      }
      // If the response was somehow not JSON, throw to trigger fallback.
      throw new Error('Direct structured call did not return JSON');
    } catch (directErr) {
      console.warn('Gemini direct structured output failed, falling back to ai-sdk generateObject', directErr);
      // continue to fallback below
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
      return JSON.stringify(object);
    }

    const { text } = await generateText({ model, prompt: combinedPrompt });
    return text;
  } catch (err: any) {
    console.error('Gemini (AI SDK) error', err);
    throw err;
  }
}