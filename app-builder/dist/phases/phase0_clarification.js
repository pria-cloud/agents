"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase0Clarification = runPhase0Clarification;
// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
const llmAdapter_1 = require("../llmAdapter");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Phase 0: Requirement Elicitation & Clarification
 * If the initial app.compose intent lacks sufficient detail, generate clarifying questions.
 */
async function runPhase0Clarification(userInput) {
    const promptPath = path_1.default.join(__dirname, 'prompts', 'phase0_clarification_prompt.md');
    let system = fs_1.default.readFileSync(promptPath, 'utf8');
    // Substitute placeholder
    system = system.replace('{userInput}', userInput);
    const prompt = `Please generate the questions as requested in the system prompt.`;
    const response = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
    // Try to parse as a list of questions (either JSON array or numbered list)
    let questions = [];
    try {
        // Try JSON parse first
        questions = JSON.parse(response);
        if (!Array.isArray(questions))
            throw new Error('Not an array');
    }
    catch {
        // Fallback: split by line/number
        questions = response
            .split(/\n|\r/)
            .map(line => line.replace(/^\d+\.?\s*/, '').trim())
            .filter(line => line.length > 0);
    }
    return questions;
}
