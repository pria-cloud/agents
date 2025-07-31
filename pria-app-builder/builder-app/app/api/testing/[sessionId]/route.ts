import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { TestGenerator, TestGenerationConfig } from '@/lib/testing/test-generator'
import { TestExecutor, TestExecutionConfig } from '@/lib/testing/test-executor'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Get test execution session
    const { data: testSession } = await supabase
      .from('test_execution_sessions')
      .select('*')
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!testSession) {
      return NextResponse.json({
        session: null,
        message: 'No test session found'
      })
    }

    // Get test suites
    const { data: testSuites } = await supabase
      .from('test_suites')
      .select(`
        *,
        test_cases (*)
      `)
      .eq('test_session_id', testSession.id)
      .eq('workspace_id', workspaceId)

    // Get test results
    const { data: testResults } = await supabase
      .from('test_execution_results')
      .select('*')
      .eq('test_session_id', testSession.id)
      .eq('workspace_id', workspaceId)

    // Aggregate results by test case
    const resultsByTestCase = testResults?.reduce((acc, result) => {
      acc[result.test_case_id] = result
      return acc
    }, {} as Record<string, any>) || {}

    // Enhance test suites with results
    const enhancedTestSuites = testSuites?.map(suite => ({
      ...suite,
      test_cases: suite.test_cases.map((testCase: any) => ({
        ...testCase,
        ...resultsByTestCase[testCase.id]
      }))
    })) || []

    return NextResponse.json({
      session: {
        ...testSession,
        test_suites: enhancedTestSuites
      },
      success: true
    })

  } catch (error) {
    console.error('[TESTING API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'generate_tests':
        return await generateTests(supabase, params.sessionId, workspaceId, data)
      case 'execute_tests':
        return await executeTests(supabase, params.sessionId, workspaceId, data)
      case 'update_test_case':
        return await updateTestCase(supabase, workspaceId, data)
      case 'delete_test_session':
        return await deleteTestSession(supabase, params.sessionId, workspaceId)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[TESTING API] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function generateTests(
  supabase: any,
  sessionId: string,
  workspaceId: string,
  data: { config: TestGenerationConfig }
) {
  try {
    // Get project files for test generation
    const { data: generatedFiles } = await supabase
      .from('generated_files')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)

    // Get requirements for context
    const { data: requirements } = await supabase
      .from('requirements')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)

    if (!generatedFiles || generatedFiles.length === 0) {
      return NextResponse.json({
        error: 'No generated files found for test generation'
      }, { status: 400 })
    }

    // Generate test suites
    const testSuites = await TestGenerator.generateTestSuites(
      generatedFiles,
      requirements || [],
      data.config
    )

    // Create test execution session
    const { data: testSession, error: sessionError } = await supabase
      .from('test_execution_sessions')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        status: 'queued',
        test_config: data.config,
        overall_results: {
          total_tests: testSuites.reduce((sum, suite) => sum + suite.test_cases.length, 0),
          passed_tests: 0,
          failed_tests: 0,
          skipped_tests: 0,
          coverage_percentage: 0,
          execution_time_ms: 0
        },
        metadata: {
          environment: 'test',
          node_version: process.version,
          framework_versions: {
            vitest: '1.0.0',
            playwright: '1.0.0'
          }
        }
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Failed to create test session:', sessionError)
      return NextResponse.json({ error: 'Failed to create test session' }, { status: 500 })
    }

    // Save test suites
    const suiteInserts = testSuites.map(suite => ({
      ...suite,
      workspace_id: workspaceId,
      test_session_id: testSession.id
    }))

    const { data: savedSuites, error: suitesError } = await supabase
      .from('test_suites')
      .insert(suiteInserts)
      .select()

    if (suitesError) {
      console.error('Failed to save test suites:', suitesError)
      return NextResponse.json({ error: 'Failed to save test suites' }, { status: 500 })
    }

    // Save test cases
    const testCaseInserts = []
    for (let i = 0; i < testSuites.length; i++) {
      const suite = testSuites[i]
      const savedSuite = savedSuites[i]
      
      for (const testCase of suite.test_cases) {
        testCaseInserts.push({
          ...testCase,
          workspace_id: workspaceId,
          test_suite_id: savedSuite.id,
          test_session_id: testSession.id
        })
      }
    }

    const { error: casesError } = await supabase
      .from('test_cases')
      .insert(testCaseInserts)

    if (casesError) {
      console.error('Failed to save test cases:', casesError)
      return NextResponse.json({ error: 'Failed to save test cases' }, { status: 500 })
    }

    // Return the complete session with test suites
    return NextResponse.json({
      session: {
        ...testSession,
        test_suites: testSuites
      },
      success: true,
      message: 'Tests generated successfully'
    })

  } catch (error) {
    console.error('[TESTING API] Test generation failed:', error)
    return NextResponse.json({
      error: 'Test generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function executeTests(
  supabase: any,
  sessionId: string,
  workspaceId: string,
  data: { suite_id?: string; config: TestExecutionConfig }
) {
  try {
    // Get the test session
    const { data: testSession } = await supabase
      .from('test_execution_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!testSession) {
      return NextResponse.json({ error: 'Test session not found' }, { status: 404 })
    }

    // Get test suites to execute
    let suitesQuery = supabase
      .from('test_suites')
      .select(`
        *,
        test_cases (*)
      `)
      .eq('test_session_id', testSession.id)
      .eq('workspace_id', workspaceId)

    if (data.suite_id) {
      suitesQuery = suitesQuery.eq('id', data.suite_id)
    }

    const { data: testSuites } = await suitesQuery

    if (!testSuites || testSuites.length === 0) {
      return NextResponse.json({ error: 'No test suites found' }, { status: 404 })
    }

    // Update session status to running
    await supabase
      .from('test_execution_sessions')
      .update({
        status: 'running',
        start_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', testSession.id)

    // Execute tests asynchronously
    executeTestsAsync(supabase, testSession.id, testSuites, data.config)

    return NextResponse.json({
      session: {
        ...testSession,
        status: 'running',
        test_suites: testSuites
      },
      success: true,
      message: 'Test execution started'
    })

  } catch (error) {
    console.error('[TESTING API] Test execution failed:', error)
    return NextResponse.json({
      error: 'Test execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function executeTestsAsync(
  supabase: any,
  testSessionId: string,
  testSuites: any[],
  config: TestExecutionConfig
) {
  try {
    // Execute tests using TestExecutor
    const executionSession = await TestExecutor.executeTestSession(
      testSessionId,
      '', // workspaceId will be fetched from session
      testSuites,
      config
    )

    // Update test session with results
    await supabase
      .from('test_execution_sessions')
      .update({
        status: executionSession.status,
        end_time: executionSession.end_time,
        overall_results: executionSession.overall_results,
        coverage_summary: executionSession.coverage_summary,
        performance_summary: executionSession.performance_summary,
        error_logs: executionSession.error_logs,
        warnings: executionSession.warnings,
        updated_at: new Date().toISOString()
      })
      .eq('id', testSessionId)

    // Save individual test results
    const resultInserts = executionSession.individual_results.map(result => ({
      ...result,
      test_session_id: testSessionId,
      workspace_id: '', // Will be filled by trigger
      created_at: new Date().toISOString()
    }))

    if (resultInserts.length > 0) {
      await supabase
        .from('test_execution_results')
        .insert(resultInserts)
    }

    // Update test suites status
    for (const suite of testSuites) {
      const suiteResults = executionSession.individual_results.filter(
        r => suite.test_cases.some((tc: any) => tc.id === r.test_case_id)
      )
      
      const hasFailures = suiteResults.some(r => r.status === 'failed')
      const allCompleted = suiteResults.length === suite.test_cases.length

      await supabase
        .from('test_suites')
        .update({
          status: hasFailures ? 'failed' : allCompleted ? 'completed' : 'running',
          results: {
            total_tests: suiteResults.length,
            passed_tests: suiteResults.filter(r => r.status === 'passed').length,
            failed_tests: suiteResults.filter(r => r.status === 'failed').length,
            skipped_tests: suiteResults.filter(r => r.status === 'skipped').length,
            coverage_percentage: 0, // Calculate from coverage data
            execution_time_ms: suiteResults.reduce((sum, r) => sum + r.execution_time_ms, 0),
            errors: suiteResults.filter(r => r.error_message).map(r => r.error_message!)
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', suite.id)
    }

  } catch (error) {
    console.error('[TESTING API] Async test execution failed:', error)
    
    // Update session with error status
    await supabase
      .from('test_execution_sessions')
      .update({
        status: 'failed',
        end_time: new Date().toISOString(),
        error_logs: [error instanceof Error ? error.message : 'Unknown error'],
        updated_at: new Date().toISOString()
      })
      .eq('id', testSessionId)
  }
}

async function updateTestCase(
  supabase: any,
  workspaceId: string,
  data: { test_case_id: string; updates: any }
) {
  try {
    const { data: updatedTestCase, error } = await supabase
      .from('test_cases')
      .update({
        ...data.updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.test_case_id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update test case:', error)
      return NextResponse.json({ error: 'Failed to update test case' }, { status: 500 })
    }

    return NextResponse.json({
      test_case: updatedTestCase,
      success: true,
      message: 'Test case updated successfully'
    })

  } catch (error) {
    console.error('[TESTING API] Test case update failed:', error)
    return NextResponse.json({ error: 'Test case update failed' }, { status: 500 })
  }
}

async function deleteTestSession(
  supabase: any,
  sessionId: string,
  workspaceId: string
) {
  try {
    // Delete test session (cascade will handle related records)
    const { error } = await supabase
      .from('test_execution_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Failed to delete test session:', error)
      return NextResponse.json({ error: 'Failed to delete test session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Test session deleted successfully'
    })

  } catch (error) {
    console.error('[TESTING API] Test session deletion failed:', error)
    return NextResponse.json({ error: 'Test session deletion failed' }, { status: 500 })
  }
}