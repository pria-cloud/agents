"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase2Codegen = runPhase2Codegen;
// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
const llmAdapter_1 = require("../llmAdapter");
const writeGeneratedApp_1 = require("../writeGeneratedApp");
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = (0, pino_1.default)({
    name: 'phase2-codegen',
    level: process.env.LOG_LEVEL || 'info',
});
async function runPhase2Codegen({ actionPlan, brief, dbSchema, failedReview, }) {
    let system;
    let prompt;
    // Always start with the main, detailed system prompt
    system = fs_1.default.readFileSync(path_1.default.resolve(__dirname, './prompts/phase2_codegen_prompt.md'), 'utf-8');
    system = system.replace('{brief}', brief);
    system = system.replace('{dbSchema}', dbSchema || 'No schema provided.');
    system = system.replace('{actionPlan}', JSON.stringify(actionPlan, null, 2));
    if (failedReview) {
        // A file failed review, so we are in a correction loop.
        // Instead of replacing the system prompt, we add the correction instructions to the user prompt.
        const correctionInstruction = fs_1.default.readFileSync(path_1.default.resolve(__dirname, './prompts/phase2_codegen_correction_prompt.md'), 'utf-8');
        // Create a focused user prompt for the correction task.
        prompt = `${correctionInstruction}\n\n## Feedback:\n${failedReview.feedback}\n\n## Original Code for ${failedReview.file.filePath}:\n\`\`\`\n${failedReview.file.content}\n\`\`\``;
        prompt = prompt.replace('{brief}', brief);
        prompt = prompt.replace('{filePath}', failedReview.file.filePath);
        logger.info({ event: 'phase.codegen.correction_prompt', prompt, system }, 'Correction prompt sent to LLM');
    }
    else {
        // This is the initial code generation
        prompt = `Please generate the code as requested in the system prompt.`;
        logger.info({ event: 'phase.codegen.prompt', prompt, system }, 'Initial prompt and system sent to LLM in codegen phase');
    }
    // Call the LLM
    const raw = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
    logger.info({ event: 'phase.codegen.raw_output', raw }, 'Raw LLM output from codegen phase');
    // Parse <pria-write ...> blocks
    const files = (0, writeGeneratedApp_1.parsePriaWriteBlocks)(raw);
    logger.info({ event: 'phase.codegen.parsed_files', files }, 'Parsed files from codegen phase');
    if (!files || files.length === 0) {
        logger.warn({ event: 'phase.codegen.no_files', raw }, 'No <pria-write ...> blocks found in codegen output');
    }
    return { raw };
}
