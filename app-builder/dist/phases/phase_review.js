"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhaseReview = runPhaseReview;
const llmAdapter_1 = require("../llmAdapter");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'phase-review',
    level: process.env.LOG_LEVEL || 'info',
});
// Helper function to assemble prompts from partials
function assemblePrompt(partials) {
    return partials.map(partial => fs_1.default.readFileSync(path_1.default.resolve(__dirname, '../prompts/partials', partial), 'utf-8')).join('\n\n');
}
async function runPhaseReview(files, schema) {
    const partials = [
        'instructions_review.md',
        'context_scaffold.md',
        'context_supabase_patterns.md',
        'context_forbidden_files.md',
        'rules_critical_schema.md',
        'rules_critical_output.md',
        'rules_general_quality.md',
    ];
    let system = assemblePrompt(partials);
    system = system.replace('{schema}', JSON.stringify(schema, null, 2));
    const results = [];
    for (const file of files) {
        const userPrompt = `You are the PRIA Code Reviewer. Your task is to analyze the following generated file for quality, correctness, and adherence to the system prompt's rules.

Review the following file for correctness, completeness, and adherence to the PRIA architecture.

File: ${file.filePath}

Content:
\`\`\`
${file.content}
\`\`\``;
        logger.info({ event: 'phase.review.prompt', filePath: file.filePath }, 'Sending file for review');
        const raw = await (0, llmAdapter_1.generateWithGemini)({ prompt: userPrompt, system });
        // Remove markdown code block wrappers if present
        const cleanedRaw = raw.replace(/^\`\`\`(json)?[\r\n]+|\`\`\`$/gim, '').trim();
        try {
            const parsed = JSON.parse(cleanedRaw);
            results.push({ filePath: file.filePath, pass: !!parsed.pass, feedback: parsed.feedback || '' });
            logger.info({ event: 'phase.review.result', filePath: file.filePath, pass: parsed.pass }, 'File review completed.');
        }
        catch {
            const feedback = 'Review LLM output was not valid JSON: ' + cleanedRaw;
            results.push({ filePath: file.filePath, pass: false, feedback });
            logger.error({ event: 'phase.review.invalid_json', filePath: file.filePath, json: cleanedRaw }, feedback);
        }
    }
    return results;
}
