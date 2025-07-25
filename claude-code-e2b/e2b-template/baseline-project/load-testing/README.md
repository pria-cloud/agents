# PRIA Platform Load Testing Suite

Comprehensive load testing framework for validating the PRIA platform's performance and scalability under various load conditions.

## 🎯 Overview

This load testing suite is designed to verify that the PRIA platform can handle enterprise-scale usage patterns. It includes:

- **API Endpoint Testing**: All critical API endpoints under various load conditions
- **Database Performance**: Multi-tenant database queries with workspace isolation
- **Authentication Systems**: Login, session management, and rate limiting
- **Claude Integration**: AI operations under load
- **E2B Sandbox Management**: Container creation and code execution
- **GitHub Integration**: Repository operations and webhook handling
- **Deployment Pipeline**: Preview and production deployments

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Set environment variables
export LOAD_TEST_BASE_URL="http://localhost:3000"
export LOAD_TEST_AUTH_TOKEN="your-jwt-token-here"
```

### Running Tests

```bash
# Quick smoke tests (recommended for CI/CD)
tsx load-testing/run-load-tests.ts --suite smoke

# Production readiness tests
tsx load-testing/run-load-tests.ts --suite production

# Stress testing
tsx load-testing/run-load-tests.ts --suite stress

# Full test suite (all scenarios)
tsx load-testing/run-load-tests.ts --suite full
```

## 📋 Test Suites

### Smoke Tests (4 tests, ~2 minutes)
Basic functionality verification:
- Health check endpoint
- Authentication session check
- Database read operations
- Claude API basic execution

```bash
tsx load-testing/run-load-tests.ts --suite smoke
```

### Production Readiness Tests (15+ tests, ~15 minutes)
Comprehensive testing for production deployment:
- All core endpoints under normal load
- Authentication flows
- Claude operations (light to medium load)
- E2B sandbox operations
- Database CRUD operations
- GitHub integration
- Deployment workflows
- Basic stress testing

```bash
tsx load-testing/run-load-tests.ts --suite production --parallel
```

### Stress Tests (3+ tests, ~10 minutes)
High-load scenarios to test system limits:
- Health check saturation (200 concurrent users)
- Authentication flood testing
- Mixed API load testing

```bash
tsx load-testing/run-load-tests.ts --suite stress
```

### Endurance Tests (2+ tests, ~50 minutes)
Long-duration testing for memory leaks and stability:
- 30-minute health check endurance
- 20-minute session operations endurance

```bash
tsx load-testing/run-load-tests.ts --suite endurance
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
LOAD_TEST_BASE_URL="https://your-pria-instance.com"

# Optional but recommended for protected endpoints
LOAD_TEST_AUTH_TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Database connection (for advanced metrics)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
```

### Command Line Options

```bash
tsx run-load-tests.ts [options]

Options:
  --url <url>           Base URL for testing
  --token <token>       Authentication token
  --output <dir>        Output directory for reports
  --suite <type>        Test suite type
  --parallel            Run tests in parallel
  --categories <list>   Specific test categories
  --help               Show help message
```

### Custom Test Categories

```bash
# Test specific categories
tsx run-load-tests.ts --categories healthCheck,authentication
tsx run-load-tests.ts --categories claudeAPI,e2bSandbox
tsx run-load-tests.ts --categories github,deploy
```

Available categories:
- `healthCheck` - Basic system health
- `authentication` - Login and session management
- `claudeAPI` - AI operations and chat
- `e2bSandbox` - Container and execution
- `github` - Repository and webhook operations
- `database` - CRUD operations
- `deploy` - Deployment workflows

## 📊 Test Results

### Output Files

After each test run, the following files are generated:

1. **Markdown Report** (`load-test-report-{timestamp}.md`)
   - Human-readable summary
   - Individual test results
   - Performance metrics
   - Error analysis

2. **JSON Report** (`load-test-results-{timestamp}.json`)
   - Machine-readable results
   - Complete test data
   - Environment information
   - Programmatic analysis

3. **CSV Export** (`load-test-results-{timestamp}.csv`)
   - Spreadsheet-compatible format
   - Key metrics for each test
   - Performance trending

### Key Metrics

For each test scenario, the following metrics are captured:

- **Request Metrics**:
  - Total requests sent
  - Successful vs failed requests
  - Error rate percentage

- **Response Time Analysis**:
  - Average, minimum, maximum response times
  - Percentiles: P50, P90, P95, P99
  - Response time distribution

- **Throughput Metrics**:
  - Requests per second
  - Successful requests per second (throughput)
  - Concurrent user simulation

- **Error Analysis**:
  - Error types and frequencies
  - HTTP status code distribution
  - Timeout occurrences

### Performance Benchmarks

#### Expected Performance Targets

| Endpoint Category | Target RPS | Max P95 Response Time | Max Error Rate |
|------------------|------------|----------------------|----------------|
| Health Check     | 100+       | 100ms               | 0.1%           |
| Authentication   | 50+        | 200ms               | 1%             |
| Claude API       | 10+        | 2000ms              | 2%             |
| E2B Operations   | 20+        | 1000ms              | 5%             |
| Database CRUD    | 80+        | 300ms               | 0.5%           |
| GitHub API       | 30+        | 500ms               | 2%             |
| Deployments      | 2+         | 30000ms             | 5%             |

## 🔍 Monitoring During Tests

### Real-time Monitoring

While tests are running, monitor:

1. **System Resources**:
   ```bash
   # CPU and memory usage
   top -p $(pgrep -f "next")
   
   # Network connections
   netstat -an | grep :3000
   ```

2. **Application Logs**:
   ```bash
   # Next.js application logs
   tail -f .next/trace
   
   # Custom application logs
   tail -f logs/application.log
   ```

3. **Database Performance**:
   - Supabase Dashboard > Database > Performance
   - Active connections
   - Query performance
   - Lock contention

4. **External Services**:
   - Claude API rate limits
   - E2B sandbox availability
   - GitHub API rate limits

### Alert Thresholds

The load testing framework will alert on:

- **Error Rate > 10%**: High failure rate indicating system stress
- **P95 Response Time > 5000ms**: Unacceptable user experience
- **Memory Usage > 80%**: Potential memory pressure
- **CPU Usage > 90%**: System overload
- **Database Connections > 80% of pool**: Connection exhaustion

## 🐛 Troubleshooting

### Common Issues

#### High Error Rates

```bash
# Check application logs
tail -f logs/application.log | grep ERROR

# Verify system resources
htop

# Check database connections
# Supabase Dashboard > Database > Performance
```

#### Slow Response Times

```bash
# Profile application performance
node --prof your-app.js

# Check database query performance
# Supabase Dashboard > Database > Logs

# Monitor network latency
ping your-target-server
```

#### Memory Leaks

```bash
# Monitor memory usage over time
while true; do
  ps -p $(pgrep -f "next") -o pid,rss,vsz,cmd
  sleep 30
done

# Generate heap snapshots
node --inspect your-app.js
# Use Chrome DevTools > Memory tab
```

#### Rate Limiting Issues

```bash
# Check rate limit headers in responses
curl -I http://localhost:3000/api/health

# Review rate limiting configuration
cat middleware.ts | grep -A 10 "rate.*limit"
```

### Performance Optimization

Based on load test results:

1. **Database Optimization**:
   - Add missing indexes
   - Optimize slow queries
   - Implement connection pooling

2. **API Optimization**:
   - Add response caching
   - Implement request batching
   - Optimize serialization

3. **Infrastructure Scaling**:
   - Horizontal scaling (multiple instances)
   - Vertical scaling (more CPU/memory)
   - CDN implementation

4. **Code Optimization**:
   - Remove performance bottlenecks
   - Implement async processing
   - Optimize memory usage

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: Load Testing

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Start application
      run: |
        npm run build
        npm start &
        sleep 30
        
    - name: Run smoke tests
      run: tsx load-testing/run-load-tests.ts --suite smoke
      env:
        LOAD_TEST_BASE_URL: http://localhost:3000
        
    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: load-test-results
        path: ./load-test-results/
```

### Automated Performance Regression Detection

```bash
# Compare with baseline performance
tsx load-testing/compare-results.ts \
  --baseline ./baseline-results.json \
  --current ./current-results.json \
  --threshold 20  # 20% performance degradation threshold
```

## 📈 Advanced Usage

### Custom Test Scenarios

Create custom test scenarios by extending the `TestScenarios` class:

```typescript
import { TestScenarios, LoadTestConfig } from './load-testing'

class MyCustomScenarios extends TestScenarios {
  getCustomAPITests(): LoadTestConfig[] {
    return [
      {
        name: 'Custom API - Heavy Load',
        endpoint: '/api/my-custom-endpoint',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: { /* custom payload */ },
        concurrency: 50,
        totalRequests: 500,
        timeoutMs: 10000
      }
    ]
  }
}
```

### Integration with Monitoring Tools

Export metrics to external monitoring systems:

```typescript
// Export to Prometheus
import { register, Histogram, Counter } from 'prom-client'

// Export to DataDog
import { StatsD } from 'node-statsd'

// Export to New Relic
import newrelic from 'newrelic'
```

### Load Testing in Production

**⚠️ Warning**: Only run load tests against production with proper authorization and during maintenance windows.

```bash
# Production load testing checklist:
# 1. Get explicit approval
# 2. Schedule during low-traffic periods
# 3. Use realistic test data
# 4. Monitor system health continuously
# 5. Have rollback plan ready

tsx run-load-tests.ts \
  --url https://prod.pria.dev \
  --suite smoke \
  --token $PROD_API_TOKEN
```

## 🏆 Best Practices

1. **Test Environment Parity**: Ensure test environment closely matches production
2. **Realistic Test Data**: Use production-like data volumes and patterns
3. **Gradual Load Increase**: Use ramp-up periods to avoid shocking the system
4. **Monitor Everything**: Track system resources, not just response times
5. **Test Regularly**: Include load testing in CI/CD pipeline
6. **Document Baselines**: Establish performance baselines and track trends
7. **Test Edge Cases**: Include error scenarios and edge cases
8. **Cleanup After Tests**: Ensure test data doesn't pollute systems

## 📞 Support

For questions or issues with the load testing suite:

1. Check the troubleshooting section above
2. Review application logs and metrics
3. Verify environment configuration
4. Test with smaller load first
5. Consult PRIA platform documentation

Remember: Load testing is a critical component of ensuring production readiness. Regular testing helps identify performance regressions before they impact users.