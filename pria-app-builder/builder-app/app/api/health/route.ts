import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Basic health check - verify environment and basic functionality
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'ANTHROPIC_API_KEY',
      'E2B_API_KEY'
    ]

    const issues: string[] = []
    const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])
    
    if (missingEnvVars.length > 0) {
      issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`)
    }

    // Check for template values
    const templateValues = requiredEnvVars.filter(key => 
      process.env[key]?.includes('your_') || 
      process.env[key]?.includes('template')
    )
    
    if (templateValues.length > 0) {
      issues.push(`Template environment variables detected: ${templateValues.join(', ')}`)
    }

    const isHealthy = issues.length === 0

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      issues: issues,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasClaude: !!process.env.ANTHROPIC_API_KEY,
        hasE2B: !!process.env.E2B_API_KEY
      }
    })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Also support POST for internal client compatibility
  return GET(request)
}