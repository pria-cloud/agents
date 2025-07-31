import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { E2BGitHubSetupService, E2BGitHubConfig } from '@/lib/services/e2b-github-setup'
import { E2BSandboxService } from '@/lib/services/e2b'

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
    const { action, sessionId, sandboxId, repositoryUrl, branch } = body

    if (!sessionId || !sandboxId) {
      return NextResponse.json({ 
        error: 'Session ID and Sandbox ID required' 
      }, { status: 400 })
    }

    // Get sandbox instance
    const e2bService = new E2BSandboxService()
    const sandbox = await e2bService.getSandbox(sandboxId)
    
    if (!sandbox) {
      return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
    }

    // Get GitHub auth from database
    const { data: githubAuth } = await supabase
      .from('github_auth')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!githubAuth) {
      return NextResponse.json({ 
        error: 'GitHub authentication required. Please connect your GitHub account first.' 
      }, { status: 401 })
    }

    // Decrypt access token
    const accessToken = await decryptToken(githubAuth.access_token)

    const config: E2BGitHubConfig = {
      sessionId,
      workspaceId,
      sandboxId,
      githubToken: accessToken,
      githubUsername: githubAuth.github_username,
      githubEmail: githubAuth.github_email,
      repositoryUrl,
      branch: branch || 'main'
    }

    switch (action) {
      case 'setup':
        // Complete GitHub setup in sandbox
        try {
          const setupResult = await E2BGitHubSetupService.setupGitHubInSandbox(sandbox, config)

          return NextResponse.json({
            success: setupResult.success,
            setup: {
              gitVersion: setupResult.gitVersion,
              userConfigured: setupResult.userConfigured,
              repositoryCloned: setupResult.repositoryCloned,
              sshKeyGenerated: setupResult.sshKeyGenerated,
              tokenConfigured: setupResult.tokenConfigured
            },
            errors: setupResult.errors || [],
            message: setupResult.success 
              ? 'GitHub setup completed successfully'
              : 'GitHub setup completed with issues'
          })

        } catch (error) {
          return NextResponse.json({ 
            success: false,
            error: `GitHub setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            setup: {
              gitVersion: null,
              userConfigured: false,
              repositoryCloned: false,
              sshKeyGenerated: false,
              tokenConfigured: false
            }
          }, { status: 500 })
        }

      case 'check_setup':
        // Check if GitHub is already set up
        try {
          const isSetup = await E2BGitHubSetupService.isGitHubSetup(sandbox)
          const gitConfig = await E2BGitHubSetupService.getGitConfig(sandbox)

          return NextResponse.json({
            success: true,
            isSetup,
            config: {
              gitVersion: gitConfig.version,
              userName: gitConfig.name,
              userEmail: gitConfig.email
            }
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Failed to check setup: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'verify_connection':
        // Verify GitHub connection
        try {
          // Test GitHub API connection
          const testResult = await sandbox.process.startAndWait(
            `curl -s -H "Authorization: Bearer ${accessToken}" https://api.github.com/user`
          )

          if (testResult.exitCode === 0) {
            const userInfo = JSON.parse(testResult.stdout)
            return NextResponse.json({
              success: true,
              connected: true,
              user: {
                login: userInfo.login,
                name: userInfo.name,
                email: userInfo.email
              },
              message: 'GitHub connection verified'
            })
          } else {
            return NextResponse.json({
              success: false,
              connected: false,
              message: 'GitHub connection failed'
            })
          }

        } catch (error) {
          return NextResponse.json({ 
            success: false,
            connected: false,
            error: `Connection verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }, { status: 500 })
        }

      case 'install_tools':
        // Install additional development tools
        try {
          console.log('[GITHUB-SETUP] Installing additional development tools...')
          
          // Install Node.js, npm, and development tools
          const installCommands = [
            'apt-get update',
            'curl -fsSL https://deb.nodesource.com/setup_18.x | bash -',
            'apt-get install -y nodejs',
            'npm install -g npm@latest',
            'npm install -g typescript tsx @types/node',
            'npm install -g @anthropic-ai/claude-code'
          ]

          const results = []
          for (const command of installCommands) {
            const result = await sandbox.process.startAndWait(command)
            results.push({
              command,
              success: result.exitCode === 0,
              output: result.stdout,
              error: result.stderr
            })
          }

          const allSuccess = results.every(r => r.success)
          
          return NextResponse.json({
            success: allSuccess,
            toolsInstalled: allSuccess,
            results,
            message: allSuccess 
              ? 'Development tools installed successfully' 
              : 'Some tools failed to install'
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Tool installation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      case 'create_project_structure':
        // Create PRIA-compliant project structure
        try {
          console.log('[GITHUB-SETUP] Creating project structure...')
          
          const structureCommands = [
            'mkdir -p /app',
            'cd /app && npm init -y',
            'cd /app && mkdir -p components lib app pages api',
            'cd /app && mkdir -p supabase/migrations',
            'cd /app && touch README.md .env.local .gitignore',
            'cd /app && echo "node_modules/\n.env.local\n.next/\ndist/" > .gitignore'
          ]

          for (const command of structureCommands) {
            const result = await sandbox.process.startAndWait(command)
            if (result.exitCode !== 0) {
              throw new Error(`Structure creation failed: ${result.stderr}`)
            }
          }

          // Create basic package.json for PRIA app
          const packageJson = {
            name: 'pria-target-app',
            version: '0.1.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
              lint: 'next lint'
            },
            dependencies: {
              'next': '^15.0.0',
              'react': '^18.0.0',
              'react-dom': '^18.0.0',
              '@supabase/supabase-js': '^2.0.0',
              'tailwindcss': '^3.0.0'
            },
            devDependencies: {
              '@types/node': '^20.0.0',
              '@types/react': '^18.0.0',
              'typescript': '^5.0.0',
              'eslint': '^8.0.0',
              'eslint-config-next': '^15.0.0'
            }
          }

          await sandbox.filesystem.writeTextFile(
            '/app/package.json',
            JSON.stringify(packageJson, null, 2)
          )

          return NextResponse.json({
            success: true,
            projectCreated: true,
            structure: {
              directories: ['components', 'lib', 'app', 'pages', 'api', 'supabase/migrations'],
              files: ['package.json', 'README.md', '.env.local', '.gitignore']
            },
            message: 'Project structure created successfully'
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Project structure creation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub setup API:', error)
    return NextResponse.json(
      { error: 'Failed to process GitHub setup request' },
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const sandboxId = searchParams.get('sandboxId')
    const action = searchParams.get('action') || 'status'

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    switch (action) {
      case 'status':
        // Get GitHub setup status for session
        const { data: setupHistory } = await supabase
          .from('github_sync_status')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('session_id', sessionId)
          .eq('sync_type', 'setup')
          .order('synced_at', { ascending: false })
          .limit(1)

        const latestSetup = setupHistory?.[0]
        
        return NextResponse.json({
          success: true,
          setup: {
            configured: !!latestSetup,
            status: latestSetup?.sync_status || 'not_configured',
            lastSetup: latestSetup?.synced_at,
            errors: latestSetup?.error_messages || []
          }
        })

      case 'sandbox_info':
        // Get sandbox information
        if (!sandboxId) {
          return NextResponse.json({ error: 'Sandbox ID required for sandbox_info' }, { status: 400 })
        }

        try {
          const e2bService = new E2BSandboxService()
          const sandbox = await e2bService.getSandbox(sandboxId)
          
          if (!sandbox) {
            return NextResponse.json({ error: 'Sandbox not found' }, { status: 404 })
          }

          // Check if GitHub is set up
          const isSetup = await E2BGitHubSetupService.isGitHubSetup(sandbox)
          const gitConfig = await E2BGitHubSetupService.getGitConfig(sandbox)

          return NextResponse.json({
            success: true,
            sandbox: {
              id: sandboxId,
              githubSetup: isSetup,
              gitConfig: {
                version: gitConfig.version,
                userName: gitConfig.name,
                userEmail: gitConfig.email
              }
            }
          })

        } catch (error) {
          return NextResponse.json({ 
            error: `Failed to get sandbox info: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error in GitHub setup GET API:', error)
    return NextResponse.json(
      { error: 'Failed to get GitHub setup information' },
      { status: 500 }
    )
  }
}

// Placeholder decryption function - replace with proper decryption in production
async function decryptToken(encryptedToken: string): Promise<string> {
  // In production, use proper decryption with a key management service
  return Buffer.from(encryptedToken, 'base64').toString('utf-8')
}