"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({
    name: 'conversation-manager',
    level: process.env.LOG_LEVEL || 'info',
});
class ConversationManager {
    claudeClient;
    contexts = new Map();
    constructor(claudeClient) {
        this.claudeClient = claudeClient;
    }
    /**
     * Start or continue a conversation for app composition
     * This is the main entry point that handles the conversational flow
     */
    async processAppCompose(conversationId, userInput, appSpec, sessionId) {
        logger.info({ event: 'conversation.process.start', conversationId, userInput }, 'Processing app compose conversation');
        // Get or create conversation context
        let context = this.contexts.get(conversationId);
        if (!context) {
            context = {
                conversationId,
                sessionId,
                userInput,
                appSpec,
                currentStage: 'understanding',
                conversationHistory: [],
                complianceChecks: [],
                totalCost: 0,
            };
            this.contexts.set(conversationId, context);
        }
        else {
            // Update context with new input
            context.userInput = userInput;
            if (appSpec)
                context.appSpec = appSpec;
            if (sessionId)
                context.sessionId = sessionId;
        }
        // Add user input to conversation history
        context.conversationHistory.push({ role: 'user', content: userInput });
        try {
            // Process conversation with adaptive flow
            return await this.handleConversationalFlow(context);
        }
        catch (error) {
            logger.error({ event: 'conversation.process.error', conversationId, error: error.message }, 'Error processing conversation');
            return {
                success: false,
                context,
                error: error.message,
            };
        }
    }
    /**
     * Handle conversational flow - adaptive and non-deterministic
     * Claude decides what to do next based on context and PRIA guidelines
     */
    async handleConversationalFlow(context) {
        logger.info({ event: 'conversation.flow.start', stage: context.currentStage }, 'Starting conversational flow');
        // Build adaptive system prompt based on current context
        const systemPrompt = this.buildAdaptiveSystemPrompt(context);
        // Build conversation prompt with full context
        const conversationPrompt = this.buildConversationPrompt(context);
        // Get Claude's response
        const response = await this.claudeClient.query(conversationPrompt, context.sessionId);
        // Add assistant response to history
        context.conversationHistory.push({ role: 'assistant', content: response.content });
        // Analyze response and determine next steps
        const analysis = await this.analyzeConversationResponse(response, context);
        // Update context based on analysis
        context.currentStage = analysis.nextStage;
        context.requirements = analysis.requirements || context.requirements;
        context.technicalDecisions = analysis.technicalDecisions || context.technicalDecisions;
        context.generatedFiles = analysis.files || context.generatedFiles;
        context.complianceChecks = analysis.complianceChecks || context.complianceChecks;
        context.totalCost += response.cost || 0;
        return {
            success: true,
            context,
            response: response.content,
            files: analysis.files,
            needsUserInput: analysis.needsUserInput,
            progressUpdate: analysis.progressUpdate,
        };
    }
    /**
     * Build adaptive system prompt that provides PRIA guidelines contextually
     * Rather than rigid phases, we provide architectural guidance that Claude can use flexibly
     */
    buildAdaptiveSystemPrompt(context) {
        const basePrompt = `You are a senior full-stack developer and architect working on the PRIA platform. You're helping a user build a Next.js application using TypeScript, Tailwind CSS, and Supabase.

## Your Role & Approach
- You are conversational and adaptive - no rigid phases or scripts
- You guide the user through understanding → planning → building → reviewing as needed
- You can jump between activities based on what makes sense in the conversation
- You enforce PRIA architectural guidelines throughout the conversation
- You use your code editing tools to implement solutions when appropriate

## PRIA Architecture Guidelines (ALWAYS FOLLOW)
${this.getPRIAArchitectureGuidelines()}

## Current Context
- Stage: ${context.currentStage}
- Conversation History: ${context.conversationHistory.length} messages
- Requirements Gathered: ${context.requirements ? 'Yes' : 'No'}
- Technical Decisions Made: ${context.technicalDecisions ? 'Yes' : 'No'}
- Files Generated: ${context.generatedFiles?.length || 0}

## Available Tools
You have access to Read, Write, Edit, and Bash tools. Use them naturally in the conversation when:
- Reading existing code to understand structure
- Writing new files when implementing features
- Editing existing files to make improvements
- Running commands to test or build

## Conversation Guidelines
1. Be helpful and conversational - explain your thinking
2. Ask clarifying questions when needed
3. Propose solutions and implementations
4. Always follow PRIA security and architectural rules
5. Generate production-ready code (no placeholders or TODOs)
6. Use the conversation history to maintain context
7. Provide progress updates when working on complex tasks

## Security & Compliance (CRITICAL)
${this.getSecurityGuidelines()}

## Quality Standards
${this.getQualityGuidelines()}`;
        return basePrompt;
    }
    /**
     * Build conversation prompt with full context
     */
    buildConversationPrompt(context) {
        let prompt = `## User Request
${context.userInput}

## Conversation Context`;
        if (context.appSpec) {
            prompt += `\n### App Specification
${JSON.stringify(context.appSpec, null, 2)}`;
        }
        if (context.requirements) {
            prompt += `\n### Requirements Gathered
${JSON.stringify(context.requirements, null, 2)}`;
        }
        if (context.technicalDecisions) {
            prompt += `\n### Technical Decisions Made
${JSON.stringify(context.technicalDecisions, null, 2)}`;
        }
        if (context.generatedFiles && context.generatedFiles.length > 0) {
            prompt += `\n### Files Generated
${context.generatedFiles.map(f => `- ${f.filePath}`).join('\n')}`;
        }
        if (context.complianceChecks && context.complianceChecks.length > 0) {
            prompt += `\n### Compliance Checks Completed
${context.complianceChecks.join('\n')}`;
        }
        prompt += `\n\n## Instructions
Based on the conversation context and user request, decide what to do next. You might:
- Ask clarifying questions about requirements
- Propose a technical approach
- Start implementing code using your tools
- Review and improve existing code
- Explain architectural decisions

Remember to follow PRIA guidelines and maintain the conversational flow. Use your tools when appropriate to read, write, or edit code.`;
        return prompt;
    }
    /**
     * Analyze Claude's response to determine next steps and extract information
     */
    async analyzeConversationResponse(response, context) {
        // Analyze response content and tool usage to determine what happened
        const analysis = {
            nextStage: context.currentStage,
            needsUserInput: true,
            files: [],
            complianceChecks: context.complianceChecks || [],
        };
        // Check if Claude used file tools (indicating code generation)
        if (response.toolUse && response.toolUse.length > 0) {
            const fileOperations = response.toolUse.filter(tool => ['write_file', 'edit_file', 'read_file'].includes(tool.name));
            if (fileOperations.length > 0) {
                analysis.nextStage = 'building';
                analysis.files = this.extractFilesFromToolUse(response.toolUse);
                analysis.progressUpdate = {
                    stage: 'codegen',
                    progress: 60,
                    message: 'Generating code files',
                };
            }
        }
        // Check if response contains questions (indicating need for user input)
        const hasQuestions = response.content.includes('?') ||
            response.content.toLowerCase().includes('clarify') ||
            response.content.toLowerCase().includes('would you like');
        if (hasQuestions) {
            analysis.needsUserInput = true;
            analysis.nextStage = 'understanding';
        }
        // Check if response indicates completion
        if (response.content.toLowerCase().includes('complete') ||
            response.content.toLowerCase().includes('finished') ||
            response.content.toLowerCase().includes('ready to deploy')) {
            analysis.nextStage = 'completed';
            analysis.needsUserInput = false;
            analysis.progressUpdate = {
                stage: 'completed',
                progress: 100,
                message: 'Application ready',
            };
        }
        // Extract requirements if mentioned
        if (response.content.toLowerCase().includes('requirement') ||
            response.content.toLowerCase().includes('feature')) {
            analysis.requirements = this.extractRequirementsFromResponse(response.content);
        }
        // Extract technical decisions if mentioned
        if (response.content.toLowerCase().includes('architecture') ||
            response.content.toLowerCase().includes('approach') ||
            response.content.toLowerCase().includes('implement')) {
            analysis.technicalDecisions = this.extractTechnicalDecisionsFromResponse(response.content);
        }
        return analysis;
    }
    /**
     * Extract files from Claude's tool usage
     */
    extractFilesFromToolUse(toolUse) {
        const files = [];
        toolUse.forEach(tool => {
            if (tool.name === 'write_file' && tool.parameters) {
                files.push({
                    filePath: tool.parameters.path,
                    content: tool.parameters.content,
                    operation: 'create',
                });
            }
            else if (tool.name === 'edit_file' && tool.parameters) {
                files.push({
                    filePath: tool.parameters.path,
                    content: tool.parameters.new_content,
                    operation: 'edit',
                });
            }
        });
        return files;
    }
    /**
     * Extract requirements from response text
     */
    extractRequirementsFromResponse(content) {
        // Simple extraction - in practice, you might use more sophisticated parsing
        const requirements = {
            timestamp: new Date().toISOString(),
            extracted: content.substring(0, 500), // First 500 chars for context
        };
        return requirements;
    }
    /**
     * Extract technical decisions from response text
     */
    extractTechnicalDecisionsFromResponse(content) {
        const decisions = {
            timestamp: new Date().toISOString(),
            extracted: content.substring(0, 500), // First 500 chars for context
        };
        return decisions;
    }
    /**
     * Get PRIA architecture guidelines
     */
    getPRIAArchitectureGuidelines() {
        return `### Technology Stack (FIXED)
- Next.js 15 with App Router
- TypeScript for all code
- Tailwind CSS for styling
- Supabase for backend (database, auth, storage)
- shadcn/ui for UI components

### File Structure Rules
- Use \`app/\` directory for pages and API routes
- Place components in \`components/\` directory
- Use \`lib/\` for utilities and configurations
- API routes go in \`app/api/\` as \`route.ts\` files
- All UI files must be \`.tsx\`, backend files \`.ts\`

### Import Rules
- Use \`@/\` alias for project root imports
- Never use \`@/src/\` (forbidden)
- Import from \`@/lib/supabase/client\` for client-side
- Import from \`@/lib/supabase/server\` for server-side

### Database & Auth Patterns
- Always use Supabase client patterns from context
- Implement Row Level Security (RLS) for all tables
- Filter by \`workspace_id\` for tenant isolation
- Use \`supabase.auth.getUser()\` for authentication
- Create user records in public.users table after signup`;
    }
    /**
     * Get security guidelines
     */
    getSecurityGuidelines() {
        return `### Security Rules (CRITICAL - NEVER VIOLATE)
1. **Tenant Isolation**: All database queries MUST filter by workspace_id
2. **User Registration**: After auth.signUp(), create record in public.users table
3. **No Hardcoded Secrets**: Use environment variables only
4. **No PII Logging**: Never log sensitive user information
5. **Access Control**: Validate user permissions before data access
6. **RLS Enforcement**: Every table must have Row Level Security enabled`;
    }
    /**
     * Get quality guidelines
     */
    getQualityGuidelines() {
        return `### Code Quality Rules
1. **Production Ready**: No placeholders, TODOs, or mock data
2. **No Console Logs**: Remove all debugging statements
3. **Complete Implementations**: All functions must be fully implemented
4. **Proper Error Handling**: Use try/catch appropriately
5. **TypeScript**: Proper typing for all variables and functions
6. **Comments**: TSDoc/JSDoc for exported functions only
7. **Responsive Design**: All UI must work on mobile and desktop`;
    }
    /**
     * Get conversation context
     */
    getContext(conversationId) {
        return this.contexts.get(conversationId);
    }
    /**
     * Clean up conversation context
     */
    cleanup(conversationId) {
        this.contexts.delete(conversationId);
    }
}
exports.ConversationManager = ConversationManager;
//# sourceMappingURL=conversationManager.js.map