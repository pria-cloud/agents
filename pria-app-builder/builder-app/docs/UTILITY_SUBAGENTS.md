# PRIA App Builder - Utility Subagents Documentation

## Overview
This document describes the utility subagents that provide specialized support during the development phase (Phase 4) of the PRIA workflow.

## Component Researcher Subagent

### Purpose
The Component Researcher specializes in discovering, analyzing, and recommending UI components and design patterns for PRIA applications.

### Capabilities
- **Component Discovery**: Find existing shadcn/ui components suitable for specific features
- **Pattern Analysis**: Analyze component usage patterns in the codebase
- **Usage Examples**: Provide integration examples and best practices
- **Component Comparison**: Compare different component options for specific use cases
- **Integration Guidance**: Guide developers on proper component integration

### Usage Scenarios
1. **Feature Implementation**: When implementing a new feature, consult the component researcher for UI recommendations
2. **Component Selection**: Get help choosing between similar components (e.g., Dialog vs Sheet)
3. **Pattern Consistency**: Ensure consistent component usage across the application
4. **Accessibility**: Get guidance on accessible component implementations

### Example Interactions
```typescript
// Example 1: Finding components for a data table
"@component-researcher I need to display a sortable, filterable data table with pagination"

// Example 2: Component integration guidance
"@component-researcher How should I integrate the Command component for a search palette?"

// Example 3: Pattern recommendations
"@component-researcher What's the best pattern for form validation with shadcn/ui?"
```

### Output Formats
- **component_recommendation**: Specific component suggestions with rationale
- **usage_example**: Code examples showing proper integration
- **pattern_guide**: Best practices for component patterns
- **integration_snippet**: Ready-to-use code snippets

## Integration Expert Subagent

### Purpose
The Integration Expert specializes in connecting external services, APIs, and third-party systems with PRIA applications.

### Capabilities
- **API Integration**: Implement robust connections to external APIs
- **Service Connectivity**: Set up connections to services like Supabase, E2B, GitHub
- **Authentication Setup**: Configure OAuth, API keys, and authentication flows
- **Webhook Configuration**: Implement webhook handlers for real-time events
- **Data Synchronization**: Create reliable data sync mechanisms
- **Error Handling**: Implement retry logic and graceful error handling

### Usage Scenarios
1. **Third-party Services**: Integrate services like Stripe, SendGrid, or Twilio
2. **OAuth Implementation**: Set up OAuth flows for GitHub, Google, etc.
3. **Webhook Handling**: Implement webhook receivers for GitHub, Stripe events
4. **API Client Creation**: Build robust API clients with caching and retry logic
5. **Real-time Features**: Implement WebSocket or Server-Sent Events connections

### Example Interactions
```typescript
// Example 1: GitHub integration
"@integration-expert Set up GitHub API integration with OAuth and webhook support"

// Example 2: Payment processing
"@integration-expert Integrate Stripe for subscription management with webhook handlers"

// Example 3: Email service
"@integration-expert Create email service integration with SendGrid including templates"
```

### Output Formats
- **integration**: Complete integration module with client and handlers
- **api_client**: API client with proper error handling and retry logic
- **webhook_handler**: Webhook receiver with signature validation
- **error_handler**: Comprehensive error handling utilities
- **configuration**: Environment configuration and setup guides

## Collaboration with Core Subagents

### During Development Phase (Phase 4)
Both utility subagents work alongside the code-generator to provide specialized support:

1. **Component Researcher** assists with:
   - UI component selection based on requirements
   - Ensuring consistent design patterns
   - Providing accessibility guidance
   - Recommending component combinations

2. **Integration Expert** assists with:
   - External service connections
   - API client implementations
   - Authentication and security setup
   - Error handling patterns

### Cross-Phase References
- Both subagents can reference **@system-architect** specifications to understand integration requirements
- They provide artifacts that **@code-generator** uses for implementation
- Their outputs can be validated by **@qa-engineer** for proper testing

## Best Practices

### When to Use Component Researcher
- Starting a new UI feature
- Choosing between similar components
- Ensuring accessibility compliance
- Maintaining design consistency

### When to Use Integration Expert
- Connecting to external APIs
- Setting up authentication flows
- Implementing webhooks
- Creating robust error handling

### Integration Patterns
Both subagents follow PRIA compliance requirements:
- All API keys stored in environment variables
- Proper error handling and logging
- Rate limiting considerations
- Security best practices

## Configuration

### Component Researcher Configuration
```typescript
{
  name: 'component-researcher',
  phase: 4,
  tools: ['read-file', 'search-components', 'artifact-reference', 'documentation-search'],
  capabilities: [
    'component_discovery',
    'pattern_analysis',
    'usage_examples',
    'best_practices',
    'component_comparison',
    'integration_guidance'
  ]
}
```

### Integration Expert Configuration
```typescript
{
  name: 'integration-expert',
  phase: 4,
  tools: ['write-file', 'read-file', 'artifact-reference', 'api-testing', 'integration-validation'],
  capabilities: [
    'api_integration',
    'service_connectivity',
    'authentication_setup',
    'webhook_configuration',
    'data_synchronization',
    'error_handling'
  ]
}
```

## Summary

The utility subagents enhance the PRIA development workflow by providing specialized expertise during the implementation phase. They ensure that applications are built with:
- Consistent UI patterns using approved components
- Robust integrations with external services
- Proper error handling and security practices
- Accessibility and usability considerations

These subagents work seamlessly with the core workflow agents to deliver high-quality, production-ready applications.