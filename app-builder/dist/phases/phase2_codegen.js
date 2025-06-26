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
async function runPhase2Codegen({ actionPlan, brief, }) {
    let system = fs_1.default.readFileSync(path_1.default.resolve(__dirname, './prompts/phase2_codegen_prompt.md'), 'utf-8');
    // Substitute placeholders in the system prompt
    system = system.replace('{brief}', brief);
    system = system.replace('{actionPlan}', JSON.stringify(actionPlan, null, 2));
    const prompt = `Please generate the code as requested in the system prompt.`;
    logger.info({ event: 'phase.codegen.prompt', prompt, system }, 'Prompt and system sent to LLM in codegen phase');
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
