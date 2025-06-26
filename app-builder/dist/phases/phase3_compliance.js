"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase3Compliance = runPhase3Compliance;
exports.reviewGeneratedFile = reviewGeneratedFile;
// All prompts in this file must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.
const llmAdapter_1 = require("../llmAdapter");
const validationChecklist = [
    '1. RLS/TENANCY VIOLATION: Does any generated Supabase query or Server Action FAIL to filter by a user or tenant identifier (e.g., missing `.eq(\'workspace_id\', ...)` or `.eq(\'user_id\', ...)` where appropriate)? All data access must be scoped to the authenticated user or their workspace.',
    '2. HARDCODED SECRET VIOLATION: Are there any hardcoded secrets such as API keys, passwords, or JWT secrets in the code? All secrets must be accessed via environment variables (`process.env`).',
    '3. PII LEAKAGE VIOLATION: Is any Personally Identifiable Information (e.g., email, full name) being logged or rendered without appropriate masking or justification?',
    '4. INSECURE DIRECT OBJECT REFERENCE: Does the code access resources using an ID from the client (e.g., URL parameter) without validating that the current user has permission to access that specific resource?'
];
async function runPhase3Compliance({ codeFiles, schemaDDL }) {
    const system = `You are the PRIA Compliance Officer, an automated security and compliance scanner. Your task is to perform a strict review of the provided application artifacts against the provided checklist.\n\nAll prompts must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.\n\n**CRITICAL RULES:**\n1. Respond ONLY with a single, valid JSON object of the form: { \"pass\": true/false, \"violations\": [ ... ] }\n2. Do NOT include any explanation, markdown, or extra text.\n3. If there are no violations, return an empty array for violations.\n4. If you cannot comply, return { \"pass\": false, \"violations\": [\"Output format error\"] }.`;
    const prompt = JSON.stringify({
        artifacts: {
            code: codeFiles,
            schema_ddl: schemaDDL
        },
        validationChecklist
    }, null, 2) + '\n\n(See prompt_strategy.md for full rules.)';
    const response = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
    console.log('[Phase3Compliance] Raw LLM output:', response);
    let raw;
    // Extract text from Gemini response if present
    if (response &&
        typeof response === 'object' &&
        'parts' in response &&
        Array.isArray(response.parts) &&
        response.parts[0]?.text) {
        raw = response.parts[0].text;
    }
    else if (typeof response === 'string') {
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
    let result = { pass: false, violations: [] };
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.pass === 'boolean') {
            result.pass = parsed.pass;
        }
        else if (typeof parsed.status === 'string') {
            result.pass = parsed.status.toLowerCase() === 'pass';
        }
        else if (typeof parsed.fail === 'boolean') {
            result.pass = !parsed.fail;
        }
        if (Array.isArray(parsed.violations)) {
            result.violations = parsed.violations;
        }
        else if (Array.isArray(parsed.errors)) {
            result.violations = parsed.errors;
        }
    }
    catch {
        if (typeof raw === 'string' && typeof raw.match === 'function') {
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    if (typeof parsed.pass === 'boolean') {
                        result.pass = parsed.pass;
                    }
                    else if (typeof parsed.status === 'string') {
                        result.pass = parsed.status.toLowerCase() === 'pass';
                    }
                    else if (typeof parsed.fail === 'boolean') {
                        result.pass = !parsed.fail;
                    }
                    if (Array.isArray(parsed.violations)) {
                        result.violations = parsed.violations;
                    }
                    else if (Array.isArray(parsed.errors)) {
                        result.violations = parsed.errors;
                    }
                }
                catch (e2) {
                    console.error('Phase 3 LLM output (extracted) is not valid JSON:', match[0], 'Original raw:', raw, 'Type:', typeof response);
                    throw new Error('Phase 3 LLM output is not valid JSON (after extraction). Raw output: ' + raw);
                }
            }
            else {
                console.error('Phase 3 LLM output is not valid JSON:', raw, 'Type:', typeof response);
                throw new Error('Phase 3 LLM output is not valid JSON. Raw output: ' + raw);
            }
        }
        else {
            console.error('Phase 3 LLM output is not a string and has no .match:', raw, 'Type:', typeof response);
            throw new Error('Phase 3 LLM output is not a string and has no .match. Raw output: ' + raw);
        }
    }
    return result;
}
// Add: Review function for generated files
async function reviewGeneratedFile({ filePath, content }) {
    const system = `You are a senior Next.js reviewer. Your job is to review a single generated file for completeness, correctness, and adherence to the following rules:\n\n1. The file must be fully complete and production-ready for the App Router (Next.js 15+).\n2. There must be NO explanations, alternatives, or optional code blocks.\n3. The file must not be missing any required code.\n4. The file must not include any markdown, comments, or text outside the code.\n\nRespond ONLY with a single JSON object: { \"pass\": true/false, \"feedback\": \"...\" }\n\nAll prompts must comply with the Unified System Prompt & Operational Rules in prompt_strategy.md.`;
    const prompt = `Review the following file for correctness and completeness.\n\nFile: ${filePath}\n\nContent:\n\n${content}\n\n(See prompt_strategy.md for full rules.)`;
    const response = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
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
        return { pass: !!parsed.pass, feedback: parsed.feedback || '' };
    }
    catch {
        return { pass: false, feedback: 'Review LLM output was not valid JSON: ' + raw };
    }
}
