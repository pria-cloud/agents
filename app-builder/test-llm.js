"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const llmAdapter_1 = require("./src/llmAdapter");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
async function runLlmTest() {
    console.log('--- Running LLM Adapter Test ---');
    const testPrompt = `
You are a test assistant.
Your ONLY job is to return a single, valid JSON object.
The JSON object you must return is: {"status": "ok", "message": "Test successful"}
Do NOT add any other text, explanation, or markdown.
Your entire response must start with { and end with }.
  `;
    console.log('\n[INPUT] Prompt sent to LLM:');
    console.log('------------------------------------');
    console.log(testPrompt);
    console.log('------------------------------------');
    try {
        const rawOutput = await (0, llmAdapter_1.generateWithGemini)({ prompt: testPrompt });
        console.log('\n[OUTPUT] Raw response from LLM:');
        console.log('------------------------------------');
        console.log(rawOutput);
        console.log('------------------------------------');
        console.log(`Type of rawOutput: ${typeof rawOutput}`);
        console.log('\n[ANALYSIS] Trying to parse JSON...');
        try {
            const parsed = JSON.parse(rawOutput);
            console.log('JSON parsing SUCCESSFUL.');
            console.log('Parsed object:', parsed);
        }
        catch (e) {
            console.error('JSON parsing FAILED.');
            console.error('Error:', e.message);
        }
    }
    catch (error) {
        console.error('\n[ERROR] An error occurred while calling generateWithGemini:', error);
    }
    finally {
        console.log('\n--- Test Complete ---');
    }
}
runLlmTest();
