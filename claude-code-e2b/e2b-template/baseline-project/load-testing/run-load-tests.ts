#!/usr/bin/env tsx

import { performance } from 'perf_hooks'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { LoadTestSuite, LoadTestResult } from './load-test-suite'
import { TestScenarios } from './test-scenarios'
import { logger } from '@/lib/monitoring/logger'

interface TestRunConfig {
  baseUrl?: string
  authToken?: string
  outputDir?: string
  testSuite?: 'smoke' | 'production' | 'stress' | 'endurance' | 'full'
  parallel?: boolean
  categories?: string[]
}

/**
 * Main entry point for running load tests
 */
async function runLoadTests(config: TestRunConfig = {}) {
  const {
    baseUrl = process.env.LOAD_TEST_BASE_URL || 'http://localhost:3000',
    authToken = process.env.LOAD_TEST_AUTH_TOKEN,
    outputDir = './load-test-results',
    testSuite = 'smoke',
    parallel = false,
    categories = []
  } = config

  console.log('🚀 Starting PRIA Platform Load Tests')
  console.log(`📍 Target URL: ${baseUrl}`)
  console.log(`🔧 Test Suite: ${testSuite}`)
  console.log(`⚡ Parallel: ${parallel}`)
  console.log('=' * 50)

  const startTime = performance.now()
  
  try {
    // Initialize test components
    const loadTester = new LoadTestSuite(baseUrl)
    const scenarios = new TestScenarios(baseUrl, authToken)

    // Get test configurations based on suite type
    let testConfigs = getTestConfigs(scenarios, testSuite, categories)

    if (testConfigs.length === 0) {
      console.error('❌ No test configurations found for the specified suite/categories')
      process.exit(1)
    }

    console.log(`📋 Running ${testConfigs.length} test scenarios`)
    console.log('')

    // Create output directory
    await mkdir(outputDir, { recursive: true })

    let allResults: LoadTestResult[] = []

    if (parallel && testSuite !== 'endurance') {
      // Run tests in parallel (except endurance tests)
      console.log('🔄 Running tests in parallel...')
      allResults = await runTestsInParallel(loadTester, testConfigs)
    } else {
      // Run tests sequentially
      console.log('🔄 Running tests sequentially...')
      allResults = await loadTester.executeTestSuite(testConfigs)
    }

    const endTime = performance.now()
    const totalDuration = endTime - startTime

    // Generate and save reports
    await generateReports(loadTester, allResults, outputDir, totalDuration)

    // Print summary
    printSummary(allResults, totalDuration)

    // Check for failures
    const hasFailures = allResults.some(result => result.errorRate > 10) // 10% error threshold
    if (hasFailures) {
      console.log('\n⚠️  Some tests had high error rates (>10%). Check the detailed report.')
      process.exit(1)
    }

    console.log('\n✅ All load tests completed successfully!')

  } catch (error) {
    console.error('❌ Load test execution failed:', error)
    process.exit(1)
  }
}

/**
 * Get test configurations based on suite type and categories
 */
function getTestConfigs(scenarios: TestScenarios, testSuite: string, categories: string[]) {
  switch (testSuite) {
    case 'smoke':
      return scenarios.getSmokeTests()
    
    case 'production':
      return scenarios.getProductionReadinessTests()
    
    case 'stress':
      return scenarios.getStressTestScenarios()
    
    case 'endurance':
      return scenarios.getEnduranceTestScenarios()
    
    case 'full':
      const allScenarios = scenarios.getAllScenarios()
      return Object.values(allScenarios).flat()
    
    default:
      // Custom categories
      if (categories.length > 0) {
        const allScenarios = scenarios.getAllScenarios()
        return categories.flatMap(category => allScenarios[category] || [])
      }
      return scenarios.getSmokeTests()
  }
}

/**
 * Run tests in parallel with controlled concurrency
 */
async function runTestsInParallel(
  loadTester: LoadTestSuite, 
  testConfigs: any[]
): Promise<LoadTestResult[]> {
  const maxConcurrentTests = 3 // Limit concurrent tests to avoid overwhelming the system
  const results: LoadTestResult[] = []
  
  for (let i = 0; i < testConfigs.length; i += maxConcurrentTests) {
    const batch = testConfigs.slice(i, i + maxConcurrentTests)
    console.log(`📦 Running batch ${Math.floor(i / maxConcurrentTests) + 1} (${batch.length} tests)`)
    
    const batchPromises = batch.map(config => loadTester.executeLoadTest(config))
    const batchResults = await Promise.allSettled(batchPromises)
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.error('❌ Test failed:', result.reason)
        // Create a failed result
        results.push({
          testName: 'Failed Test',
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          p50ResponseTime: 0,
          p90ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 100,
          errors: [{ error: result.reason?.message || 'Unknown error', count: 1 }],
          duration: 0,
          throughput: 0
        })
      }
    }
    
    // Cool down between batches
    if (i + maxConcurrentTests < testConfigs.length) {
      console.log('⏳ Cooling down between batches...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
  
  return results
}

/**
 * Generate comprehensive reports
 */
async function generateReports(
  loadTester: LoadTestSuite,
  results: LoadTestResult[],
  outputDir: string,
  totalDuration: number
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  
  // Generate markdown report
  const markdownReport = loadTester.generateReport(results)
  const markdownPath = join(outputDir, `load-test-report-${timestamp}.md`)
  await writeFile(markdownPath, markdownReport)
  
  // Generate JSON report for programmatic analysis
  const jsonReport = {
    timestamp: new Date().toISOString(),
    totalDuration,
    summary: {
      totalTests: results.length,
      passedTests: results.filter(r => r.errorRate <= 10).length,
      failedTests: results.filter(r => r.errorRate > 10).length,
      totalRequests: results.reduce((sum, r) => sum + r.totalRequests, 0),
      totalSuccessful: results.reduce((sum, r) => sum + r.successfulRequests, 0),
      totalFailed: results.reduce((sum, r) => sum + r.failedRequests, 0),
      overallErrorRate: (results.reduce((sum, r) => sum + r.failedRequests, 0) / 
                        results.reduce((sum, r) => sum + r.totalRequests, 0)) * 100
    },
    results,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage()
    }
  }
  
  const jsonPath = join(outputDir, `load-test-results-${timestamp}.json`)
  await writeFile(jsonPath, JSON.stringify(jsonReport, null, 2))
  
  // Generate CSV for spreadsheet analysis
  const csvLines = [
    'Test Name,Total Requests,Successful,Failed,Error Rate %,Avg Response Time (ms),P50,P90,P95,P99,Requests/sec,Throughput,Duration (ms)'
  ]
  
  for (const result of results) {
    csvLines.push([
      result.testName,
      result.totalRequests,
      result.successfulRequests,
      result.failedRequests,
      result.errorRate,
      result.averageResponseTime,
      result.p50ResponseTime,
      result.p90ResponseTime,
      result.p95ResponseTime,
      result.p99ResponseTime,
      result.requestsPerSecond,
      result.throughput,
      result.duration
    ].join(','))
  }
  
  const csvPath = join(outputDir, `load-test-results-${timestamp}.csv`)
  await writeFile(csvPath, csvLines.join('\n'))
  
  console.log(`📄 Reports generated:`)
  console.log(`   📋 Markdown: ${markdownPath}`)
  console.log(`   📊 JSON: ${jsonPath}`)
  console.log(`   📈 CSV: ${csvPath}`)
}

/**
 * Print test summary to console
 */
function printSummary(results: LoadTestResult[], totalDuration: number) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 LOAD TEST SUMMARY')
  console.log('='.repeat(60))
  
  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0)
  const overallErrorRate = (totalFailed / totalRequests) * 100
  const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length
  
  console.log(`⏱️  Total Duration: ${Math.round(totalDuration / 1000)}s`)
  console.log(`🧪 Tests Run: ${results.length}`)
  console.log(`📨 Total Requests: ${totalRequests}`)
  console.log(`✅ Successful: ${totalSuccessful}`)
  console.log(`❌ Failed: ${totalFailed}`)
  console.log(`📈 Overall Error Rate: ${overallErrorRate.toFixed(2)}%`)
  console.log(`⚡ Average Throughput: ${avgThroughput.toFixed(2)} req/s`)
  
  console.log('\n🏆 TOP PERFORMERS:')
  const sortedByThroughput = [...results].sort((a, b) => b.throughput - a.throughput)
  for (let i = 0; i < Math.min(3, sortedByThroughput.length); i++) {
    const result = sortedByThroughput[i]
    console.log(`   ${i + 1}. ${result.testName}: ${result.throughput} req/s`)
  }
  
  console.log('\n⚠️  HIGH ERROR RATES:')
  const highErrorTests = results.filter(r => r.errorRate > 10)
  if (highErrorTests.length === 0) {
    console.log('   None! All tests performed well.')
  } else {
    for (const result of highErrorTests) {
      console.log(`   ❌ ${result.testName}: ${result.errorRate.toFixed(2)}%`)
    }
  }
  
  console.log('\n📊 RESPONSE TIME PERCENTILES (Average across all tests):')
  const avgP50 = results.reduce((sum, r) => sum + r.p50ResponseTime, 0) / results.length
  const avgP90 = results.reduce((sum, r) => sum + r.p90ResponseTime, 0) / results.length
  const avgP95 = results.reduce((sum, r) => sum + r.p95ResponseTime, 0) / results.length
  const avgP99 = results.reduce((sum, r) => sum + r.p99ResponseTime, 0) / results.length
  
  console.log(`   P50: ${avgP50.toFixed(1)}ms`)
  console.log(`   P90: ${avgP90.toFixed(1)}ms`)
  console.log(`   P95: ${avgP95.toFixed(1)}ms`)
  console.log(`   P99: ${avgP99.toFixed(1)}ms`)
}

/**
 * CLI argument parsing
 */
function parseArgs(): TestRunConfig {
  const args = process.argv.slice(2)
  const config: TestRunConfig = {}
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--url':
        config.baseUrl = args[++i]
        break
      case '--token':
        config.authToken = args[++i]
        break
      case '--output':
        config.outputDir = args[++i]
        break
      case '--suite':
        config.testSuite = args[++i] as any
        break
      case '--parallel':
        config.parallel = true
        break
      case '--categories':
        config.categories = args[++i].split(',')
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }
  
  return config
}

/**
 * Print CLI help
 */
function printHelp() {
  console.log(`
🚀 PRIA Platform Load Testing Tool

Usage: tsx run-load-tests.ts [options]

Options:
  --url <url>           Base URL for testing (default: http://localhost:3000)
  --token <token>       Authentication token for protected endpoints
  --output <dir>        Output directory for reports (default: ./load-test-results)
  --suite <type>        Test suite type: smoke, production, stress, endurance, full
  --parallel            Run tests in parallel (not recommended for endurance tests)
  --categories <list>   Comma-separated list of test categories
  --help               Show this help message

Test Suites:
  smoke       - Quick smoke tests (4 tests, ~2 minutes)
  production  - Production readiness tests (15+ tests, ~15 minutes)
  stress      - High load stress tests (3+ tests, ~10 minutes)
  endurance   - Long duration tests (2+ tests, ~50 minutes)
  full        - All available tests (40+ tests, ~2 hours)

Categories:
  healthCheck, authentication, claudeAPI, e2bSandbox, github, database, deploy

Examples:
  tsx run-load-tests.ts --suite smoke
  tsx run-load-tests.ts --suite production --parallel
  tsx run-load-tests.ts --categories healthCheck,authentication
  tsx run-load-tests.ts --url https://staging.pria.dev --token abc123
`)
}

// Main execution
if (require.main === module) {
  const config = parseArgs()
  runLoadTests(config).catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { runLoadTests, TestRunConfig }