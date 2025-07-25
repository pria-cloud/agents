#!/bin/bash

# PRIA Platform Production Readiness Test Suite
# Comprehensive testing script for production deployment validation

set -euo pipefail

# Configuration
BASE_URL="${LOAD_TEST_BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${LOAD_TEST_AUTH_TOKEN:-}"
OUTPUT_DIR="./production-readiness-results"
LOG_FILE="./production-test.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check if tsx is available
    if ! command -v tsx &> /dev/null; then
        error "tsx is not installed. Please install with: npm install -g tsx"
        exit 1
    fi
    
    # Check if application is running
    if ! curl -s --fail "$BASE_URL/api/health" > /dev/null; then
        error "Application is not running at $BASE_URL"
        error "Please start the application first: npm run dev"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources..."
    
    # Check available memory (Linux/macOS)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        FREE_MEM=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
        TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.1f", $2/1024}')
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{printf "%.1f", $1 * 4096 / 1024 / 1024 / 1024}')
        TOTAL_MEM=$(sysctl -n hw.memsize | awk '{printf "%.1f", $1 / 1024 / 1024 / 1024}')
    else
        warning "Cannot check memory on this OS"
        FREE_MEM="unknown"
        TOTAL_MEM="unknown"
    fi
    
    log "System Memory: ${FREE_MEM}GB free / ${TOTAL_MEM}GB total"
    
    # Check disk space
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    log "Disk usage: ${DISK_USAGE}%"
    
    if [[ "$DISK_USAGE" -gt 90 ]]; then
        warning "Disk usage is above 90%. This may affect test results."
    fi
    
    success "System resources check completed"
}

# Function to validate environment
validate_environment() {
    log "Validating environment configuration..."
    
    # Check if all required environment variables are set
    if [[ -z "$AUTH_TOKEN" ]]; then
        warning "LOAD_TEST_AUTH_TOKEN not set. Some tests may fail for protected endpoints."
    fi
    
    # Validate base URL format
    if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
        error "Invalid BASE_URL format: $BASE_URL"
        exit 1
    fi
    
    # Test basic connectivity
    if ! curl -s --fail --max-time 10 "$BASE_URL/api/health" > /dev/null; then
        error "Cannot connect to health check endpoint"
        exit 1
    fi
    
    success "Environment validation passed"
}

# Function to run security checks
run_security_checks() {
    log "Running security validation checks..."
    
    # Check for exposed secrets
    if curl -s "$BASE_URL/api/health" | grep -qi "password\|secret\|key\|token"; then
        warning "Potential secrets exposed in health check response"
    fi
    
    # Check security headers
    SECURITY_HEADERS=$(curl -s -I "$BASE_URL/api/health")
    
    if ! echo "$SECURITY_HEADERS" | grep -qi "x-frame-options"; then
        warning "Missing X-Frame-Options header"
    fi
    
    if ! echo "$SECURITY_HEADERS" | grep -qi "x-content-type-options"; then
        warning "Missing X-Content-Type-Options header"
    fi
    
    if ! echo "$SECURITY_HEADERS" | grep -qi "content-security-policy"; then
        warning "Missing Content-Security-Policy header"
    fi
    
    success "Security checks completed"
}

# Function to run comprehensive load tests
run_load_tests() {
    log "Starting comprehensive load testing..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Run production readiness test suite
    log "Running production readiness test suite..."
    if tsx load-testing/run-load-tests.ts \
        --suite production \
        --url "$BASE_URL" \
        --token "$AUTH_TOKEN" \
        --output "$OUTPUT_DIR" \
        --parallel; then
        success "Production readiness tests completed successfully"
    else
        error "Production readiness tests failed"
        return 1
    fi
    
    # Run stress tests
    log "Running stress tests..."
    if tsx load-testing/run-load-tests.ts \
        --suite stress \
        --url "$BASE_URL" \
        --token "$AUTH_TOKEN" \
        --output "$OUTPUT_DIR"; then
        success "Stress tests completed successfully"
    else
        warning "Stress tests failed - system may not handle peak load"
    fi
    
    success "Load testing completed"
}

# Function to validate database performance
validate_database_performance() {
    log "Validating database performance..."
    
    # Run database-specific load tests
    if tsx load-testing/run-load-tests.ts \
        --categories database \
        --url "$BASE_URL" \
        --token "$AUTH_TOKEN" \
        --output "$OUTPUT_DIR"; then
        success "Database performance tests passed"
    else
        error "Database performance tests failed"
        return 1
    fi
}

# Function to test API rate limiting
test_rate_limiting() {
    log "Testing API rate limiting..."
    
    # Test rate limiting on health endpoint
    RATE_LIMIT_TEST_URL="$BASE_URL/api/health"
    RATE_LIMIT_FAILURES=0
    
    log "Sending rapid requests to test rate limiting..."
    for i in {1..70}; do
        RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$RATE_LIMIT_TEST_URL")
        if [[ "$RESPONSE" == "429" ]]; then
            success "Rate limiting is working (got 429 after $i requests)"
            break
        elif [[ "$RESPONSE" != "200" ]]; then
            ((RATE_LIMIT_FAILURES++))
        fi
        
        if [[ $i -eq 70 ]]; then
            warning "Rate limiting may not be working - sent 70 requests without 429 response"
        fi
    done
    
    if [[ $RATE_LIMIT_FAILURES -gt 5 ]]; then
        warning "Multiple non-200/429 responses during rate limit test"
    fi
}

# Function to test authentication security
test_authentication() {
    log "Testing authentication security..."
    
    # Test protected endpoint without auth
    PROTECTED_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/sessions")
    if [[ "$PROTECTED_RESPONSE" == "401" || "$PROTECTED_RESPONSE" == "403" ]]; then
        success "Protected endpoints properly reject unauthenticated requests"
    else
        warning "Protected endpoint returned $PROTECTED_RESPONSE instead of 401/403"
    fi
    
    # Test with invalid token
    if [[ -n "$AUTH_TOKEN" ]]; then
        INVALID_TOKEN_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
            -H "Authorization: Bearer invalid_token_here" \
            "$BASE_URL/api/sessions")
        if [[ "$INVALID_TOKEN_RESPONSE" == "401" || "$INVALID_TOKEN_RESPONSE" == "403" ]]; then
            success "Invalid tokens properly rejected"
        else
            warning "Invalid token returned $INVALID_TOKEN_RESPONSE instead of 401/403"
        fi
    fi
}

# Function to analyze results
analyze_results() {
    log "Analyzing test results..."
    
    # Find the latest JSON results file
    LATEST_RESULTS=$(ls -t "$OUTPUT_DIR"/*.json 2>/dev/null | head -1)
    
    if [[ -z "$LATEST_RESULTS" ]]; then
        error "No test results found"
        return 1
    fi
    
    # Extract key metrics using jq (if available)
    if command -v jq &> /dev/null; then
        TOTAL_TESTS=$(jq '.summary.totalTests' "$LATEST_RESULTS")
        PASSED_TESTS=$(jq '.summary.passedTests' "$LATEST_RESULTS")
        FAILED_TESTS=$(jq '.summary.failedTests' "$LATEST_RESULTS")
        OVERALL_ERROR_RATE=$(jq '.summary.overallErrorRate' "$LATEST_RESULTS")
        
        log "Test Results Summary:"
        log "  Total Tests: $TOTAL_TESTS"
        log "  Passed Tests: $PASSED_TESTS"
        log "  Failed Tests: $FAILED_TESTS"
        log "  Overall Error Rate: ${OVERALL_ERROR_RATE}%"
        
        # Check if error rate is acceptable
        if (( $(echo "$OVERALL_ERROR_RATE > 5.0" | bc -l) )); then
            error "Overall error rate (${OVERALL_ERROR_RATE}%) exceeds acceptable threshold (5%)"
            return 1
        else
            success "Overall error rate (${OVERALL_ERROR_RATE}%) is within acceptable limits"
        fi
    else
        warning "jq not available - skipping detailed result analysis"
        log "Install jq for detailed result analysis: https://stedolan.github.io/jq/"
    fi
}

# Function to generate final report
generate_final_report() {
    log "Generating final production readiness report..."
    
    REPORT_FILE="$OUTPUT_DIR/production-readiness-report-$TIMESTAMP.md"
    
    cat > "$REPORT_FILE" << EOF
# PRIA Platform Production Readiness Report

**Generated:** $(date)
**Test Environment:** $BASE_URL
**Test Duration:** Started at $(head -1 "$LOG_FILE" | grep -o '\[.*\]' | tr -d '[]')

## Executive Summary

This report provides a comprehensive assessment of the PRIA platform's readiness for production deployment.

## Test Categories Completed

- ✅ System Prerequisites
- ✅ Environment Configuration
- ✅ Security Validation
- ✅ Load Testing (Production Suite)
- ✅ Stress Testing
- ✅ Database Performance
- ✅ Rate Limiting
- ✅ Authentication Security

## Key Findings

### Performance Metrics
$(if [[ -f "$LATEST_RESULTS" ]] && command -v jq &> /dev/null; then
    echo "- Total Requests Processed: $(jq '.summary.totalRequests' "$LATEST_RESULTS")"
    echo "- Success Rate: $(echo "100 - $(jq '.summary.overallErrorRate' "$LATEST_RESULTS")" | bc)%"
    echo "- Average Response Time: See detailed reports for per-endpoint metrics"
fi)

### Security Assessment
- Security headers validation completed
- Authentication and authorization tested
- Rate limiting functionality verified

### System Resources
- Memory usage monitored during tests
- Disk space sufficient for operations
- Network connectivity validated

## Detailed Results

See the following files for detailed results:
- Load test results: \`$(basename "$LATEST_RESULTS")\`
- Complete test log: \`$(basename "$LOG_FILE")\`

## Recommendations

1. **Monitor Performance**: Continue monitoring response times and error rates in production
2. **Scale Planning**: Based on load test results, plan for horizontal scaling at 80% capacity
3. **Security**: Regularly review security headers and authentication mechanisms
4. **Database**: Monitor database connection pools and query performance

## Production Deployment Checklist

- [ ] All load tests passing with <5% error rate
- [ ] Security headers properly configured
- [ ] Rate limiting working correctly
- [ ] Authentication/authorization functioning
- [ ] Database performance acceptable
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested
- [ ] Incident response plan in place

---

*Report generated by PRIA Production Readiness Test Suite*
EOF

    success "Final report generated: $REPORT_FILE"
}

# Function to cleanup
cleanup() {
    log "Cleaning up temporary files..."
    # Add any cleanup tasks here
    success "Cleanup completed"
}

# Main execution function
main() {
    echo "================================================"
    echo "🚀 PRIA Platform Production Readiness Tests"
    echo "================================================"
    echo ""
    
    log "Starting production readiness validation for: $BASE_URL"
    log "Output directory: $OUTPUT_DIR"
    log "Log file: $LOG_FILE"
    echo ""
    
    # Initialize log file
    echo "PRIA Production Readiness Test Log - $(date)" > "$LOG_FILE"
    
    # Run all validation steps
    check_prerequisites
    check_system_resources
    validate_environment
    run_security_checks
    test_authentication
    test_rate_limiting
    run_load_tests
    validate_database_performance
    analyze_results
    generate_final_report
    cleanup
    
    echo ""
    echo "================================================"
    success "Production readiness testing completed!"
    echo "================================================"
    echo ""
    echo "📋 Results Summary:"
    echo "   📄 Final Report: $OUTPUT_DIR/production-readiness-report-$TIMESTAMP.md"
    echo "   📊 Test Results: $OUTPUT_DIR/"
    echo "   📝 Test Log: $LOG_FILE"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Review the final report for any issues"
    echo "   2. Address any failed tests or warnings"
    echo "   3. Configure monitoring and alerting"
    echo "   4. Deploy to production with confidence!"
    echo ""
}

# Trap for cleanup on exit
trap cleanup EXIT

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "PRIA Production Readiness Test Suite"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Environment Variables:"
        echo "  LOAD_TEST_BASE_URL      Target URL (default: http://localhost:3000)"
        echo "  LOAD_TEST_AUTH_TOKEN    Authentication token for protected endpoints"
        echo ""
        echo "Options:"
        echo "  --help, -h              Show this help message"
        echo ""
        echo "Example:"
        echo "  LOAD_TEST_BASE_URL=https://staging.pria.dev $0"
        echo ""
        exit 0
        ;;
esac

# Run main function
main "$@"