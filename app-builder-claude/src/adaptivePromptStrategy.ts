import pino from 'pino';
import { ComplianceMonitor, ComplianceReport } from './complianceMonitor';

const logger = pino({
  name: 'adaptive-prompt-strategy',
  level: process.env.LOG_LEVEL || 'info',
});

export interface PromptContext {
  stage: 'understanding' | 'building' | 'reviewing' | 'completed';
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  requirements?: any;
  technicalDecisions?: any;
  generatedFiles?: any[];
  complianceReport?: ComplianceReport;
  userInput: string;
  appSpec?: any;
}

export interface AdaptivePrompt {
  systemPrompt: string;
  userPrompt: string;
  context: PromptContext;
  guidelines: string[];
  complianceReminders: string[];
}

export class AdaptivePromptStrategy {
  private complianceMonitor: ComplianceMonitor;

  constructor() {
    this.complianceMonitor = new ComplianceMonitor();
  }

  /**
   * Generate adaptive prompt based on conversation context
   * This is the main method that creates contextual prompts for Claude
   */
  async generatePrompt(context: PromptContext): Promise<AdaptivePrompt> {
    logger.info({ event: 'prompt.generate.start', stage: context.stage }, 'Generating adaptive prompt');

    // Build system prompt with contextual guidelines
    const systemPrompt = this.buildSystemPrompt(context);
    
    // Build user prompt with conversation context
    const userPrompt = this.buildUserPrompt(context);
    
    // Get relevant guidelines based on context
    const guidelines = this.getRelevantGuidelines(context);
    
    // Get compliance reminders based on current state
    const complianceReminders = await this.getComplianceReminders(context);

    const prompt: AdaptivePrompt = {
      systemPrompt,
      userPrompt,
      context,
      guidelines,
      complianceReminders,
    };

    logger.info({ event: 'prompt.generate.complete', stage: context.stage }, 'Adaptive prompt generated');
    return prompt;
  }

  /**
   * Build system prompt with contextual PRIA guidelines
   */
  private buildSystemPrompt(context: PromptContext): string {
    const basePrompt = `You are a senior full-stack developer and architect working on the PRIA platform. You're helping a user build a Next.js application using TypeScript, Tailwind CSS, and Supabase.

## Your Conversational Approach
- Be natural and conversational - no rigid scripts or phases
- Adapt your approach based on what the user needs right now
- Ask clarifying questions when requirements are unclear
- Propose solutions and explain your reasoning
- Use your code editing tools naturally during the conversation
- Maintain context from previous messages in the conversation

## Current Context
- **Stage**: ${context.stage}
- **Conversation Length**: ${context.conversationHistory.length} messages
- **Requirements Status**: ${context.requirements ? 'Gathered' : 'In Progress'}
- **Technical Decisions**: ${context.technicalDecisions ? 'Made' : 'Pending'}
- **Files Generated**: ${context.generatedFiles?.length || 0}
- **Compliance Status**: ${context.complianceReport?.overall || 'Not Checked'}

## PRIA Architecture (ALWAYS FOLLOW)
${this.getPRIAArchitecture()}

## Security Guidelines (CRITICAL)
${this.getSecurityGuidelines()}

## Quality Standards
${this.getQualityStandards()}

## Contextual Guidance
${this.getContextualGuidance(context)}

## Available Tools
You have access to Read, Write, Edit, and Bash tools. Use them naturally when:
- Reading existing code to understand structure
- Writing new files during implementation
- Editing files to make improvements
- Running commands to test functionality

Remember: You're having a conversation, not following a script. Be helpful, adaptive, and always maintain PRIA compliance.`;

    return basePrompt;
  }

  /**
   * Build user prompt with conversation context
   */
  private buildUserPrompt(context: PromptContext): string {
    let prompt = `## Current User Request
${context.userInput}

## Conversation Context`;

    // Add app specification if available
    if (context.appSpec) {
      prompt += `\n### Application Specification
${JSON.stringify(context.appSpec, null, 2)}`;
    }

    // Add conversation history summary
    if (context.conversationHistory.length > 0) {
      prompt += `\n### Recent Conversation
${this.summarizeConversationHistory(context.conversationHistory)}`;
    }

    // Add requirements if gathered
    if (context.requirements) {
      prompt += `\n### Requirements Gathered
${JSON.stringify(context.requirements, null, 2)}`;
    }

    // Add technical decisions if made
    if (context.technicalDecisions) {
      prompt += `\n### Technical Decisions Made
${JSON.stringify(context.technicalDecisions, null, 2)}`;
    }

    // Add file status if files exist
    if (context.generatedFiles && context.generatedFiles.length > 0) {
      prompt += `\n### Current Files
${context.generatedFiles.map(f => `- ${f.filePath} (${f.operation || 'created'})`).join('\n')}`;
    }

    // Add compliance status if available
    if (context.complianceReport) {
      prompt += `\n### Compliance Status
- Overall: ${context.complianceReport.overall}
- Passed: ${context.complianceReport.summary.passed}/${context.complianceReport.summary.total}
- Critical Issues: ${context.complianceReport.summary.critical}`;

      // Add specific failures if any
      const failures = context.complianceReport.results.filter(r => !r.passed);
      if (failures.length > 0) {
        prompt += `\n### Compliance Issues to Address
${failures.map(f => `- ${f.check.name}: ${f.message}`).join('\n')}`;
      }
    }

    prompt += `\n\n## Instructions
Based on the conversation context and user request, decide what to do next. You might:
- Ask clarifying questions about requirements
- Propose a technical approach or architecture
- Start implementing code using your tools
- Review and improve existing code
- Explain your decisions and reasoning

Remember to maintain PRIA compliance throughout and use your tools when appropriate.`;

    return prompt;
  }

  /**
   * Get PRIA architecture guidelines
   */
  private getPRIAArchitecture(): string {
    return `### Fixed Technology Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript for all code
- **Styling**: Tailwind CSS
- **Backend**: Supabase (database, auth, storage)
- **UI Components**: shadcn/ui
- **Testing**: Jest and Playwright

### File Structure Rules
- Pages: \`app/\` directory with \`page.tsx\` files
- API Routes: \`app/api/\` directory with \`route.ts\` files
- Components: \`components/\` directory with \`.tsx\` files
- Utilities: \`lib/\` directory with \`.ts\` files
- Supabase: \`lib/supabase/\` with \`client.ts\` and \`server.ts\`

### Import Rules
- Use \`@/\` alias for all project imports
- Never use \`@/src/\` (forbidden)
- Client-side Supabase: \`@/lib/supabase/client\`
- Server-side Supabase: \`@/lib/supabase/server\`

### Database Patterns
- Always use Row Level Security (RLS)
- Filter all queries by \`workspace_id\` for tenant isolation
- Use \`supabase.auth.getUser()\` for authentication
- Create user records in \`public.users\` after signup`;
  }

  /**
   * Get security guidelines
   */
  private getSecurityGuidelines(): string {
    return `### Critical Security Rules (NEVER VIOLATE)
1. **Tenant Isolation**: Every database query MUST filter by \`workspace_id\`
2. **User Registration**: After \`auth.signUp()\`, create record in \`public.users\` table
3. **No Hardcoded Secrets**: All secrets must use \`process.env.VARIABLE_NAME\`
4. **No PII Logging**: Never log emails, passwords, or sensitive data
5. **Access Control**: Validate user permissions before data access
6. **RLS Enforcement**: All tables must have Row Level Security enabled
7. **Input Validation**: Validate all user inputs before processing
8. **HTTPS Only**: All external communications must use HTTPS`;
  }

  /**
   * Get quality standards
   */
  private getQualityStandards(): string {
    return `### Code Quality Requirements
1. **Production Ready**: No placeholders, TODOs, or mock data
2. **No Console Logs**: Remove all debugging console statements
3. **Complete Implementation**: All functions must be fully implemented
4. **Error Handling**: Use appropriate try/catch patterns
5. **TypeScript**: Proper typing for all variables and functions
6. **Responsive Design**: All UI must work on mobile and desktop
7. **Performance**: Optimize for loading speed and user experience
8. **Accessibility**: Follow WCAG guidelines for accessibility`;
  }

  /**
   * Get contextual guidance based on current stage
   */
  private getContextualGuidance(context: PromptContext): string {
    switch (context.stage) {
      case 'understanding':
        return `### Understanding Phase Guidance
- Focus on gathering complete requirements
- Ask clarifying questions about features and functionality
- Understand the user's business needs and constraints
- Propose features that align with common patterns
- Don't start coding until requirements are clear
- Suggest database schema and user flows when appropriate`;

      case 'building':
        return `### Building Phase Guidance
- Use your tools to read, write, and edit files
- Follow the technical decisions made earlier
- Implement features incrementally and test as you go
- Ensure all code follows PRIA guidelines
- Generate complete, production-ready code
- Run compliance checks on generated code`;

      case 'reviewing':
        return `### Reviewing Phase Guidance
- Review generated code for compliance and quality
- Check for security vulnerabilities and architectural issues
- Test functionality and fix any issues found
- Optimize for performance and user experience
- Ensure all requirements are met
- Prepare for deployment`;

      case 'completed':
        return `### Completion Phase Guidance
- Summarize what was built and how it works
- Provide deployment instructions if needed
- Suggest next steps or improvements
- Ensure all documentation is complete
- Confirm all requirements have been met`;

      default:
        return '';
    }
  }

  /**
   * Get relevant guidelines based on context
   */
  private getRelevantGuidelines(context: PromptContext): string[] {
    const guidelines: string[] = [];

    // Always include core guidelines
    guidelines.push('Follow PRIA architecture patterns');
    guidelines.push('Ensure security compliance');
    guidelines.push('Generate production-ready code');

    // Add stage-specific guidelines
    switch (context.stage) {
      case 'understanding':
        guidelines.push('Gather complete requirements before coding');
        guidelines.push('Ask clarifying questions when needed');
        break;
      case 'building':
        guidelines.push('Use tools to implement features');
        guidelines.push('Test code as you build');
        break;
      case 'reviewing':
        guidelines.push('Check compliance and quality');
        guidelines.push('Fix issues found during review');
        break;
    }

    // Add contextual guidelines based on what's been done
    if (context.generatedFiles && context.generatedFiles.length > 0) {
      guidelines.push('Review existing files before making changes');
      guidelines.push('Maintain consistency across files');
    }

    if (context.complianceReport && context.complianceReport.overall !== 'pass') {
      guidelines.push('Address compliance issues before proceeding');
      guidelines.push('Focus on critical security violations first');
    }

    return guidelines;
  }

  /**
   * Get compliance reminders based on current state
   */
  private async getComplianceReminders(context: PromptContext): Promise<string[]> {
    const reminders: string[] = [];

    // If we have files, check compliance
    if (context.generatedFiles && context.generatedFiles.length > 0) {
      const complianceReport = await this.complianceMonitor.checkConversationCompliance(
        context.conversationHistory.map(h => h.content).join('\n'),
        context.generatedFiles,
        context
      );

      // Add reminders for failed checks
      complianceReport.results.forEach(result => {
        if (!result.passed && result.check.severity === 'critical') {
          reminders.push(`CRITICAL: ${result.check.name} - ${result.message}`);
        }
      });
    }

    // Add general reminders based on stage
    switch (context.stage) {
      case 'building':
        reminders.push('Remember to filter database queries by workspace_id');
        reminders.push('Use environment variables for all secrets');
        break;
      case 'reviewing':
        reminders.push('Check for console.log statements');
        reminders.push('Ensure all functions are fully implemented');
        break;
    }

    return reminders;
  }

  /**
   * Summarize conversation history for context
   */
  private summarizeConversationHistory(history: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    // Take last 5 messages for context
    const recentHistory = history.slice(-5);
    
    return recentHistory.map(msg => {
      const truncated = msg.content.length > 200 
        ? msg.content.substring(0, 200) + '...'
        : msg.content;
      return `${msg.role}: ${truncated}`;
    }).join('\n');
  }

  /**
   * Get stage-specific tools guidance
   */
  getToolsGuidance(stage: PromptContext['stage']): string {
    switch (stage) {
      case 'understanding':
        return 'Use Read tool to understand existing code structure if needed';
      case 'building':
        return 'Use Write tool for new files, Edit tool for modifications, Bash tool for testing';
      case 'reviewing':
        return 'Use Read tool to review generated code, Edit tool to fix issues';
      case 'completed':
        return 'Use Read tool to verify final state, Bash tool to run final tests';
      default:
        return 'Use tools as needed based on the conversation context';
    }
  }

  /**
   * Check if compliance monitoring is needed
   */
  shouldCheckCompliance(context: PromptContext): boolean {
    return context.stage === 'building' || 
           context.stage === 'reviewing' || 
           (context.generatedFiles && context.generatedFiles.length > 0);
  }

  /**
   * Get compliance monitor instance
   */
  getComplianceMonitor(): ComplianceMonitor {
    return this.complianceMonitor;
  }
} 