"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase0ProductDiscovery = runPhase0ProductDiscovery;
const api_1 = require("@opentelemetry/api");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const tracer = api_1.trace.getTracer('app-builder');
/**
 * Runs the product discovery phase, interacting with the LLM to collaboratively
 * build an application specification with the user.
 *
 * @param userInput The latest input from the user.
 * @param currentSpec The current state of the application specification.
 * @param llmAdapter The adapter for interacting with the Large Language Model.
 * @returns A promise that resolves to the LLM's structured response.
 */
async function runPhase0ProductDiscovery(userInput, currentSpec, llmAdapter) {
    return await tracer.startActiveSpan('phase0_discovery.run', async (span) => {
        const promptTemplate = fs_1.default.readFileSync(path_1.default.resolve(__dirname, 'prompts/phase0_discovery_prompt.md'), 'utf-8');
        const initialSpec = {
            spec_version: '1.0',
            description: '',
            domain: '',
            schema: {},
            userActions: [],
        };
        const specToUpdate = currentSpec || initialSpec;
        // The prompt expects a JSON object with userInput and currentSpec
        const promptInput = {
            userInput,
            currentSpec: specToUpdate,
        };
        const responseJson = await llmAdapter.getJSONResponse(promptTemplate, promptInput);
        span.addEvent('phase0.discovery.llm.response_received');
        span.setAttribute('llm.response.json', JSON.stringify(responseJson));
        // It's crucial to validate the structure of the LLM's response
        if (!responseJson.updatedAppSpec ||
            typeof responseJson.responseToUser !== 'string' ||
            typeof responseJson.isComplete !== 'boolean') {
            throw new Error('LLM response is missing required fields for product discovery.');
        }
        const discoveryResponse = {
            updatedAppSpec: responseJson.updatedAppSpec,
            responseToUser: responseJson.responseToUser,
            isComplete: responseJson.isComplete,
        };
        span.end();
        return discoveryResponse;
    });
}
