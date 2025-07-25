# Component Architecture Documentation

## Overview

The Claude Code E2B workspace has been refactored from a single monolithic component (6000+ lines) into a modular, maintainable architecture. This document outlines the new component structure, relationships, and best practices.

## Architecture Philosophy

### Design Principles
- **Single Responsibility**: Each component has one clear purpose
- **Composition over Inheritance**: Components are composed of smaller, reusable parts
- **Separation of Concerns**: UI, state management, and business logic are separated
- **Type Safety**: All components are fully typed with TypeScript
- **Performance**: Components are optimized for lazy loading and tree-shaking

### Component Hierarchy

```
components/
├── claude-workspace-refactored.tsx          # Main workspace orchestrator
├── workspace/                               # Workspace-specific components
│   ├── mode-selector.tsx                   # Business/Developer mode toggle
│   ├── session-selector.tsx               # Session management
│   ├── navigation-tabs.tsx                # Tab navigation system
│   ├── requirements/                       # Requirements management
│   │   └── requirements-view.tsx          # Requirements & user stories
│   ├── workflow/                          # Workflow design
│   │   └── workflow-designer.tsx         # Visual workflow builder
│   ├── ui/                               # UI/UX components
│   │   └── ui-guidelines.tsx             # Design system documentation
│   ├── technical/                        # Technical specifications
│   │   └── tech-specs.tsx               # Auto-generated technical docs
│   ├── history/                          # Session tracking
│   │   └── session-history.tsx          # Timeline and change log
│   └── developer/                        # Developer-specific tools
│       ├── preview-testing.tsx          # Live preview and E2E testing
│       ├── code-editor.tsx              # Monaco-based code editor
│       ├── terminal.tsx                 # Interactive terminal
│       ├── database-schema.tsx          # Visual database designer
│       ├── api-documentation.tsx        # API docs with testing
│       └── build-deploy.tsx             # CI/CD pipeline management
```

## Component Details

### Core Components

#### 1. ClaudeWorkspace (claude-workspace-refactored.tsx)
**Purpose**: Main orchestrator component that manages global state and routing

**Key Features**:
- React Context for state management
- Mode switching (Business/Developer)
- Session management
- Tab routing
- Component composition

**State Management**:
```typescript
interface WorkspaceContextType {
  mode: 'business' | 'developer'
  activeTab: string
  currentSession: Session
}
```

**Usage**:
```typescript
import { ClaudeWorkspace } from "@/components/claude-workspace-refactored"

export default function Home() {
  return <ClaudeWorkspace />
}
```

#### 2. ModeSelector (workspace/mode-selector.tsx)
**Purpose**: Toggle between Business and Developer modes

**Props**:
```typescript
interface ModeSelectorProps {
  mode: 'business' | 'developer'
  onModeChange: (mode: 'business' | 'developer') => void
}
```

**Features**:
- Visual mode indicators
- Smooth transitions
- Keyboard accessibility

#### 3. SessionSelector (workspace/session-selector.tsx)
**Purpose**: Manage and switch between different project sessions

**Key Features**:
- Session creation dialog
- Session status indicators
- Recent sessions list
- Connection state management

#### 4. NavigationTabs (workspace/navigation-tabs.tsx)
**Purpose**: Dynamic tab navigation based on current mode

**Features**:
- Mode-aware tab display
- Responsive design
- Icon integration
- Overflow handling

### Business Mode Components

#### RequirementsView (workspace/requirements/requirements-view.tsx)
**Purpose**: Manage project requirements and user stories

**Key Features**:
- CRUD operations for requirements
- Priority and status management
- Search and filtering
- Category organization

**Data Structure**:
```typescript
interface Requirement {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed'
  category: string
}
```

#### WorkflowDesigner (workspace/workflow/workflow-designer.tsx)
**Purpose**: Visual workflow design and process mapping

**Features**:
- Drag-and-drop workflow builder
- Node types (start, action, decision, end)
- Connection management
- Export capabilities

#### UIGuidelines (workspace/ui/ui-guidelines.tsx)
**Purpose**: Design system documentation and component showcase

**Features**:
- Color palette management
- Typography scale
- Spacing system
- Component examples
- Responsive breakpoints

#### TechSpecs (workspace/technical/tech-specs.tsx)
**Purpose**: Auto-generated technical specifications

**Features**:
- AI-powered spec generation
- Architecture documentation
- Technology stack management
- Implementation planning

#### SessionHistory (workspace/history/session-history.tsx)
**Purpose**: Project timeline and change tracking

**Features**:
- Visual timeline interface
- Change analytics
- Event filtering
- Export capabilities

### Developer Mode Components

#### PreviewTesting (workspace/developer/preview-testing.tsx)
**Purpose**: Live application preview and automated testing

**Features**:
- Multi-device preview
- Playwright integration
- Test execution
- Coverage reporting
- Performance metrics

#### CodeEditor (workspace/developer/code-editor.tsx)
**Purpose**: Monaco-based code editing environment

**Features**:
- Syntax highlighting
- File tree navigation
- IntelliSense support
- Multi-tab editing
- Real-time collaboration

#### Terminal (workspace/developer/terminal.tsx)
**Purpose**: Interactive terminal with command history

**Features**:
- Command execution
- History management
- Deployment logs
- System monitoring

#### DatabaseSchema (workspace/developer/database-schema.tsx)
**Purpose**: Visual database design and migration management

**Features**:
- ERD visualization
- Schema editing
- Migration generation
- Relationship management

#### APIDocumentation (workspace/developer/api-documentation.tsx)
**Purpose**: Interactive API documentation with testing

**Features**:
- OpenAPI integration
- Live API testing
- Code examples
- Authentication handling

#### BuildDeploy (workspace/developer/build-deploy.tsx)
**Purpose**: CI/CD pipeline management and deployment

**Features**:
- Build automation
- Environment management
- Deployment history
- Performance monitoring

## State Management

### Context Architecture

The workspace uses React Context for global state management:

```typescript
const WorkspaceContext = createContext<WorkspaceContextType>({
  mode: 'business',
  activeTab: 'requirements',
  currentSession: defaultSession
})

export const useWorkspace = () => useContext(WorkspaceContext)
```

### Local State Management

Each component manages its own local state using React hooks:
- `useState` for simple state
- `useEffect` for side effects
- `useCallback` for memoized functions
- `useMemo` for expensive calculations

## Performance Optimizations

### Code Splitting
Components are structured for easy code splitting:

```typescript
// Lazy loading example
const CodeEditor = lazy(() => import('./workspace/developer/code-editor'))
```

### Memoization
Expensive computations are memoized:

```typescript
const filteredRequirements = useMemo(() => {
  return requirements.filter(req => 
    req.title.toLowerCase().includes(searchTerm.toLowerCase())
  )
}, [requirements, searchTerm])
```

### Bundle Optimization
- Tree-shaking friendly exports
- Minimal external dependencies
- Optimized imports

## Testing Strategy

### Unit Testing
Each component has corresponding test files:

```
tests/
├── claude-workspace.spec.ts
├── preview-testing.spec.ts
├── database-schema.spec.ts
├── deployment.spec.ts
├── api-endpoints.spec.ts
└── mcp-integration.spec.ts
```

### Integration Testing
Playwright tests cover end-to-end workflows:
- Mode switching
- Component navigation
- Feature interactions
- API integrations

### Testing Tools
- **Playwright**: E2E testing
- **React Testing Library**: Component testing
- **Jest**: Unit testing framework
- **MSW**: API mocking

## Accessibility

### Standards Compliance
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management

### Implementation
- Semantic HTML elements
- ARIA labels and roles
- Color contrast compliance
- Responsive design

## Development Guidelines

### Adding New Components

1. **Create Component File**:
   ```typescript
   // components/workspace/new-feature/new-component.tsx
   "use client"
   
   import { useState } from "react"
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
   
   export function NewComponent() {
     // Component implementation
   }
   ```

2. **Add to Navigation**:
   Update `navigation-tabs.tsx` with new tab configuration

3. **Update Main Workspace**:
   Import and add to `renderTabContent()` switch statement

4. **Add Tests**:
   Create corresponding test file in `tests/` directory

### Code Standards

#### TypeScript
- Strict mode enabled
- Explicit type definitions
- Interface over type aliases
- Generic types where appropriate

#### React
- Functional components only
- Hooks for state management
- Props interfaces for type safety
- Error boundaries for fault tolerance

#### Styling
- Tailwind CSS classes
- shadcn/ui components
- Responsive design patterns
- Dark mode support

### File Naming Conventions
- **Components**: `kebab-case.tsx`
- **Hooks**: `use-feature-name.ts`
- **Types**: `types.ts`
- **Utils**: `utils.ts`

## Migration Notes

### From Monolithic to Modular

The refactoring process involved:

1. **Component Extraction**: Breaking down the 6000+ line component
2. **State Isolation**: Moving local state to appropriate components
3. **Interface Definition**: Creating clear props interfaces
4. **Context Integration**: Implementing global state management
5. **Testing**: Adding comprehensive test coverage

### Breaking Changes

When updating from the old `claude-workspace.tsx`:

1. Update import path:
   ```typescript
   // Old
   import { ClaudeWorkspace } from "@/components/claude-workspace"
   
   // New
   import { ClaudeWorkspace } from "@/components/claude-workspace-refactored"
   ```

2. Context usage:
   ```typescript
   // Access workspace context in child components
   import { useWorkspace } from "@/components/claude-workspace-refactored"
   
   function MyComponent() {
     const { mode, activeTab, currentSession } = useWorkspace()
     // Component logic
   }
   ```

## Future Enhancements

### Planned Features
- **Plugin System**: Extensible component architecture
- **Theme Customization**: Advanced theming capabilities
- **Real-time Collaboration**: Multi-user editing support
- **Advanced Analytics**: Usage tracking and insights

### Scalability Considerations
- **Micro-frontends**: Potential for independent deployment
- **State Management**: Possible migration to Zustand/Redux
- **Component Library**: Extract reusable components
- **Documentation**: Interactive component documentation

## Conclusion

The refactored component architecture provides:
- **Maintainability**: Easier to understand and modify
- **Testability**: Comprehensive test coverage
- **Performance**: Optimized bundle sizes and loading
- **Scalability**: Ready for future enhancements
- **Developer Experience**: Better development workflow

This architecture serves as the foundation for continued development and feature expansion in the Claude Code E2B environment.