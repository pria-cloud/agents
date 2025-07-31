import { NextRequest, NextResponse } from 'next/server'
import { runQuickE2ETest, runHealthCheck } from '@/lib/testing/e2e-workflow'
import { checkRateLimit } from '@/lib/validation/input-sanitizer'

export async function POST(request: NextRequest) {
  try {
    const { testType = 'health', config = {} } = await request.json()

    // Rate limiting for testing endpoint
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(`e2e-test:${clientIP}`, 5, 300000) // 5 tests per 5 minutes
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded for testing endpoint',
          resetTime: rateLimitCheck.resetTime 
        },
        { status: 429 }
      )
    }

    if (testType === 'health') {
      // Quick health check
      const healthResult = await runHealthCheck()
      
      return NextResponse.json({
        type: 'health_check',
        timestamp: new Date().toISOString(),
        result: healthResult,
        recommendations: healthResult.healthy 
          ? ['All systems operational'] 
          : [
              'Fix environment variable issues first',
              'Check SETUP_CREDENTIALS.md for guidance',
              'Ensure all services are accessible'
            ]
      })
    }

    if (testType === 'full') {
      // Full E2E workflow test
      const testResults = await runQuickE2ETest({
        skipCredentialCheck: false,
        timeoutMs: 180000, // 3 minutes for API context
        retryAttempts: 2,
        logLevel: 'info',
        ...config
      })

      return NextResponse.json({
        type: 'full_e2e_test',
        timestamp: new Date().toISOString(),
        result: testResults,
        summary: {
          success: testResults.overall.success,
          duration: `${Math.round(testResults.overall.totalDuration / 1000)}s`,
          completion: `${testResults.overall.completedSteps}/${testResults.overall.totalSteps} steps`,
          issues: testResults.errors.length + testResults.warnings.length
        },
        nextSteps: testResults.overall.success 
          ? [
              'All tests passed! Your PRIA App Builder is ready.',
              'Try creating a workspace and starting a development session.',
              'Explore Claude Code integration for app generation.'
            ]
          : [
              'Review failed test steps above',
              'Check environment variables and service connectivity',
              'Run health check first to identify issues',
              'Consult SETUP_CREDENTIALS.md for configuration help'
            ]
      })
    }

    return NextResponse.json(
      { error: 'Invalid test type. Use "health" or "full"' },
      { status: 400 }
    )

  } catch (error) {
    console.error('E2E test API error:', error)
    return NextResponse.json(
      { 
        error: 'Test execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Simple health check via GET request
  try {
    const healthResult = await runHealthCheck()
    
    return NextResponse.json({
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      issues: healthResult.issues,
      endpoints: {
        health_check: 'POST /api/test/e2e with {"testType": "health"}',
        full_test: 'POST /api/test/e2e with {"testType": "full"}'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}