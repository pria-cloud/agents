# Target App Specification

> **CRITICAL**: This document MUST be maintained and updated throughout the development process. Claude Code SDK relies on this file for project context and decision-making.

## 📋 Project Overview

### Project Information
- **Project Name**: [Project Name]
- **Version**: [Current Version]
- **Created**: [Creation Date]
- **Last Updated**: [Last Update Date]
- **Development Phase**: [Current Workflow Phase 1-7]

### Business Objectives
- **Primary Purpose**: [Brief description of the application's main purpose]
- **Target Users**: [Who will use this application]
- **Success Metrics**: [How success will be measured]
- **Business Value**: [Expected business impact]

### Project Scope
- **In Scope**: [Features and functionality included in this project]
- **Out of Scope**: [Features explicitly excluded]
- **Assumptions**: [Key assumptions made during planning]
- **Constraints**: [Technical, business, or resource limitations]

## 🎯 Requirements Status

### Functional Requirements
> Requirements extracted from conversations and analysis

| ID | Requirement | Type | Priority | Status | Phase | Notes |
|----|-------------|------|----------|--------|-------|-------|
| REQ-001 | [Requirement Title] | functional | high | new | 1 | [Notes] |
| REQ-002 | [Requirement Title] | functional | medium | approved | 2 | [Notes] |

### Non-Functional Requirements
| ID | Requirement | Type | Priority | Status | Phase | Notes |
|----|-------------|------|----------|--------|-------|-------|
| NFR-001 | Performance: Page load < 2s | performance | high | approved | 1 | [Notes] |
| NFR-002 | Security: Multi-tenant isolation | security | high | implemented | 4 | [Notes] |

### User Stories
```
As a [user type]
I want [goal/desire]
So that [benefit/value]

Acceptance Criteria:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

## 🏗️ Technical Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19, Node.js 22
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase PostgreSQL with RLS
- **Authentication**: Supabase Auth
- **Testing**: Vitest + Playwright
- **Deployment**: [Deployment target]

### System Architecture
```
[Describe the high-level system architecture]

Components:
- Frontend: [Description]
- Backend: [Description]
- Database: [Description]
- External Services: [Description]
```

### Component Hierarchy
```
App/
├── Layout Components
│   ├── Header
│   ├── Navigation
│   └── Footer
├── Feature Components
│   ├── [Feature 1]
│   ├── [Feature 2]
│   └── [Feature 3]
└── Utility Components
    ├── Loading States
    ├── Error Boundaries
    └── Common UI Elements
```

### Data Flow
```
[Describe how data flows through the application]

1. User Interaction → 
2. Component State → 
3. API Call → 
4. Database Query → 
5. Response Processing → 
6. UI Update
```

## 🗄️ Database Design

### Application-Specific Tables
> Include only tables specific to this application (shared PRIA tables are managed centrally)

```sql
-- Example application table
CREATE TABLE app_specific_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id), -- MANDATORY
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- MANDATORY Row-Level Security
ALTER TABLE app_specific_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON app_specific_table
FOR ALL USING (workspace_id = (auth.jwt()->>'workspace_id')::uuid);
```

### Data Relationships
```
[Describe key relationships between tables]

Table A → Table B (relationship type)
- [Description of relationship]
```

### Data Validation Rules
- **Business Rules**: [List key business rules enforced by database]
- **Constraints**: [List database constraints]
- **Triggers**: [List any database triggers]

## 🔌 API Design

### Endpoint Overview
| Method | Endpoint | Purpose | Auth Required | Parameters |
|--------|----------|---------|---------------|------------|
| GET | /api/example | [Purpose] | Yes | [Parameters] |
| POST | /api/example | [Purpose] | Yes | [Parameters] |

### API Specifications

#### Example Endpoint
```typescript
// GET /api/example
interface ExampleResponse {
  data: ExampleData[]
  total: number
  page: number
}

interface ExampleData {
  id: string
  workspace_id: string
  name: string
  created_at: string
}
```

### Authentication & Authorization
- **Authentication**: [How users authenticate]
- **Authorization**: [How access is controlled]
- **Workspace Isolation**: [How multi-tenancy is enforced]

## 🎨 UI/UX Design

### Design System
- **Theme**: [Color scheme, typography, spacing]
- **Components**: shadcn/ui + custom components
- **Icons**: Lucide React
- **Responsive**: Mobile-first design

### Page Structure
```
Application Pages:
├── Public Pages
│   ├── Landing Page (/)
│   ├── Login (/login)
│   └── Register (/register)
├── Protected Pages
│   ├── Dashboard (/dashboard)
│   ├── [Feature Pages]
│   └── Settings (/settings)
└── Error Pages
    ├── 404 (/404)
    └── Error Boundary
```

### User Flows
```
Primary User Flow:
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]

Secondary User Flows:
- [Flow 1]: [Description]
- [Flow 2]: [Description]
```

### Accessibility Requirements
- **WCAG Compliance**: 2.1 AA minimum
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: ARIA labels and semantic HTML
- **Color Contrast**: Minimum 4.5:1 ratio

## 🧪 Testing Strategy

### Test Coverage
- **Unit Tests**: [Components and utilities to test]
- **Integration Tests**: [API endpoints and database operations]
- **E2E Tests**: [Critical user flows]
- **Performance Tests**: [Performance benchmarks]

### Test Implementation
```typescript
// Example test structure
describe('Feature', () => {
  it('should handle user interaction', () => {
    // Test implementation
  })
})
```

### Quality Gates
- **Code Coverage**: Minimum 80%
- **Performance**: Core Web Vitals > 90
- **Accessibility**: WCAG 2.1 AA compliance
- **Security**: No high-severity vulnerabilities

## 🚀 Deployment Configuration

### Environment Setup
```bash
# Environment Variables
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=your_app_url

# Application-specific variables
NEXT_PUBLIC_FEATURE_FLAG_X=true
API_RATE_LIMIT=1000
```

### Build Configuration
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

### Deployment Pipeline
1. **Development**: Local development with hot reload
2. **Testing**: Automated test execution
3. **Staging**: Preview deployment for testing
4. **Production**: Final deployment with monitoring

## 📈 Monitoring & Observability

### Performance Monitoring
- **Core Web Vitals**: [Current scores and targets]
- **Load Times**: [Performance benchmarks]
- **Error Rates**: [Error tracking and thresholds]

### Business Metrics
- **User Engagement**: [Key engagement metrics]
- **Feature Usage**: [Feature adoption tracking]
- **Success Metrics**: [Business KPI tracking]

### Alerting
- **Error Thresholds**: [When to alert on errors]
- **Performance Degradation**: [Performance alert thresholds]
- **Availability**: [Uptime monitoring and alerts]

## 📝 Development History

### Version History
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | [Date] | Initial implementation | Claude |
| 1.1.0 | [Date] | Added feature X | Claude |

### Major Decisions
- **[Date]**: [Decision Description] - [Rationale]
- **[Date]**: [Decision Description] - [Rationale]

### Technical Debt
- **[Item]**: [Description and plan for resolution]
- **[Item]**: [Description and plan for resolution]

## 🔄 Change Management

### Requirement Changes
> Track all requirement modifications

| Date | Requirement | Change Type | Reason | Impact |
|------|-------------|-------------|--------|--------|
| [Date] | REQ-001 | Modified | [Reason] | [Impact] |

### Architecture Changes
> Track significant technical decisions

| Date | Component | Change | Reason | Migration Plan |
|------|-----------|--------|--------|----------------|
| [Date] | [Component] | [Change] | [Reason] | [Plan] |

## 🎯 Next Steps

### Immediate Priorities
1. **[Priority 1]**: [Description and timeline]
2. **[Priority 2]**: [Description and timeline]
3. **[Priority 3]**: [Description and timeline]

### Upcoming Features
- **[Feature 1]**: [Description and estimated timeline]
- **[Feature 2]**: [Description and estimated timeline]

### Technical Improvements
- **[Improvement 1]**: [Description and rationale]
- **[Improvement 2]**: [Description and rationale]

## 📚 References

### Documentation
- [PRIA Architecture Guidelines](../CLAUDE.md)
- [Builder App Documentation](../../README.md)
- [Requirements Documentation](../../REQUIREMENTS.md)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

## 🔄 Maintenance Notes

**Last Updated**: [Date]
**Updated By**: Claude Code SDK
**Next Review**: [Date]

> **Remember**: Keep this document current and detailed. It serves as the single source of truth for project context and is essential for maintaining development continuity across sessions.