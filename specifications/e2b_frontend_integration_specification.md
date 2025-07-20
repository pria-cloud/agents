# E2B Sandbox Frontend Integration Specification

## Overview

This specification defines how the PRIA frontend should integrate with the new E2B sandbox functionality for live code previews. The implementation replaces WebContainer-based previews with secure E2B cloud sandboxes that provide full Next.js development environments.

## Architecture

```
Frontend (React) → Supabase Realtime → PRIA Agents → E2B Sandbox (Next.js 15)
```

### Key Components

1. **E2B Sandbox Service**: Creates and manages cloud sandboxes
2. **Sandbox Event Service**: Broadcasts real-time updates via Supabase
3. **Frontend Integration**: Subscribes to events and displays sandbox URLs
4. **Database Storage**: Tracks sandbox instances and events

## Event System

### Channel Structure

The frontend subscribes to conversation-specific channels:

```typescript
const channelName = `conversation:${conversationId}`
```

### Event Types

```typescript
interface SandboxEvent {
  event_type: 'sandbox_created' | 'sandbox_ready' | 'sandbox_failed'
  conversation_id: string
  workspace_id: string
  sandbox_id?: string
  sandbox_url?: string
  message: string
  timestamp: string
  metadata?: any
}
```

### Event Flow

1. **sandbox_created**: Sandbox creation started
2. **sandbox_ready**: Sandbox is ready with live URL
3. **sandbox_failed**: Sandbox creation failed with error details

## Frontend Implementation

### 1. Supabase Realtime Setup

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Subscribe to sandbox events
const channel = supabase.channel(`conversation:${conversationId}`, {
  config: {
    broadcast: { self: false },
    presence: { key: 'sandbox_listener' }
  }
})

channel.on('broadcast', { event: 'sandbox_event' }, (payload) => {
  handleSandboxEvent(payload.payload as SandboxEvent)
}).subscribe()
```

### 2. React Hook for Sandbox Events

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface SandboxState {
  status: 'idle' | 'creating' | 'ready' | 'failed'
  sandboxUrl?: string
  message?: string
  error?: string
}

export function useSandboxEvents(conversationId: string, workspaceId: string) {
  const [sandboxState, setSandboxState] = useState<SandboxState>({ status: 'idle' })

  useEffect(() => {
    const channel = supabase.channel(`conversation:${conversationId}`)
    
    channel.on('broadcast', { event: 'sandbox_event' }, ({ payload }) => {
      const event = payload as SandboxEvent
      
      switch (event.event_type) {
        case 'sandbox_created':
          setSandboxState({
            status: 'creating',
            message: event.message
          })
          break
          
        case 'sandbox_ready':
          setSandboxState({
            status: 'ready',
            sandboxUrl: event.sandbox_url,
            message: event.message
          })
          break
          
        case 'sandbox_failed':
          setSandboxState({
            status: 'failed',
            error: event.message
          })
          break
      }
    }).subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [conversationId])

  return sandboxState
}
```

### 3. Sandbox Preview Component

```typescript
import { useSandboxEvents } from '@/hooks/useSandboxEvents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'

interface SandboxPreviewProps {
  conversationId: string
  workspaceId: string
  showIframe?: boolean
}

export function SandboxPreview({ 
  conversationId, 
  workspaceId, 
  showIframe = true 
}: SandboxPreviewProps) {
  const sandboxState = useSandboxEvents(conversationId, workspaceId)

  const renderContent = () => {
    switch (sandboxState.status) {
      case 'idle':
        return (
          <div className="text-center py-8 text-muted-foreground">
            Generate code to see live preview
          </div>
        )
        
      case 'creating':
        return (
          <div className="flex items-center justify-center py-8 space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{sandboxState.message}</span>
          </div>
        )
        
      case 'ready':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Live Preview Ready</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(sandboxState.sandboxUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in New Tab
              </Button>
            </div>
            
            {showIframe && sandboxState.sandboxUrl && (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={sandboxState.sandboxUrl}
                  className="w-full h-96"
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            )}
          </div>
        )
        
      case 'failed':
        return (
          <div className="flex items-center space-x-2 text-destructive py-8">
            <AlertCircle className="h-5 w-5" />
            <span>{sandboxState.error}</span>
          </div>
        )
        
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Preview</CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  )
}
```

### 4. Integration with Chat Interface

```typescript
import { SandboxPreview } from '@/components/SandboxPreview'

export function ChatInterface({ conversationId, workspaceId }: ChatProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chat Messages */}
      <div className="space-y-4">
        {/* Chat messages and input */}
      </div>
      
      {/* Live Preview Panel */}
      <div className="lg:sticky lg:top-4">
        <SandboxPreview 
          conversationId={conversationId}
          workspaceId={workspaceId}
          showIframe={true}
        />
      </div>
    </div>
  )
}
```

## Database Integration

### Sandbox Instances Table

```sql
CREATE TABLE sandbox_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sandbox_id TEXT NOT NULL,
  sandbox_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('creating', 'ready', 'failed')),
  template_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sandbox Events Table

```sql
CREATE TABLE sandbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('sandbox_created', 'sandbox_ready', 'sandbox_failed')),
  conversation_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  sandbox_id TEXT,
  sandbox_url TEXT,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security Considerations

### 1. Iframe Sandboxing

```typescript
<iframe
  src={sandboxUrl}
  sandbox="allow-scripts allow-same-origin allow-forms"
  className="w-full h-96"
  title="Live Preview"
/>
```

### 2. URL Validation

```typescript
function isValidSandboxUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname.endsWith('.e2b.dev')
  } catch {
    return false
  }
}
```

### 3. CSP Headers

```
Content-Security-Policy: frame-src *.e2b.dev; script-src 'self' 'unsafe-inline';
```

## Error Handling

### 1. Connection Errors

```typescript
channel.on('error', (error) => {
  console.error('Realtime connection error:', error)
  // Implement retry logic or fallback
})
```

### 2. Timeout Handling

```typescript
const SANDBOX_TIMEOUT = 5 * 60 * 1000 // 5 minutes

useEffect(() => {
  if (sandboxState.status === 'creating') {
    const timeout = setTimeout(() => {
      setSandboxState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Sandbox creation timed out'
      }))
    }, SANDBOX_TIMEOUT)

    return () => clearTimeout(timeout)
  }
}, [sandboxState.status])
```

## Performance Optimization

### 1. Connection Pooling

```typescript
// Reuse existing channels when possible
const getOrCreateChannel = (conversationId: string) => {
  const existing = channelCache.get(conversationId)
  if (existing) return existing
  
  const channel = supabase.channel(`conversation:${conversationId}`)
  channelCache.set(conversationId, channel)
  return channel
}
```

### 2. Cleanup

```typescript
useEffect(() => {
  return () => {
    // Clean up subscriptions
    channel.unsubscribe()
    channelCache.delete(conversationId)
  }
}, [conversationId])
```

## Testing

### 1. Mock Events for Development

```typescript
// For testing without actual sandbox creation
const mockSandboxEvent = (type: SandboxEvent['event_type']) => {
  const event: SandboxEvent = {
    event_type: type,
    conversation_id: 'test-conversation',
    workspace_id: 'test-workspace',
    sandbox_id: 'test-sandbox',
    sandbox_url: 'https://test-sandbox.e2b.dev',
    message: 'Test message',
    timestamp: new Date().toISOString()
  }
  
  handleSandboxEvent(event)
}
```

### 2. End-to-End Testing

```typescript
// Test the complete flow from code generation to preview
describe('E2B Sandbox Integration', () => {
  it('should create sandbox and display preview', async () => {
    // Trigger code generation
    // Wait for sandbox_created event
    // Wait for sandbox_ready event
    // Verify iframe src is set correctly
  })
})
```

## Migration from WebContainer

### 1. Feature Parity

| WebContainer Feature | E2B Equivalent |
|---------------------|----------------|
| In-browser execution | Cloud sandbox |
| HMR/Hot reload | Built-in dev server |
| File system access | File injection API |
| Package installation | npm install in sandbox |
| Process management | E2B commands API |

### 2. Migration Steps

1. Replace WebContainer subscription with Supabase Realtime
2. Update iframe src from local to E2B URL
3. Remove client-side file system management
4. Update error handling for network-based previews
5. Add loading states for sandbox creation

## Configuration

### Environment Variables

```bash
# Frontend .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Agent environment
E2B_API_KEY=your-e2b-api-key
E2B_TEMPLATE_ID=bslm087lozmkvjz6nwle
E2B_TEAM_ID=d9ae965a-2a35-4a01-bc6e-6ff76faaa12c
```

### Feature Flags

```typescript
const features = {
  e2bSandbox: process.env.NEXT_PUBLIC_ENABLE_E2B === 'true',
  webContainer: process.env.NEXT_PUBLIC_ENABLE_WEBCONTAINER === 'true'
}
```

This specification provides a complete guide for integrating the new E2B sandbox functionality into the PRIA frontend, ensuring real-time updates, proper error handling, and optimal user experience.