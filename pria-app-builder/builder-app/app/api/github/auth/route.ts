import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createGitHubIntegration } from '@/lib/services/github-integration'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { action, accessToken, clientId } = body

    switch (action) {
      case 'authenticate':
        // Store access token
        if (!accessToken) {
          return NextResponse.json({ error: 'Access token required' }, { status: 400 })
        }

        // Initialize GitHub service with token
        const github = createGitHubIntegration({ accessToken })
        
        // Get user info
        const githubUser = await github.getCurrentUser()
        if (!githubUser) {
          return NextResponse.json({ error: 'Failed to authenticate with GitHub' }, { status: 400 })
        }

        // Store auth info in database (encrypted)
        const { error: authError } = await supabase
          .from('github_auth')
          .upsert({
            workspace_id: workspaceId,
            user_id: user.id,
            github_user_id: githubUser.id,
            github_username: githubUser.login,
            github_email: githubUser.email,
            access_token: await encryptToken(accessToken),
            token_type: 'oauth',
            scopes: ['repo', 'read:user'],
            updated_at: new Date().toISOString()
          })

        if (authError) {
          console.error('Failed to store GitHub auth:', authError)
          return NextResponse.json({ error: 'Failed to store authentication' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          user: githubUser,
          message: 'Successfully authenticated with GitHub'
        })

      case 'device_flow':
        // Initiate OAuth device flow
        if (!clientId) {
          return NextResponse.json({ error: 'Client ID required for device flow' }, { status: 400 })
        }

        const deviceGitHub = createGitHubIntegration({ clientId })
        
        // This would typically return verification info for the user
        // For now, return instructions
        return NextResponse.json({
          success: true,
          instructions: 'Device flow authentication requires additional implementation',
          clientId
        })

      case 'check_auth':
        // Check if user has valid GitHub auth
        const { data: existingAuth } = await supabase
          .from('github_auth')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .single()

        if (!existingAuth) {
          return NextResponse.json({
            authenticated: false,
            message: 'No GitHub authentication found'
          })
        }

        // Verify token is still valid
        const checkGitHub = createGitHubIntegration({ 
          accessToken: await decryptToken(existingAuth.access_token) 
        })
        
        try {
          const currentUser = await checkGitHub.getCurrentUser()
          return NextResponse.json({
            authenticated: true,
            user: {
              login: existingAuth.github_username,
              id: existingAuth.github_user_id,
              email: existingAuth.github_email
            },
            expiresAt: existingAuth.expires_at
          })
        } catch (error) {
          // Token might be expired or revoked
          return NextResponse.json({
            authenticated: false,
            message: 'GitHub token is invalid or expired'
          })
        }

      case 'revoke':
        // Revoke GitHub authentication
        const { error: revokeError } = await supabase
          .from('github_auth')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)

        if (revokeError) {
          return NextResponse.json({ error: 'Failed to revoke authentication' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'GitHub authentication revoked'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub auth API:', error)
    return NextResponse.json(
      { error: 'Failed to process GitHub authentication' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }

    // Get GitHub auth status
    const { data: githubAuth } = await supabase
      .from('github_auth')
      .select('github_username, github_email, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!githubAuth) {
      return NextResponse.json({
        authenticated: false,
        message: 'No GitHub authentication found'
      })
    }

    return NextResponse.json({
      authenticated: true,
      github_username: githubAuth.github_username,
      github_email: githubAuth.github_email,
      connected_at: githubAuth.created_at,
      last_used: githubAuth.updated_at
    })

  } catch (error) {
    console.error('Error getting GitHub auth status:', error)
    return NextResponse.json(
      { error: 'Failed to get authentication status' },
      { status: 500 }
    )
  }
}

// Placeholder encryption functions - replace with proper encryption in production
async function encryptToken(token: string): Promise<string> {
  // In production, use proper encryption with a key management service
  return Buffer.from(token).toString('base64')
}

async function decryptToken(encryptedToken: string): Promise<string> {
  // In production, use proper decryption with a key management service
  return Buffer.from(encryptedToken, 'base64').toString('utf-8')
}