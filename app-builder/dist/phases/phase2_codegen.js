"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase2Codegen = runPhase2Codegen;
const llmAdapter_1 = require("../llmAdapter");
const zod_1 = require("zod");
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = (0, pino_1.default)({
    name: 'phase2-codegen',
    level: process.env.LOG_LEVEL || 'info',
});
const CodegenResponseSchema = zod_1.z.object({
    dependencies: zod_1.z.array(zod_1.z.string()),
    files: zod_1.z.array(zod_1.z.object({
        filePath: zod_1.z.string(),
        content: zod_1.z.string(),
    })),
});
// Helper function to assemble prompts from partials
function assemblePrompt(partials) {
    return partials.map(partial => fs_1.default.readFileSync(path_1.default.resolve(__dirname, '../prompts/partials', partial), 'utf-8')).join('\\n\\n');
}
async function runPhase2Codegen({ actionPlan, brief, dbSchema, failedReview, }) {
    let system;
    let prompt;
    if (failedReview) {
        // A file failed review, so we are in a correction loop.
        const partials = [
            'instructions_correction.md',
            'context_scaffold.md',
            'context_supabase_patterns.md',
            'rules_critical_schema.md',
            'rules_critical_output.md',
        ];
        system = assemblePrompt(partials);
        system = system.replace('{brief}', brief);
        system = system.replace('{dbSchema}', dbSchema || 'No schema provided.');
        system = system.replace('{filePath}', failedReview.file.filePath);
        prompt = `## Feedback:\n${failedReview.feedback}\n\n## Original Code for ${failedReview.file.filePath}:\n\`\`\`\n${failedReview.file.content}\n\`\`\``;
        logger.info({ event: 'phase.codegen.correction_prompt', system }, 'Correction prompt sent to LLM');
    }
    else {
        // This is the initial code generation.
        const partials = [
            'instructions_codegen.md',
            'context_scaffold.md',
            'context_supabase_patterns.md',
            'context_forbidden_files.md',
            'rules_critical_schema.md',
            'rules_critical_output.md',
            'rules_general_quality.md',
        ];
        system = assemblePrompt(partials);
        let userPromptContent = `Brief: ${brief}\n\nAction Plan: ${JSON.stringify(actionPlan, null, 2)}`;
        if (dbSchema) {
            userPromptContent += `\n\nDB Schema: ${dbSchema}`;
        }
        prompt = `Please generate the code for the following request:\n\n${userPromptContent}`;
        logger.info({ event: 'phase.codegen.prompt', system }, 'Initial prompt and system sent to LLM in codegen phase');
    }
    // Call the LLM
    const raw = await (0, llmAdapter_1.generateWithGemini)({ prompt, system, responseSchema: CodegenResponseSchema });
    logger.info({ event: 'phase.codegen.raw_output', raw }, 'Raw LLM output from codegen phase');
    // The output should be a single JSON object
    try {
        const parsed = JSON.parse(raw);
        const validationResult = CodegenResponseSchema.safeParse(parsed);
        if (!validationResult.success) {
            logger.error({ event: 'phase.codegen.validation_error', errors: validationResult.error.issues, data: parsed }, 'LLM response failed validation');
            throw new Error('LLM response validation failed.');
        }
        const { files, dependencies } = validationResult.data;
        logger.info({ event: 'phase.codegen.parsed_files', files: files.map((f) => f.filePath), dependencies }, 'Parsed JSON from codegen phase');
        if (files.length === 0) {
            logger.warn({ event: 'phase.codegen.no_files', raw }, 'No files array found in codegen JSON output');
        }
        return { files, dependencies };
    }
    catch (error) {
        logger.error({ event: 'phase.codegen.json_parse_error', raw, error }, 'Failed to parse JSON from LLM output in codegen phase');
        // Return empty arrays to avoid breaking the flow
        return { files: [], dependencies: [] };
    }
}
