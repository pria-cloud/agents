import { trace } from '@opentelemetry/api';
import fs from 'fs';
import path from 'path';

const tracer = trace.getTracer('app-builder');

/**
 * Defines the contract for an adapter that can interact with a Large Language Model,
 * specifically for retrieving structured JSON responses.
 */
export interface LlmAdapter {
  getJSONResponse(promptTemplate: string, input: any): Promise<any>;
}

// Define the structure of the application specification
export interface AppSpec {
  spec_version: string;
  description: string;
  domain: string;
  schema: Record<string, any>;
  userActions: any[];
}

// Define the structure of the LLM's response
export interface DiscoveryResponse {
  updatedAppSpec: AppSpec;
  responseToUser: string;
  isComplete: boolean;
}

/**
 * Runs the product discovery phase, interacting with the LLM to collaboratively
 * build an application specification with the user.
 *
 * @param userInput The latest input from the user.
 * @param currentSpec The current state of the application specification.
 * @param llmAdapter The adapter for interacting with the Large Language Model.
 * @returns A promise that resolves to the LLM's structured response.
 */
export async function runPhase0ProductDiscovery(
  userInput: string,
  currentSpec: AppSpec | null,
  llmAdapter: LlmAdapter
): Promise<DiscoveryResponse> {
  return await tracer.startActiveSpan(
    'phase0_discovery.run',
    async (span): Promise<DiscoveryResponse> => {
      const promptTemplate = fs.readFileSync(
        path.resolve(__dirname, 'prompts/phase0_discovery_prompt.md'),
        'utf-8'
      );

      const initialSpec: AppSpec = {
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
      if (
        !responseJson.updatedAppSpec ||
        typeof responseJson.responseToUser !== 'string' ||
        typeof responseJson.isComplete !== 'boolean'
      ) {
        throw new Error('LLM response is missing required fields for product discovery.');
      }

      const discoveryResponse: DiscoveryResponse = {
        updatedAppSpec: responseJson.updatedAppSpec,
        responseToUser: responseJson.responseToUser,
        isComplete: responseJson.isComplete,
      };

      span.end();
      return discoveryResponse;
    }
  );
} 