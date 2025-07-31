import { NextRequest, NextResponse } from 'next/server'
import { query } from '@anthropic-ai/claude-code'
import createServerClient from '@/lib/supabase/server'
import { e2bSandboxService } from '@/lib/services/e2b'

export const runtime = 'nodejs' // Claude Code SDK requires Node.js runtime, not Edge

// POST /api/claude/chat - Chat with Claude Code SDK
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { message, conversationId, sessionId, projectContext } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Create or get E2B sandbox for this session
    let sandboxId = projectContext?.sandboxId
    if (!sandboxId) {
      // Create new sandbox for this conversation
      const sandbox = await e2bSandboxService.createSandbox({
        sessionId: sessionId || conversationId || 'default',
        workspaceId: user.app_metadata?.workspace_id || user.id
      })
      sandboxId = sandbox.sandboxId
    }

    // Build the prompt for Claude Code SDK
    const prompt = `You are Claude Code, an AI assistant that helps build applications. 
    
User request: ${message}

Important guidelines:
- Generate production-ready code following PRIA platform standards
- Use Next.js 15+ with App Router
- Use TypeScript with strict mode
- Use Tailwind CSS for styling
- Include proper error handling
- Follow security best practices

When generating code:
- Create appropriate file structure
- Include all necessary imports
- Add helpful comments
- Provide clear explanations of what you're building`

    // Stream response from Claude Code SDK
    const messages = []
    const actions = []
    
    try {
      for await (const sdkMessage of query({
        prompt,
        options: {
          maxTurns: 1, // Single turn for chat-like interaction
          cwd: `/sandbox/${sandboxId}`, // Virtual working directory
          permissionMode: 'default'
        }
      })) {
        // Handle different message types from Claude Code SDK
        if (sdkMessage.type === 'assistant' && sdkMessage.message.content) {
          const content = Array.isArray(sdkMessage.message.content)
            ? sdkMessage.message.content.map(c => c.type === 'text' ? c.text : '').join('')
            : sdkMessage.message.content
          
          messages.push({
            role: 'assistant',
            content,
            timestamp: new Date().toISOString()
          })

          // Extract file operations from the content
          const fileMatches = content.matchAll(/Created file: (.*?)\\n|Modified file: (.*?)\\n|Wrote to (.*?):/g)
          for (const match of fileMatches) {
            const filePath = match[1] || match[2] || match[3]
            if (filePath) {
              actions.push({
                type: 'file_created',
                details: { path: filePath }
              })
            }
          }
        } else if (sdkMessage.type === 'result' && sdkMessage.subtype === 'success') {
          // Include the final result
          if (sdkMessage.result) {
            messages.push({
              role: 'system',
              content: `Operation completed successfully: ${sdkMessage.result}`,
              timestamp: new Date().toISOString()
            })
          }
        }
      }
    } catch (error) {
      console.error('Claude Code SDK error:', error)
      messages.push({
        role: 'assistant',
        content: 'I encountered an error while processing your request. Please try again.',
        timestamp: new Date().toISOString()
      })
    }

    // Save conversation to database
    if (conversationId) {
      await supabase
        .from('claude_operations')
        .insert({
          session_id: sessionId || conversationId,
          workspace_id: user.app_metadata?.workspace_id || user.id,
          operation_type: 'chat',
          status: 'completed',
          input_data: { message },
          output_data: { messages, actions },
          metadata: { sandboxId }
        })
    }

    return NextResponse.json({
      conversationId: conversationId || crypto.randomUUID(),
      messages,
      actions,
      sandboxId
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}