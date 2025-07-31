# PRIA Artifact Reference System

## Overview

The PRIA Artifact Reference System provides intelligent cross-phase artifact referencing using `@agent-name` syntax. This system enables subagents to access and reference work from other phases, maintaining context and ensuring coordination across the 7-phase development workflow.

## Enhanced @agent-name Syntax

### Basic Syntax Patterns

#### 1. Simple Agent Reference
```
@requirements-analyst
```
References all artifacts from the requirements analyst agent.

#### 2. Type-Specific Reference
```
@code-generator:component
@system-architect:specification
@qa-engineer:test
```
References specific artifact types from an agent using colon (`:`) separator.

#### 3. Phase-Specific Reference
```
@requirements-analyst#1
@system-architect#2
@code-generator#4
```
References artifacts from a specific phase using hash (`#`) separator.

#### 4. Timeframe Reference
```
@code-generator@latest
@requirements-analyst@recent
@system-architect@all
```
References artifacts by timeframe using at (`@`) separator:
- `latest` - Most recent 5 artifacts
- `recent` - Last week's artifacts (up to 10)
- `all` - All artifacts (up to 50)

#### 5. Combined Syntax
```
@code-generator:component#4
@system-architect:specification@recent
@qa-engineer:test#5@latest
```
Combine multiple modifiers for precise artifact targeting.

### Alternative Syntax Formats

#### Dot Notation
```
@agent.type[query]
@code-generator.component[authentication]
@system-architect.database[user model]
```

#### Bracket Queries
```
@agent{search-terms}
@requirements-analyst{user authentication}
@code-generator{API endpoints}
```

#### Parenthetical Modifiers
```
@agent:type(search-query)
@system-architect:specification(database design)
@code-generator:component(user interface)
```

## Available Agents

### Phase 1: Requirements Analysis
- **@requirements-analyst** - User stories, functional requirements, acceptance criteria
- Artifact types: `requirement`, `user_story`, `acceptance_criteria`

### Phase 2: System Architecture
- **@system-architect** - Technical specifications, system design, architecture decisions
- Artifact types: `specification`, `architecture`, `design_decision`, `api_spec`

### Phase 3: Implementation Planning
- **@project-planner** - Task breakdown, sprint planning, dependency mapping
- Artifact types: `task`, `sprint`, `milestone`, `dependency_map`

### Phase 4: Development & Implementation
- **@code-generator** - Generated code, components, API implementations
- Artifact types: `code`, `component`, `api`, `util`, `type`, `documentation`

### Phase 5: Testing & QA
- **@qa-engineer** - Test suites, test cases, coverage reports, quality metrics
- Artifact types: `test`, `test_suite`, `coverage_report`, `quality_metric`

### Phase 6: Validation & Security
- **@security-auditor** - Security audits, vulnerability reports, compliance checks
- Artifact types: `security_report`, `vulnerability`, `compliance_check`, `validation`

### Phase 7: Deployment & Monitoring
- **@devops-engineer** - Deployment configurations, monitoring setup, infrastructure
- Artifact types: `deployment_config`, `infrastructure`, `monitoring`, `pipeline`

## Practical Usage Examples

### Requirements to Architecture
```
Building on @requirements-analyst requirements, create technical specifications for the user authentication system.

Referenced artifacts:
- @requirements-analyst:requirement{authentication}
- @requirements-analyst:user_story{login workflow}
```

### Architecture to Development
```
Implement the API endpoints based on @system-architect:api_spec and ensure they meet @requirements-analyst:acceptance_criteria.

Context from previous phases:
- @system-architect:specification#2
- @requirements-analyst{API requirements}
```

### Development to Testing
```
Generate comprehensive test suites for @code-generator:component and validate against @requirements-analyst:acceptance_criteria.

Test generation context:
- @code-generator:component@recent
- @code-generator:api#4
- @requirements-analyst:requirement{testing criteria}
```

### Cross-Phase Validation
```
Perform security audit considering @system-architect:architecture, @code-generator:api, and @requirements-analyst{security requirements}.

Security context:
- @system-architect:design_decision{security}
- @code-generator:component{authentication}
- @requirements-analyst:requirement{data protection}
```

## Advanced Features

### Relevance Scoring
The system automatically scores artifacts based on:
- **Type Match**: Exact artifact type matches get higher relevance
- **Phase Proximity**: Artifacts from nearby phases are prioritized
- **Recency**: More recent artifacts are weighted higher
- **Confidence**: High-confidence artifacts are prioritized
- **Query Match**: Content matching query terms increases relevance

### Context Quality Assessment
- **Excellent**: High relevance scores, complete coverage, exact matches
- **Good**: Adequate relevance, good coverage, some matches
- **Fair**: Basic relevance, partial coverage, few matches  
- **Poor**: Low relevance, minimal coverage, no clear matches

### Intelligent Filtering
- **Priority-based**: High-priority agents and types are surfaced first
- **Dependency-aware**: Related artifacts are grouped together
- **Version-aware**: Latest versions of evolving artifacts are preferred
- **Workspace-isolated**: Only artifacts within the current workspace

## API Integration

### Parse References
```javascript
const response = await fetch(`/api/artifacts/${sessionId}`, {
  method: 'POST',
  body: JSON.stringify({
    action: 'parse',
    query: '@requirements-analyst @code-generator:component'
  })
})
```

### Resolve Artifacts
```javascript
const response = await fetch(`/api/artifacts/${sessionId}`, {
  method: 'POST',
  body: JSON.stringify({
    action: 'resolve',
    references: [
      { agentName: 'requirements-analyst', artifactType: 'requirement' },
      { agentName: 'code-generator', artifactType: 'component', phase: 4 }
    ]
  })
})
```

### Get Statistics
```javascript
const response = await fetch(`/api/artifacts/${sessionId}?action=statistics`)
```

## UI Components

### Artifact Browser
- **Search Interface**: Parse and resolve artifact references
- **Statistics Dashboard**: Overview of artifacts by agent, type, and phase
- **Help System**: Interactive documentation and examples
- **Real-time Results**: Live parsing and resolution

### Integration Points
- **Chat Interface**: Automatic parsing of @references in user messages
- **Workflow Navigation**: Context-aware artifact suggestions
- **Code Generation**: Enhanced prompts with relevant artifacts
- **Quality Assurance**: Cross-phase validation and verification

## Best Practices

### Reference Strategy
1. **Be Specific**: Use type and phase modifiers for precise targeting
2. **Include Context**: Add query terms to improve relevance matching
3. **Check Quality**: Review context quality before proceeding
4. **Iterate**: Refine references based on results

### Performance Optimization
1. **Limit Scope**: Use timeframe modifiers to reduce artifact volume
2. **Cache Results**: Leverage relevance scoring for efficient reuse
3. **Batch Requests**: Combine multiple references in single operations
4. **Monitor Usage**: Track artifact access patterns for optimization

### Security Considerations
1. **Workspace Isolation**: All artifacts are filtered by workspace
2. **Permission Checking**: User authentication verified for all requests
3. **Content Sanitization**: Artifact content is validated before display
4. **Audit Logging**: Reference access is tracked for compliance

## Architecture Benefits

### Context Preservation
- **Phase Continuity**: Work from previous phases remains accessible
- **Decision Tracking**: Architecture decisions flow through implementation
- **Requirement Traceability**: Features link back to original requirements
- **Quality Assurance**: Testing references actual implementation artifacts

### Collaboration Enhancement
- **Agent Coordination**: Subagents can reference each other's work
- **Knowledge Sharing**: Insights from one phase inform others
- **Consistency Checking**: Cross-phase validation ensures alignment
- **Documentation Generation**: Artifacts become living documentation

### Development Efficiency
- **Reduced Repetition**: Avoid re-specifying existing requirements
- **Faster Iteration**: Quick access to relevant context
- **Better Quality**: Comprehensive understanding improves outputs
- **Streamlined Workflow**: Seamless phase transitions

## Future Enhancements

### Planned Features
- **Semantic Search**: Natural language artifact queries
- **Auto-linking**: Automatic detection of related artifacts
- **Version Control**: Track artifact evolution over time
- **Conflict Detection**: Identify inconsistencies across phases
- **Smart Suggestions**: AI-powered reference recommendations

### Integration Roadmap
- **Claude Code SDK**: Direct integration with subagent execution
- **GitHub Sync**: Artifact references in commit messages and PRs
- **Documentation Export**: Generate comprehensive project documentation
- **Compliance Reporting**: Automated traceability reports
- **Performance Analytics**: Artifact usage and effectiveness metrics

---

The PRIA Artifact Reference System represents a significant advancement in cross-phase coordination and context preservation, enabling more intelligent and efficient development workflows through the power of semantic artifact referencing.