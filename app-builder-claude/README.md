# App Builder Claude - Conversational Code Generation

A flexible, conversational app builder using Claude Code SDK that adapts to user needs while maintaining strict PRIA architectural compliance.

## Key Differences from Original App-Builder

### Original App-Builder (Deterministic)
- **Fixed Phases**: Discovery → Planning → Codegen → Review → Testing
- **Rigid Prompts**: Each phase has specific, structured prompts
- **JSON Schema Output**: Strict JSON format requirements
- **Linear Flow**: Must complete each phase before moving to next
- **Structured Responses**: Predefined response formats

### Claude Code SDK Agent (Adaptive)
- **Conversational Flow**: Natural dialogue that adapts to context
- **Flexible Stages**: Understanding → Building → Reviewing → Completed
- **Contextual Guidance**: PRIA rules provided as conversational context
- **Non-Linear Flow**: Can jump between activities based on conversation
- **Tool Integration**: Uses Claude's native Read/Write/Edit/Bash tools

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Adaptive Conversational Flow                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input → ConversationManager → AdaptivePromptStrategy      │
│       ↓              ↓                      ↓                   │
│  Context Update → Claude Code SDK → Contextual PRIA Guidelines  │
│       ↓              ↓                      ↓                   │
│  Tool Usage → File Operations → ComplianceMonitor               │
│       ↓              ↓                      ↓                   │
│  Progress Updates → A2A Integration → Supabase Realtime        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ConversationManager
- Maintains conversation context and history
- Manages adaptive flow between stages
- Handles tool usage and file operations
- Provides progress updates

### 2. AdaptivePromptStrategy
- Generates contextual prompts based on conversation state
- Provides PRIA guidelines as conversational context
- Adapts guidance based on current stage and progress
- Integrates compliance checking

### 3. ComplianceMonitor
- Real-time compliance checking during conversation
- Comprehensive security, architecture, and quality checks
- Provides contextual feedback and suggestions
- Ensures PRIA guidelines are followed

### 4. Claude Code SDK Integration
- Natural conversation with Claude
- Built-in tool usage (Read, Write, Edit, Bash)
- Session management for context continuity
- Cost tracking and optimization

## Adaptive Stages

### Understanding Stage
- **Purpose**: Gather requirements and clarify needs
- **Approach**: Conversational questioning and proposal
- **Tools**: Read (to understand existing code)
- **Output**: Requirements and technical decisions

### Building Stage
- **Purpose**: Implement features and generate code
- **Approach**: Tool-driven development with explanation
- **Tools**: Write (new files), Edit (modifications), Bash (testing)
- **Output**: Production-ready code files

### Reviewing Stage
- **Purpose**: Ensure quality and compliance
- **Approach**: Code analysis and improvement
- **Tools**: Read (review code), Edit (fix issues)
- **Output**: Compliant, tested code

### Completed Stage
- **Purpose**: Finalize and document
- **Approach**: Summary and next steps
- **Tools**: Read (final verification)
- **Output**: Deployment-ready application

## PRIA Compliance Framework

### Security Rules (Critical)
```typescript
// Always filter by workspace_id
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('workspace_id', workspaceId);

// Create user record after signup
const { data: authUser } = await supabase.auth.signUp({...});
await supabase.from('users').insert({
  id: authUser.user.id,
  workspace_id: workspaceId,
  ...
});
```

### Architecture Rules (High Priority)
- Next.js 15 App Router structure
- TypeScript for all code
- Supabase integration patterns
- Import alias usage (@/ not @/src/)
- File structure compliance

### Quality Rules (Medium Priority)
- Production-ready code (no TODOs)
- No console.log statements
- Complete implementations
- Proper error handling
- TypeScript typing

## Usage Examples

### Basic App Composition
```bash
POST /api/app-compose
{
  "conversationId": "conv-123",
  "userInput": "I need a task management app with teams and projects",
  "sessionId": "session-456"
}
```

### Continuing Conversation
```bash
POST /api/app-compose
{
  "conversationId": "conv-123",
  "userInput": "Add drag and drop functionality to the task board",
  "sessionId": "session-456"
}
```

### Compliance Check
```bash
POST /api/compliance-check
{
  "conversationId": "conv-123",
  "files": [...]
}
```

## Configuration

### Environment Variables
```bash
# Claude Code SDK
ANTHROPIC_API_KEY=your-api-key
CLAUDE_MODEL=claude-3-sonnet-20240229

# Supabase (for progress updates)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# A2A Router
A2A_ROUTER_URL=http://localhost:3001
A2A_ROUTER_TOKEN=your-router-token

# Logging
LOG_LEVEL=info
```

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  }
}
```

## Advantages of Conversational Approach

### 1. **Natural Interaction**
- Users can ask questions and get explanations
- No need to provide complete specifications upfront
- Iterative refinement through dialogue

### 2. **Adaptive Planning**
- Changes direction based on conversation context
- Handles unexpected requirements gracefully
- Flexible implementation strategies

### 3. **Contextual Compliance**
- PRIA rules provided as conversational context
- Real-time compliance checking with explanations
- Guidance adapted to current development stage

### 4. **Tool Integration**
- Claude naturally uses tools when appropriate
- File operations feel like pair programming
- Testing and validation integrated into conversation

### 5. **Better Error Handling**
- Conversational error explanations
- Iterative problem solving
- Context-aware suggestions

## Maintaining PRIA Compliance

### 1. **Contextual Guidelines**
Instead of rigid prompts, we provide PRIA guidelines as conversational context:
- Architecture patterns explained naturally
- Security rules integrated into conversation
- Quality standards provided as guidance

### 2. **Real-time Monitoring**
- ComplianceMonitor checks code as it's generated
- Immediate feedback on violations
- Contextual suggestions for fixes

### 3. **Adaptive Enforcement**
- Critical security rules are non-negotiable
- Architecture rules provide structured guidance
- Quality rules improve code incrementally

### 4. **Progressive Validation**
- Compliance checked throughout conversation
- Issues addressed as they arise
- Final validation before completion

## Deployment

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Vercel Deployment
- Uses `vercel.json` configuration
- Serverless function deployment
- Automatic scaling and monitoring

## Monitoring and Observability

### Progress Updates
- Real-time progress via Supabase Realtime
- Stage transitions and completion status
- Error handling and recovery

### Compliance Reporting
- Detailed compliance reports
- Security, architecture, and quality metrics
- Actionable suggestions for improvements

### Cost Tracking
- Claude Code SDK usage monitoring
- Conversation cost optimization
- Resource usage analytics

## Contributing

1. Follow PRIA architectural guidelines
2. Maintain conversational approach
3. Ensure compliance monitoring
4. Test with real user scenarios
5. Document conversation patterns

## License

MIT License - see LICENSE file for details 