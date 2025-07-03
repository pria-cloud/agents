"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase0ProductDiscovery = runPhase0ProductDiscovery;
const llmAdapter_1 = require("../llmAdapter");
const zod_1 = require("zod");
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = (0, pino_1.default)({
    name: 'phase0-discovery',
    level: process.env.LOG_LEVEL || 'info',
});
// Zod schema for the AppSpec
const AppSpecSchema = zod_1.z.object({
    // description remains required as a minimal field
    description: zod_1.z.string(),
    // The following fields are optional during the iterative discovery process
    spec_version: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    schema: zod_1.z.object({}).passthrough().optional(),
    userActions: zod_1.z.array(zod_1.z.object({}).passthrough()).optional(),
    isConfirmed: zod_1.z.boolean().optional().nullable(),
});
// Zod schema for the LLM's response
const DiscoveryResponseSchema = zod_1.z.object({
    updatedAppSpec: AppSpecSchema,
    responseToUser: zod_1.z.string(),
    isComplete: zod_1.z.boolean(),
});
// JSON schema for Gemini (must not contain empty `properties`)
const GeminiSchema = {
    type: 'object',
    properties: {
        updatedAppSpec: {
            type: 'object',
            // allow any additional keys inside updatedAppSpec
            additionalProperties: true,
            properties: {
                spec_version: { type: 'string' },
                description: { type: 'string' },
                domain: { type: 'string' },
                // schema and userActions are intentionally omitted to avoid empty properties errors
                isConfirmed: { type: 'boolean', nullable: true },
            },
            required: ['spec_version', 'description', 'domain'],
        },
        responseToUser: { type: 'string' },
        isComplete: { type: 'boolean' },
    },
    required: ['updatedAppSpec', 'responseToUser', 'isComplete'],
};
// Helper function to assemble prompts from partials
function assemblePrompt(partials) {
    return partials.map(partial => fs_1.default.readFileSync(path_1.default.resolve(__dirname, '../prompts/partials', partial), 'utf-8')).join('\\n\\n');
}
/**
 * Phase 0: Product Discovery
 * Iteratively builds an application specification through a conversation with the user.
 */
async function runPhase0ProductDiscovery(userInput, currentSpec, conversationId) {
    const partials = [
        'instructions_discovery.md',
        'rules_critical_output.md',
    ];
    const system = assemblePrompt(partials);
    const prompt = `Here is the current state of our conversation. Please continue the product discovery based on my latest input.\n\nUserInput: "${userInput}"\n\nCurrentSpec: ${JSON.stringify(currentSpec, null, 2)}`;
    logger.info({ event: 'phase.discovery.prompt', conversationId }, 'Prompt sent to LLM for product discovery');
    const raw = await (0, llmAdapter_1.generateWithGemini)({ prompt, system });
    logger.info({ event: 'phase.discovery.raw_output', conversationId, raw }, 'Raw LLM output from discovery phase');
    try {
        // --- Robust JSON extraction -----------------------------------------
        // 1) Strip ```json fences if present
        let jsonString = null;
        const fenceMatch = raw.match(/```json[\s\r\n]*([\s\S]*?)```/i);
        if (fenceMatch) {
            jsonString = fenceMatch[1];
        }
        else {
            // 2) Fallback: slice from first '{' to last '}'
            const firstBrace = raw.indexOf('{');
            const lastBrace = raw.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonString = raw.slice(firstBrace, lastBrace + 1);
            }
        }
        if (!jsonString)
            throw new Error('LLM output did not contain JSON');
        const parsed = JSON.parse(jsonString);
        // Debug log of the parsed structure before validation
        logger.debug({ parsed }, 'Parsed JSON from discovery');
        const validationResult = DiscoveryResponseSchema.safeParse(parsed);
        if (!validationResult.success) {
            logger.error({ event: 'phase.discovery.validation_error', errors: validationResult.error.issues, data: parsed }, 'LLM response failed validation');
            throw new Error('LLM response validation failed.');
        }
        return validationResult.data;
    }
    catch (error) {
        logger.error({ event: 'phase.discovery.json_parse_error', raw, error }, 'Failed to parse JSON from LLM output in discovery phase');
        return {
            updatedAppSpec: currentSpec,
            responseToUser: "I'm sorry, I encountered an issue processing that. Could you please try rephrasing your request?",
            isComplete: false,
        };
    }
}
