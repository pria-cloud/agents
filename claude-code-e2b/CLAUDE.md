# PRIA Technical Architecture Guidelines for Claude Code

This document defines the mandatory technical architecture guidelines that MUST be followed when generating applications within the PRIA (Platform for Rapid Intelligent Applications) ecosystem.

## 🎯 Core Mission
Generate enterprise-grade Next.js applications with strict compliance to PRIA's multi-tenant, security-first architecture while maintaining an exceptional developer experience.

## 🛡️ Critical Security Requirements (NON-NEGOTIABLE)

### Workspace Tenancy Isolation
EVERY database interaction MUST include workspace-level filtering:

```typescript
// ✅ CORRECT - Mandatory workspace filtering
const { data, error } = await supabase
  .from('your_table')
  .select('*')
  .eq('workspace_id', workspaceId) // NON-NEGOTIABLE

// ❌ FORBIDDEN - Missing tenant isolation
const { data, error } = await supabase
  .from('your_table')
  .select('*') // SECURITY VIOLATION
```

### Authentication Pattern (Required)
```typescript
'use server'
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'

export async function serverAction() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Authentication required' }
  }
  
  const workspaceId = user.app_metadata?.workspace_id
  if (!workspaceId) {
    return { error: 'Workspace ID not found' }
  }
  
  // Continue with workspace-filtered operations...
}
```

## 🏗️ Technology Stack (MANDATORY)

### Core Framework Requirements
- **Framework**: Next.js 15+ (App Router only)
- **Runtime**: React 19+, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase with PostgreSQL + Row-Level Security
- **Authentication**: Supabase Auth with JWT
- **Icons**: Lucide React exclusively
- **Testing**: Vitest + React Testing Library + Playwright

### Project Structure (Exact Pattern)
```
project-root/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth-related routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Custom React components
│   ├── ui/               # shadcn/ui components (READ-ONLY)
│   └── ...               # Custom components
├── lib/
│   ├── supabase/         # Supabase client configurations
│   │   ├── client.ts     # Browser client
│   │   ├── server.ts     # Server client  
│   │   └── middleware.ts # Session management
│   ├── utils.ts          # Utility functions
│   └── types/            # TypeScript definitions
├── middleware.ts         # Route protection & session management
└── package.json          # Dependencies
```

## 🗄️ Database Architecture Requirements

### Mandatory Table Schema
Every application table MUST include:

```sql
CREATE TABLE your_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id), -- MANDATORY
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Your application-specific columns...
);

-- MANDATORY Row-Level Security
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation" ON your_table
FOR ALL USING (workspace_id = (jwt.claims->>'workspace_id')::uuid);
```

### Required Supabase Client Files

#### `lib/supabase/client.ts`
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### `lib/supabase/server.ts`
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default function createServerClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

#### `middleware.ts` (REQUIRED)
```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)
  
  // Protected routes check
  const protectedPaths = ['/dashboard', '/admin', '/settings']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )
  
  if (isProtectedPath) {
    const supabase = createServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

## 🎨 UI/UX Standards

### Component Usage Rules
- **USE ONLY**: Existing shadcn/ui components from `components/ui/`
- **FORBIDDEN**: Creating or modifying `components/ui/*` files
- **REQUIRED**: Proper loading, empty, and error states
- **MANDATORY**: Mobile-first responsive design

### Required UI Patterns

#### Loading States
```typescript
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

#### Error Handling
```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

#### Empty States
```typescript
{data?.length === 0 && (
  <Card>
    <CardContent className="text-center py-8">
      <FileX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No items found</h3>
      <p className="text-muted-foreground mb-4">
        Get started by creating your first item.
      </p>
      <Button onClick={handleCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Create Item
      </Button>
    </CardContent>
  </Card>
)}
```

## 📋 Code Generation Requirements

### Phase-Based Development Workflow

#### Phase 0: Requirements Clarification
- Engage in conversational discovery to understand user needs
- Ask specific questions about core entities, actions, and goals
- Ensure clear specification before proceeding

#### Phase 1: Technical Planning
- Generate structured action plan with exact file paths
- Create database schema with workspace tenancy
- Plan component hierarchy and data flow

#### Phase 2: Code Generation
- Generate production-ready code (NO placeholders or TODOs)
- Follow exact file structure requirements
- Include comprehensive error handling
- Implement proper TypeScript types

#### Phase 3: Quality Validation
- Validate workspace tenancy compliance
- Check for security vulnerabilities
- Ensure proper error handling
- Verify component accessibility

### Code Quality Standards

#### TypeScript Requirements
```typescript
// ✅ CORRECT - Proper typing
interface UserData {
  id: string
  name: string
  email: string
  workspace_id: string
}

async function getUsers(workspaceId: string): Promise<UserData[]> {
  // Implementation
}

// ❌ FORBIDDEN - Any types or missing types
function getUsers(workspaceId: any): Promise<any> {
  // VIOLATION
}
```

#### Error Handling Pattern
```typescript
'use server'

export async function createItem(formData: FormData) {
  try {
    const supabase = createServerClient(cookies())
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { error: 'Authentication required' }
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return { error: 'Workspace access denied' }
    }
    
    // Process form data with validation
    const name = formData.get('name') as string
    if (!name?.trim()) {
      return { error: 'Name is required' }
    }
    
    const { data, error } = await supabase
      .from('items')
      .insert({
        name: name.trim(),
        workspace_id: workspaceId
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return { error: 'Failed to create item' }
    }
    
    return { data, success: true }
    
  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'An unexpected error occurred' }
  }
}
```

## 🔧 Environment Configuration

### Required Environment Variables
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Package.json Requirements
```json
{
  "name": "pria-generated-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0", 
    "react-dom": "19.0.0",
    "@supabase/ssr": "latest",
    "@supabase/supabase-js": "latest",
    "lucide-react": "latest",
    "tailwindcss": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "typescript": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "vitest": "latest",
    "@testing-library/react": "latest",
    "jsdom": "latest"
  }
}
```

## 🚫 Forbidden Practices

### Security Violations
- Missing workspace_id filters in database queries
- Hardcoded API keys or secrets in code
- Direct object references without authorization
- Client-side authentication logic
- Unvalidated user inputs

### Code Quality Violations
- Using `any` type in TypeScript
- Missing error handling
- TODO comments or placeholder code
- Console.log statements in production code
- Unused imports or variables

### Architecture Violations
- Creating new `components/ui/` files
- Direct database queries without Supabase client
- Missing middleware for protected routes
- Inline styles instead of Tailwind classes
- Non-responsive design patterns

## ✅ Success Checklist

Before completing any generated application, verify:

- [ ] All database queries include `workspace_id` filtering
- [ ] Authentication middleware protects all routes
- [ ] All components handle loading, error, and empty states
- [ ] TypeScript strict mode passes without errors
- [ ] All forms include proper validation
- [ ] Responsive design works on mobile devices
- [ ] No hardcoded secrets or API keys in code
- [ ] All external libraries are from approved list
- [ ] Component accessibility standards are met
- [ ] Database schema includes proper RLS policies

## 🎨 Example Application Structure

### Dashboard Layout
```typescript
// app/(dashboard)/layout.tsx
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        {/* Navigation */}
      </nav>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

### Data Fetching Pattern
```typescript
// app/(dashboard)/items/page.tsx
import { cookies } from 'next/headers'
import createServerClient from '@/lib/supabase/server'
import { ItemsList } from '@/components/items-list'

export default async function ItemsPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Authentication required</div>
  }

  const workspaceId = user.app_metadata?.workspace_id
  if (!workspaceId) {
    return <div>Workspace access denied</div>
  }

  const { data: items, error } = await supabase
    .from('items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    return <div>Error loading items</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Items</h1>
      <ItemsList items={items} />
    </div>
  )
}
```

---

## 🎯 Remember: Security First, User Experience Second, Performance Third

Every decision should prioritize:
1. **Security** - Proper authentication, authorization, and data protection
2. **User Experience** - Intuitive, accessible, and responsive interfaces  
3. **Performance** - Fast loading times and efficient resource usage
4. **Maintainability** - Clean, well-documented, and testable code

This document serves as the definitive guide for generating PRIA-compliant applications. Any deviation from these guidelines requires explicit approval and documentation of security implications.