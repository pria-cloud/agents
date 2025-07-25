# Local Testing Setup: Claude Code E2B

This guide helps you test the Claude Code E2B integration locally before integrating into your PRIA frontend.

## 🎯 Testing Strategy

We'll create a minimal Next.js test application that simulates the PRIA environment, allowing you to:
- Test the Claude Code E2B components
- Validate API routes and database integration
- Verify real-time updates and progress tracking
- Test both business and developer modes
- Ensure proper authentication and workspace isolation

## 🚀 Quick Setup

### Step 1: Create Test Application

```bash
# Navigate to your testing directory
cd /path/to/your/testing/area

# Create new Next.js app
npx create-next-app@latest claude-code-test --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd claude-code-test

# Install required dependencies
npm install @supabase/ssr @supabase/supabase-js @anthropic-ai/sdk lucide-react
npm install class-variance-authority clsx tailwind-merge

# Install shadcn/ui
npx shadcn@latest init

# Install required shadcn components
npx shadcn@latest add button card input textarea badge tabs progress alert scroll-area
```

### Step 2: Environment Setup

Create `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# E2B Configuration (REQUIRED for full testing)
E2B_API_KEY=your_e2b_api_key
E2B_TEMPLATE_ID=your_e2b_template_id

# Testing Mode (set to 'mock' for UI testing without E2B, 'full' for complete integration)
TESTING_MODE=mock

# Test Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
TEST_WORKSPACE_ID=550e8400-e29b-41d4-a716-446655440000
TEST_USER_ID=550e8400-e29b-41d4-a716-446655440001
```

### Step 3: Copy Components

```bash
# From your claude-code-e2b directory
cp -r components/* claude-code-test/src/components/
cp -r hooks/* claude-code-test/src/hooks/
cp -r src/* claude-code-test/src/lib/claude-code/
```

### Step 4: Create Test Database Schema

Execute this in your Supabase SQL Editor:

```sql
-- Create test workspace (if not exists)
CREATE TABLE IF NOT EXISTS workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert test workspace
INSERT INTO workspace (id, name) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Test Workspace')
ON CONFLICT (id) DO NOTHING;

-- Claude Code tables (copy from integration guide)
CREATE TABLE IF NOT EXISTS claude_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspace(id),
    user_id UUID NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('business', 'developer')),
    status TEXT NOT NULL CHECK (status IN ('discovering', 'planning', 'generating', 'reviewing', 'completed')),
    requirements JSONB,
    specification JSONB,
    e2b_sandbox_id TEXT,
    e2b_sandbox_url TEXT,
    git_repository_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claude_progress_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES claude_sessions(id),
    workspace_id UUID NOT NULL REFERENCES workspace(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE claude_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_progress_events ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for testing
CREATE POLICY "test_policy_sessions" ON claude_sessions FOR ALL USING (true);
CREATE POLICY "test_policy_events" ON claude_progress_events FOR ALL USING (true);
```

## 🧪 Create Test Files

### Test API Routes

**`src/app/api/claude-sessions/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

// Mock user context for testing
const TEST_USER = {
  id: process.env.TEST_USER_ID!,
  workspace_id: process.env.TEST_WORKSPACE_ID!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode, requirements } = body

    console.log('Creating test session:', { mode, requirements })

    const result = await supabaseIntegration.createSession({
      workspace_id: TEST_USER.workspace_id,
      user_id: TEST_USER.id,
      mode,
      requirements
    })

    if (result.error) {
      console.error('Session creation error:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ 
      session_id: result.data?.id,
      session: result.data 
    })
  } catch (error) {
    console.error('Failed to create Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 10

    const result = await supabaseIntegration.getWorkspaceSessions(TEST_USER.workspace_id, {
      limit
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ sessions: result.data })
  } catch (error) {
    console.error('Failed to get Claude sessions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**`src/app/api/claude-sessions/[sessionId]/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const result = await supabaseIntegration.getSession(params.sessionId, TEST_WORKSPACE_ID)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ session: result.data })
  } catch (error) {
    console.error('Failed to get Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const updates = await request.json()
    const result = await supabaseIntegration.updateSession(params.sessionId, updates)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ session: result.data })
  } catch (error) {
    console.error('Failed to update Claude session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**`src/app/api/claude-sessions/[sessionId]/progress/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID!

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const result = await supabaseIntegration.getProgressEvents(
      params.sessionId, 
      TEST_WORKSPACE_ID
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ progress: result.data })
  } catch (error) {
    console.error('Failed to get progress events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**`src/app/api/claude-sessions/chat/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseIntegration } from '@/lib/claude-code/supabase-integration'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, user_input, context } = body

    console.log('Chat request:', { session_id, user_input })

    // Mock Claude response for testing
    const mockResponse = {
      response: `I understand you want to create: "${user_input}". Let me ask a few clarifying questions:\n\n1. Who will be the primary users of this application?\n2. What are the main features you need?\n3. Do you have any specific design preferences?`,
      type: 'clarification',
      confidence_score: 0.7,
      suggestions: [
        'It will be used by our team members',
        'External customers will use it',
        'Both internal and external users'
      ],
      extracted_requirements: {
        type: 'web_application',
        user_input: user_input,
        complexity: 'medium'
      },
      next_steps: [
        'Gather user requirements',
        'Define core features',
        'Create technical specification'
      ]
    }

    // Log progress event
    await supabaseIntegration.logProgressEvent({
      session_id,
      workspace_id: process.env.TEST_WORKSPACE_ID!,
      event_type: 'chat_message',
      event_data: {
        user_input,
        response: mockResponse.response,
        confidence: mockResponse.confidence_score
      }
    })

    return NextResponse.json(mockResponse)
  } catch (error) {
    console.error('Failed to process chat:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Test Main Page

**`src/app/page.tsx`:**

```typescript
'use client'

import { useState } from 'react'
import { ClaudeCodeInterface } from '@/components/claude-code-interface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Code2, TestTube, Database, Zap } from 'lucide-react'

export default function TestPage() {
  const [currentSession, setCurrentSession] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<any[]>([])

  const runTests = async () => {
    const tests = [
      {
        name: 'Database Connection',
        test: async () => {
          const response = await fetch('/api/claude-sessions')
          return response.ok
        }
      },
      {
        name: 'Session Creation',
        test: async () => {
          const response = await fetch('/api/claude-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'business', requirements: { test: true } })
          })
          const data = await response.json()
          if (data.session_id) {
            setCurrentSession(data.session_id)
            return true
          }
          return false
        }
      },
      {
        name: 'Chat API',
        test: async () => {
          if (!currentSession) return false
          const response = await fetch('/api/claude-sessions/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: currentSession,
              user_input: 'Test chat message'
            })
          })
          return response.ok
        }
      }
    ]

    const results = []
    for (const test of tests) {
      try {
        const passed = await test.test()
        results.push({ name: test.name, passed, error: null })
      } catch (error) {
        results.push({ name: test.name, passed: false, error: error.message })
      }
    }

    setTestResults(results)
  }

  if (currentSession) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TestTube className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold">Claude Code E2B Test</h1>
                <p className="text-muted-foreground">Session: {currentSession}</p>
              </div>
            </div>
            <Button onClick={() => setCurrentSession(null)} variant="outline">
              Back to Tests
            </Button>
          </div>

          <ClaudeCodeInterface
            workspaceId={process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID || ''}
            userId={process.env.NEXT_PUBLIC_TEST_USER_ID || ''}
            sessionId={currentSession}
            onSessionCreated={setCurrentSession}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <TestTube className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold">Claude Code E2B Test Environment</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Test the Claude Code E2B integration before PRIA deployment
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-semibold">Database</h3>
              <p className="text-sm text-muted-foreground">Supabase integration</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Code2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Components</h3>
              <p className="text-sm text-muted-foreground">React UI components</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-semibold">Real-time</h3>
              <p className="text-sm text-muted-foreground">Live progress updates</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <TestTube className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <h3 className="font-semibold">API Routes</h3>
              <p className="text-sm text-muted-foreground">Backend endpoints</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                System Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runTests} className="w-full" size="lg">
                Run Integration Tests
              </Button>

              {testResults.length > 0 && (
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <span className="font-medium">{result.name}</span>
                      <Badge variant={result.passed ? 'default' : 'destructive'}>
                        {result.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Manual Testing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Test the full Claude Code E2B experience
              </p>

              <Button 
                onClick={() => setCurrentSession('new')} 
                className="w-full" 
                size="lg"
                variant="outline"
              >
                Start New Session
              </Button>

              <div className="text-sm space-y-2">
                <h4 className="font-medium">Test Scenarios:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Business mode conversation flow</li>
                  <li>Developer mode interface</li>
                  <li>Real-time progress updates</li>
                  <li>Mode switching</li>
                  <li>Error handling</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Environment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Workspace ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {process.env.NEXT_PUBLIC_TEST_WORKSPACE_ID || 'Not set'}
                </div>
              </div>
              <div>
                <div className="font-medium">User ID</div>
                <div className="text-muted-foreground font-mono text-xs">
                  {process.env.NEXT_PUBLIC_TEST_USER_ID || 'Not set'}
                </div>
              </div>
              <div>
                <div className="font-medium">Supabase</div>
                <div className="text-muted-foreground">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Connected' : 'Not configured'}
                </div>
              </div>
              <div>
                <div className="font-medium">Claude API</div>
                <div className="text-muted-foreground">
                  {process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Missing Component Stubs

Create these missing components that are referenced:

**`src/components/progress-sidebar.tsx`:**

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface ProgressSidebarProps {
  session: any
  progress: any[]
  mode: 'business' | 'developer'
}

export function ProgressSidebar({ session, progress, mode }: ProgressSidebarProps) {
  const getProgress = () => {
    switch (session?.status) {
      case 'discovering': return 20
      case 'planning': return 40
      case 'generating': return 70
      case 'reviewing': return 90
      case 'completed': return 100
      default: return 0
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{getProgress()}%</span>
          </div>
          <Progress value={getProgress()} />
        </div>

        {session && (
          <div className="space-y-2">
            <Badge variant="secondary">
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Mode: {session.mode}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Events</h4>
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet</p>
          ) : (
            <div className="space-y-1">
              {progress.slice(-5).map((event, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{event.event_type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

**`src/components/live-preview.tsx`:**

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, ExternalLink } from 'lucide-react'

interface LivePreviewProps {
  sandboxUrl: string
  status: string
}

export function LivePreview({ sandboxUrl, status }: LivePreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sandboxUrl ? (
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded border flex items-center justify-center">
              <iframe 
                src={sandboxUrl} 
                className="w-full h-full rounded"
                title="Live Preview"
              />
            </div>
            <Button 
              onClick={() => window.open(sandboxUrl, '_blank')} 
              className="w-full"
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded border flex items-center justify-center">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preview will appear when ready
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**`src/components/developer-interface.tsx`:**

```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code2, Terminal, GitBranch, MessageSquare } from 'lucide-react'
import { RequirementChat } from './requirement-chat'

interface DeveloperInterfaceProps {
  session: any
  progress: any[]
  workspaceId: string
  userId: string
}

export function DeveloperInterface({ session, progress, workspaceId, userId }: DeveloperInterfaceProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">File explorer will appear here</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Git integration will appear here</p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="code">Code Editor</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat">
            <RequirementChat 
              sessionId={session?.id || ''}
              mode="developer"
              workspaceId={workspaceId}
              userId={userId}
            />
          </TabsContent>
          
          <TabsContent value="code">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Code editor will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="terminal">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Terminal will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Build Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Build information will appear here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

## 🏃‍♂️ Running the Tests

```bash
# Start the test application
npm run dev

# Open http://localhost:3000
# Run the integration tests
# Test manual user flows
```

## 🔍 What to Test

### Automated Tests
- ✅ Database connectivity
- ✅ Session creation/retrieval
- ✅ API route functionality
- ✅ Progress tracking

### Manual Tests
- ✅ Mode selection (Business vs Developer)
- ✅ Chat interface functionality
- ✅ Real-time progress updates
- ✅ Component rendering
- ✅ Error handling
- ✅ Mode switching

### Integration Tests
- ✅ Supabase RLS policies
- ✅ Real-time subscriptions
- ✅ Session state management
- ✅ UI responsiveness

## 🐛 Common Issues & Solutions

**Database Connection Issues:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Verify RLS policies in Supabase dashboard
```

**Component Import Errors:**
```bash
# Make sure all shadcn components are installed
npx shadcn-ui@latest add button card input textarea badge tabs progress alert scroll-area
```

**Real-time Not Working:**
- Check Supabase real-time is enabled
- Verify channel names match
- Check browser console for WebSocket errors

## ✅ Testing Checklist

Before PRIA integration:

- [ ] All automated tests pass
- [ ] Business mode chat works
- [ ] Developer mode interface loads
- [ ] Real-time updates functioning
- [ ] Error boundaries catch errors
- [ ] Database queries use workspace isolation
- [ ] API routes return proper responses
- [ ] Components render without errors
- [ ] Mode switching works smoothly
- [ ] Progress tracking is accurate

Once all tests pass, you can confidently integrate into your PRIA frontend!