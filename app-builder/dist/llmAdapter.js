"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithGemini = generateWithGemini;
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
// Use Gemini 2.5 Flash everywhere, per project requirements and official model name
const GEMINI_MODEL = 'gemini-2.5-flash'; // Consistent model id for Google provider
async function generateWithGemini({ prompt, system, responseSchema }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY not set');
    // Create a provider instance with the explicit API key so we don't rely on env var names
    const googleWithKey = (0, google_1.createGoogleGenerativeAI)({ apiKey });
    const model = googleWithKey(GEMINI_MODEL);
    // Merge system + user prompt into one string similar to previous impl.
    const combinedPrompt = system ? `${system}\n\n---\n\n${prompt}` : prompt;
    try {
        if (responseSchema) {
            // Structured JSON output required
            const { object } = await (0, ai_1.generateObject)({
                model,
                schema: responseSchema,
                prompt: combinedPrompt,
            });
            return JSON.stringify(object);
        }
        // No schema – return plain text
        const { text } = await (0, ai_1.generateText)({
            model,
            prompt: combinedPrompt,
        });
        return text;
    }
    catch (err) {
        console.error('Gemini (AI SDK) error', err);
        throw err;
    }
}
