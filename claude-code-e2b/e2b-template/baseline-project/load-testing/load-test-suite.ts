import { performance } from 'perf_hooks'
import { logger } from '@/lib/monitoring/logger'

export interface LoadTestConfig {
  name: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  concurrency: number
  totalRequests: number
  timeoutMs: number
  warmupRequests?: number
  rampUpDurationMs?: number
}

export interface LoadTestResult {
  testName: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p50ResponseTime: number
  p90ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errorRate: number
  errors: Array<{
    statusCode?: number
    error: string
    count: number
  }>
  duration: number
  throughput: number
}

export interface RequestResult {
  success: boolean
  responseTime: number
  statusCode?: number
  error?: string
}

/**
 * Comprehensive Load Testing Suite
 * Tests API endpoints under various load conditions
 */
export class LoadTestSuite {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = 'http://localhost:3000', defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'PRIA-LoadTest/1.0',
      ...defaultHeaders
    }
  }

  /**
   * Execute a single load test
   */
  async executeLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    logger.info('Starting load test', {
      testName: config.name,
      endpoint: config.endpoint,
      concurrency: config.concurrency,
      totalRequests: config.totalRequests
    })

    const startTime = performance.now()
    const results: RequestResult[] = []
    const errors = new Map<string, number>()

    // Warmup phase
    if (config.warmupRequests && config.warmupRequests > 0) {
      logger.info('Executing warmup requests', { count: config.warmupRequests })
      await this.executeWarmup(config)
    }

    // Main load test execution
    if (config.rampUpDurationMs && config.rampUpDurationMs > 0) {
      // Gradual ramp-up
      await this.executeWithRampUp(config, results, errors)
    } else {
      // Immediate full load
      await this.executeWithFullLoad(config, results, errors)
    }

    const endTime = performance.now()
    const duration = endTime - startTime

    return this.calculateResults(config, results, errors, duration)
  }

  /**
   * Execute multiple load tests in sequence
   */
  async executeTestSuite(configs: LoadTestConfig[]): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = []

    for (const config of configs) {
      try {
        const result = await this.executeLoadTest(config)
        results.push(result)

        // Cool down between tests
        if (configs.indexOf(config) < configs.length - 1) {
          logger.info('Cooling down between tests', { duration: '5 seconds' })
          await this.sleep(5000)
        }
      } catch (error) {
        logger.error('Load test failed', error, { testName: config.name })
        
        // Create failed result
        results.push({
          testName: config.name,
          totalRequests: config.totalRequests,
          successfulRequests: 0,
          failedRequests: config.totalRequests,
          averageResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          p50ResponseTime: 0,
          p90ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 100,
          errors: [{ error: error instanceof Error ? error.message : 'Unknown error', count: config.totalRequests }],
          duration: 0,
          throughput: 0
        })
      }
    }

    return results
  }

  /**
   * Execute warmup requests
   */
  private async executeWarmup(config: LoadTestConfig): Promise<void> {
    const warmupPromises = Array.from({ length: config.warmupRequests! }, () =>
      this.executeRequest(config)
    )

    await Promise.allSettled(warmupPromises)
    
    // Wait a bit after warmup
    await this.sleep(1000)
  }

  /**
   * Execute load test with gradual ramp-up
   */
  private async executeWithRampUp(
    config: LoadTestConfig,
    results: RequestResult[],
    errors: Map<string, number>
  ): Promise<void> {
    const rampUpIntervalMs = config.rampUpDurationMs! / config.concurrency
    const requestsPerBatch = Math.ceil(config.totalRequests / config.concurrency)

    for (let batch = 0; batch < config.concurrency; batch++) {
      const batchPromises = Array.from({ length: requestsPerBatch }, () =>
        this.executeRequest(config)
      )

      const batchResults = await Promise.allSettled(batchPromises)
      this.processBatchResults(batchResults, results, errors)

      // Wait before next batch (except for last batch)
      if (batch < config.concurrency - 1) {
        await this.sleep(rampUpIntervalMs)
      }
    }
  }

  /**
   * Execute load test with immediate full load
   */
  private async executeWithFullLoad(
    config: LoadTestConfig,
    results: RequestResult[],
    errors: Map<string, number>
  ): Promise<void> {
    const requestsPerWorker = Math.ceil(config.totalRequests / config.concurrency)
    
    const workerPromises = Array.from({ length: config.concurrency }, async () => {
      const workerResults: RequestResult[] = []
      
      for (let i = 0; i < requestsPerWorker && results.length < config.totalRequests; i++) {
        const result = await this.executeRequest(config)
        workerResults.push(result)
      }
      
      return workerResults
    })

    const workerResultsArray = await Promise.allSettled(workerPromises)
    
    for (const workerResult of workerResultsArray) {
      if (workerResult.status === 'fulfilled') {
        for (const result of workerResult.value) {
          results.push(result)
          if (!result.success) {
            const errorKey = result.error || `HTTP ${result.statusCode}`
            errors.set(errorKey, (errors.get(errorKey) || 0) + 1)
          }
        }
      }
    }
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest(config: LoadTestConfig): Promise<RequestResult> {
    const startTime = performance.now()
    
    try {
      const url = `${this.baseUrl}${config.endpoint}`
      const headers = { ...this.defaultHeaders, ...config.headers }
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

      const response = await fetch(url, {
        method: config.method,
        headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      
      const endTime = performance.now()
      const responseTime = endTime - startTime

      if (response.ok) {
        return {
          success: true,
          responseTime,
          statusCode: response.status
        }
      } else {
        return {
          success: false,
          responseTime,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          responseTime,
          error: 'Request timeout'
        }
      }

      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Process batch results
   */
  private processBatchResults(
    batchResults: PromiseSettledResult<RequestResult>[],
    results: RequestResult[],
    errors: Map<string, number>
  ): void {
    for (const promiseResult of batchResults) {
      if (promiseResult.status === 'fulfilled') {
        const result = promiseResult.value
        results.push(result)
        
        if (!result.success) {
          const errorKey = result.error || `HTTP ${result.statusCode}`
          errors.set(errorKey, (errors.get(errorKey) || 0) + 1)
        }
      } else {
        results.push({
          success: false,
          responseTime: 0,
          error: promiseResult.reason?.message || 'Promise rejected'
        })
        
        errors.set('Promise rejected', (errors.get('Promise rejected') || 0) + 1)
      }
    }
  }

  /**
   * Calculate final test results
   */
  private calculateResults(
    config: LoadTestConfig,
    results: RequestResult[],
    errors: Map<string, number>,
    duration: number
  ): LoadTestResult {
    const successfulRequests = results.filter(r => r.success).length
    const failedRequests = results.length - successfulRequests
    
    const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b)
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    
    const durationSeconds = duration / 1000
    const requestsPerSecond = results.length / durationSeconds
    const errorRate = (failedRequests / results.length) * 100
    
    // Calculate percentiles
    const p50ResponseTime = this.getPercentile(responseTimes, 0.5)
    const p90ResponseTime = this.getPercentile(responseTimes, 0.9)
    const p95ResponseTime = this.getPercentile(responseTimes, 0.95)
    const p99ResponseTime = this.getPercentile(responseTimes, 0.99)

    // Calculate throughput (successful requests per second)
    const throughput = successfulRequests / durationSeconds

    const errorArray = Array.from(errors.entries()).map(([error, count]) => ({
      error,
      count
    }))

    const result: LoadTestResult = {
      testName: config.name,
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      p50ResponseTime: Math.round(p50ResponseTime * 100) / 100,
      p90ResponseTime: Math.round(p90ResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
      p99ResponseTime: Math.round(p99ResponseTime * 100) / 100,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      errors: errorArray,
      duration: Math.round(duration),
      throughput: Math.round(throughput * 100) / 100
    }

    logger.info('Load test completed', result)
    
    return result
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0
    
    const index = Math.ceil(sortedArray.length * percentile) - 1
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))]
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate load test report
   */
  generateReport(results: LoadTestResult[]): string {
    const report = [
      '# PRIA Platform Load Test Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      ''
    ]

    // Overall summary
    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0)
    const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0)
    const totalFailed = results.reduce((sum, r) => sum + r.failedRequests, 0)
    const overallErrorRate = (totalFailed / totalRequests) * 100

    report.push(`- Total Tests: ${results.length}`)
    report.push(`- Total Requests: ${totalRequests}`)
    report.push(`- Successful Requests: ${totalSuccessful}`)
    report.push(`- Failed Requests: ${totalFailed}`)
    report.push(`- Overall Error Rate: ${overallErrorRate.toFixed(2)}%`)
    report.push('')

    // Individual test results
    report.push('## Individual Test Results')
    report.push('')

    for (const result of results) {
      report.push(`### ${result.testName}`)
      report.push('')
      report.push(`- **Total Requests**: ${result.totalRequests}`)
      report.push(`- **Successful**: ${result.successfulRequests}`)
      report.push(`- **Failed**: ${result.failedRequests}`)
      report.push(`- **Error Rate**: ${result.errorRate}%`)
      report.push(`- **Duration**: ${result.duration}ms`)
      report.push(`- **Requests/sec**: ${result.requestsPerSecond}`)
      report.push(`- **Throughput**: ${result.throughput} successful requests/sec`)
      report.push('')
      report.push('**Response Times:**')
      report.push(`- Average: ${result.averageResponseTime}ms`)
      report.push(`- Min: ${result.minResponseTime}ms`)
      report.push(`- Max: ${result.maxResponseTime}ms`)
      report.push(`- P50: ${result.p50ResponseTime}ms`)
      report.push(`- P90: ${result.p90ResponseTime}ms`)
      report.push(`- P95: ${result.p95ResponseTime}ms`)
      report.push(`- P99: ${result.p99ResponseTime}ms`)
      report.push('')

      if (result.errors.length > 0) {
        report.push('**Errors:**')
        for (const error of result.errors) {
          report.push(`- ${error.error}: ${error.count} occurrences`)
        }
        report.push('')
      }
    }

    return report.join('\n')
  }
}