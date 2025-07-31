import { NextRequest, NextResponse } from 'next/server'
import E2BSandboxManager from '@/lib/e2b/sandbox-manager'
import { getE2BSandboxConfig } from '@/lib/e2b/template-config'

export async function GET(request: NextRequest) {
  try {
    console.log('[CLI TEST] Starting E2B CLI workaround test...')
    
    // Validate required environment variables
    if (!process.env.E2B_API_KEY) {
      return NextResponse.json(
        { error: 'E2B_API_KEY environment variable is required' },
        { status: 500 }
      )
    }
    
    if (!process.env.E2B_TEMPLATE_ID) {
      return NextResponse.json(
        { error: 'E2B_TEMPLATE_ID environment variable is required' },
        { status: 500 }
      )
    }
    
    const results: any = {
      timestamp: new Date().toISOString(),
      templateId: process.env.E2B_TEMPLATE_ID,
      steps: []
    }
    
    // Step 1: Initialize sandbox manager
    results.steps.push({ step: 1, name: 'Initialize Sandbox Manager', status: 'starting' })
    
    const config = getE2BSandboxConfig()
    const manager = new E2BSandboxManager(config)
    
    results.config = {
      template: config.template,
      timeoutMs: config.timeoutMs
    }
    results.steps[0].status = 'completed'
    
    // Step 2: Test CLI manager availability
    results.steps.push({ step: 2, name: 'Test CLI Manager Availability', status: 'starting' })
    
    const cliTest = await manager.testCLIManager()
    results.cliManagerTest = cliTest
    
    if (!cliTest.available) {
      results.steps[1].status = 'failed'
      results.steps[1].error = cliTest.error
      return NextResponse.json(results)
    }
    
    results.steps[1].status = 'completed'
    
    // Step 3: Create test sandbox
    results.steps.push({ step: 3, name: 'Create Test Sandbox', status: 'starting' })
    
    const sessionId = `test-cli-api-${Date.now()}`
    const testMetadata = {
      workspaceId: 'test-workspace-api',
      projectName: 'test-cli-api-project',
      userId: 'test-api-user'
    }
    
    let environment
    try {
      environment = await manager.createSandbox(sessionId, testMetadata)
      
      results.sandbox = {
        sessionId,
        environmentId: environment.id,
        status: environment.status,
        workingDirectory: environment.workingDirectory,
        metadata: environment.metadata
      }
      results.steps[2].status = 'completed'
    } catch (error) {
      results.steps[2].status = 'failed'
      results.steps[2].error = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json(results)
    }
    
    // Step 4: Test command execution
    results.steps.push({ step: 4, name: 'Test Command Execution', status: 'starting' })
    
    try {
      const nodeVersionResult = await manager.executeCommand(sessionId, 'node --version')
      const nodeVersion = nodeVersionResult.stdout.trim()
      
      results.commandTests = {
        nodeVersion: {
          command: 'node --version',
          result: nodeVersion,
          exitCode: nodeVersionResult.exitCode,
          isCorrectVersion: nodeVersion.startsWith('v22.')
        }
      }
      
      // Test PRIA template structure
      const templateCheck = await manager.executeCommand(
        sessionId,
        'ls -la /home/user/template/ 2>/dev/null | head -3 || echo "NOT_FOUND"'
      )
      
      const scriptsCheck = await manager.executeCommand(
        sessionId,
        'ls -la /home/user/scripts/ 2>/dev/null | head -3 || echo "NOT_FOUND"'
      )
      
      const initScriptCheck = await manager.executeCommand(
        sessionId,
        'test -f /home/user/scripts/init-pria-project.sh && echo "FOUND" || echo "NOT_FOUND"'
      )
      
      results.templateTests = {
        templateDirectory: {
          found: !templateCheck.stdout.includes('NOT_FOUND'),
          output: templateCheck.stdout.trim()
        },
        scriptsDirectory: {
          found: !scriptsCheck.stdout.includes('NOT_FOUND'),
          output: scriptsCheck.stdout.trim()
        },
        initScript: {
          found: initScriptCheck.stdout.trim() === 'FOUND',
          output: initScriptCheck.stdout.trim()
        }
      }
      
      results.steps[3].status = 'completed'
    } catch (error) {
      results.steps[3].status = 'failed'
      results.steps[3].error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Step 5: Test sandbox reconnection
    results.steps.push({ step: 5, name: 'Test Sandbox Reconnection', status: 'starting' })
    
    try {
      const retrievedEnvironment = await manager.getSandbox(sessionId)
      
      results.reconnectionTest = {
        success: !!retrievedEnvironment,
        environmentId: retrievedEnvironment?.id,
        status: retrievedEnvironment?.status
      }
      
      results.steps[4].status = 'completed'
    } catch (error) {
      results.steps[4].status = 'failed'
      results.steps[4].error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Step 6: Clean up
    results.steps.push({ step: 6, name: 'Clean Up Sandbox', status: 'starting' })
    
    try {
      await manager.terminateSandbox(sessionId)
      results.steps[5].status = 'completed'
    } catch (error) {
      results.steps[5].status = 'failed'
      results.steps[5].error = error instanceof Error ? error.message : 'Unknown error'
    }
    
    // Determine overall test result
    const allStepsCompleted = results.steps.every((step: any) => step.status === 'completed')
    const hasCorrectNodeVersion = results.commandTests?.nodeVersion?.isCorrectVersion
    const hasInitScript = results.templateTests?.initScript?.found
    
    results.summary = {
      overall: allStepsCompleted && hasCorrectNodeVersion && hasInitScript ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      cliWorkaroundWorking: allStepsCompleted,
      customTemplateWorking: hasCorrectNodeVersion && hasInitScript,
      allTestsPassed: allStepsCompleted && hasCorrectNodeVersion && hasInitScript
    }
    
    console.log('[CLI TEST] Test completed:', results.summary)
    
    return NextResponse.json(results)
    
  } catch (error) {
    console.error('[CLI TEST] Test failed with error:', error)
    
    return NextResponse.json(
      {
        error: 'CLI test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to run the CLI test.' },
    { status: 405 }
  )
}