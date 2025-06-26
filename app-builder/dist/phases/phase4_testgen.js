"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase4TestGen = runPhase4TestGen;
// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
const llmAdapter_1 = require("../llmAdapter");
async function runPhase4TestGen({ filePath, componentContent, testFilePath }) {
    const system = `You are a Software Development Engineer in Test (SDET) at PRIA. Your job is to write a basic but effective smoke test for the provided React component. The project uses Vitest and React Testing Library. The test must verify that the component renders without crashing. For components that fetch data, mock the necessary functions to prevent actual network calls.\n\nAll prompts must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.`;
    const prompt = `Generate a basic smoke test file for the following React component to ensure it renders without errors.\n\nComponent Path: ${filePath}\nComponent Code:\n\n${componentContent}\n\nReturn only the raw code for the test file. The test file should be located at ${testFilePath}.\n\n(See prompt_strategy.md for full rules.)`;
    const response = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
    // Output should be the raw code for the test file
    return response.trim();
}
