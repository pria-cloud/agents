import { GoogleGenAI } from '@google/genai';

export interface GeminiRequest {
  prompt: string;
  system?: string;
  tools?: any[];
}

// Use Gemini 2.5 Flash everywhere, per project requirements and official model name
const GEMINI_MODEL = 'gemini-2.5-flash'; // See @/specifications/geminiSDK.md and Google GenAI docs

export async function generateWithGemini({ prompt, system }: GeminiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  let attempt = 0;
  const maxAttempts = 3;
  let lastError;
  while (attempt < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(system && { config: { systemInstruction: system } }),
      });
      // .text is the concatenated text output
      return response.text ?? '';
    } catch (err: any) {
      lastError = err;
      console.error('Gemini (Google GenAI SDK) error:', {
        apiKeySet: !!apiKey,
        request: { prompt, system },
        errorData: err?.response?.data,
        errorMessage: err.message,
        errorStack: err.stack,
        attempt: attempt + 1,
      });
      if (attempt < maxAttempts - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`Gemini LLM error, retrying in ${delay}ms (attempt ${attempt + 2}/${maxAttempts})`);
        await new Promise(res => setTimeout(res, delay));
        attempt++;
        continue;
      }
      throw new Error('Gemini (Google GenAI SDK) request failed');
    }
  }
  throw lastError || new Error('Gemini (Google GenAI SDK) request failed');
} 