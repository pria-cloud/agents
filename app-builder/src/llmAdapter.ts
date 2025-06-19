import axios from 'axios';

export interface GeminiRequest {
  prompt: string;
  system?: string;
  tools?: any[];
}

export async function generateWithGemini({ prompt, system, tools }: GeminiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Example endpoint, adjust as needed for Gemini 2.5 Flash
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ];

  try {
    const response = await axios.post(
      `${endpoint}?key=${apiKey}`,
      {
        contents: messages,
        tools: tools || [],
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    // Adjust response parsing as per Gemini API
    return response.data?.candidates?.[0]?.content || '';
  } catch (err: any) {
    console.error('Gemini LLM error:', err?.response?.data || err.message);
    throw new Error('Gemini LLM request failed');
  }
} 