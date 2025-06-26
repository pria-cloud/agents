"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhaseReview = runPhaseReview;
const llmAdapter_1 = require("../llmAdapter");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function extractPromptsFromMarkdown(markdown) {
    const sysMatch = markdown.match(/## System Prompt\n```([\s\S]*?)```/);
    const userMatch = markdown.match(/## User Prompt Template\n```([\s\S]*?)```/);
    return {
        system: sysMatch ? sysMatch[1].trim() : '',
        user: userMatch ? userMatch[1].trim() : '',
    };
}
async function runPhaseReview(files, schema) {
    let promptMd = fs_1.default.readFileSync(path_1.default.resolve(__dirname, './prompts/phase_review_prompt.md'), 'utf-8');
    // Inject the schema into the prompt template
    promptMd = promptMd.replace('{schema}', JSON.stringify(schema, null, 2));
    const system = promptMd; // The entire markdown is now the system prompt
    const results = [];
    for (const file of files) {
        const userPrompt = `You are the PRIA Code Reviewer. Your task is to analyze the following generated file for quality, correctness, and adherence to the system prompt's rules.

Review the following file for correctness, completeness, and adherence to the PRIA architecture.

File: ${file.filePath}

Content:

${file.content}
`;
        const response = await (0, llmAdapter_1.generateWithGemini)({ prompt: userPrompt, system });
        let raw;
        if (typeof response === 'string') {
            raw = response;
        }
        else if (response && typeof response === 'object') {
            try {
                raw = JSON.stringify(response);
            }
            catch {
                raw = String(response);
            }
        }
        else {
            raw = String(response);
        }
        // Remove markdown code block wrappers if present
        raw = raw.replace(/^```json[\r\n]+|^```[\r\n]+|```$/gim, '').trim();
        try {
            const parsed = JSON.parse(raw);
            results.push({ filePath: file.filePath, pass: !!parsed.pass, feedback: parsed.feedback || '' });
        }
        catch {
            results.push({ filePath: file.filePath, pass: false, feedback: 'Review LLM output was not valid JSON: ' + raw });
        }
    }
    return results;
}
