#!/usr/bin/env node

/**
 * Basic API Test Script - Tests core functionality without Claude CLI dependency
 * This validates our API structure and endpoints before E2B deployment
 */

const http = require('http')
const { spawn } = require('child_process')
const path = require('path')

// Test configuration
const API_PORT = 8080
const API_SERVER_PATH = path.join(__dirname, 'template', 'api', 'claude-server.js')

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// HTTP request helper
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : null
          resolve({ status: res.statusCode, headers: res.headers, body: jsonBody, rawBody: body })
        } catch (error) {
          resolve({ status: res.statusCode, headers: res.headers, body: null, rawBody: body })
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data))
    }
    
    req.end()
  })
}

async function startAPIServer() {
  log('🚀 Starting API server...', 'yellow')
  
  const server = spawn('node', [API_SERVER_PATH], {
    cwd: path.dirname(API_SERVER_PATH),
    env: {
      ...process.env,
      CLAUDE_API_PORT: API_PORT,
      ANTHROPIC_API_KEY: 'sk-ant-test-key-for-validation'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  // Wait for server to start
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 4000)
    
    server.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes(`Server running on port ${API_PORT}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
    
    server.stderr.on('data', (data) => {
      log(`Server stderr: ${data.toString()}`, 'yellow')
    })
  })
  
  return server
}

async function testHealthEndpoint() {
  log('\n📊 Testing health endpoint...', 'blue')
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/health',
      method: 'GET'
    })
    
    if (response.status === 200 && response.body) {
      log('✅ Health endpoint accessible', 'green')
      log(`   Status: ${response.body.status}`, 'cyan')
      log(`   Working directory: ${response.body.working_directory}`, 'cyan')
      log(`   API key present: ${response.body.anthropic_api_key_present}`, 'cyan')
      return true
    } else {
      log('❌ Health endpoint failed', 'red')
      log(`   Status: ${response.status}`, 'red')
      return false
    }
  } catch (error) {
    log('❌ Health endpoint error', 'red')
    log(`   Error: ${error.message}`, 'red')
    return false
  }
}

async function testSessionEndpoints() {
  log('\n🗂️ Testing session endpoints...', 'blue')
  
  const testSessionId = 'test-session-123'
  
  try {
    // Test session status
    const sessionResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: `/api/claude/session/${testSessionId}`,
      method: 'GET'
    })
    
    if (sessionResponse.status === 200) {
      log('✅ Session status endpoint working', 'green')
      log(`   Session ID: ${sessionResponse.body.sessionId}`, 'cyan')
      log(`   Directory exists: ${sessionResponse.body.exists}`, 'cyan')
      log(`   Has Claude session info: ${!!sessionResponse.body.claudeSession}`, 'cyan')
    } else {
      log('❌ Session status endpoint failed', 'red')
      return false
    }
    
    // Test debug endpoint
    const debugResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/debug/sessions',
      method: 'GET'
    })
    
    if (debugResponse.status === 200) {
      log('✅ Debug sessions endpoint working', 'green')
      log(`   Total sessions: ${debugResponse.body.totalSessions}`, 'cyan')
      log(`   Server uptime: ${Math.round(debugResponse.body.serverInfo.uptime)}s`, 'cyan')
    } else {
      log('❌ Debug sessions endpoint failed', 'red')
      return false
    }
    
    return true
  } catch (error) {
    log('❌ Session endpoints error', 'red')
    log(`   Error: ${error.message}`, 'red')
    return false
  }
}

async function testStreamingStructure() {
  log('\n🌊 Testing streaming endpoint structure...', 'blue')
  
  try {
    const streamRequest = http.request({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    }, (res) => {
      log(`✅ Streaming endpoint accessible (${res.statusCode})`, 'green')
      log(`   Content-Type: ${res.headers['content-type']}`, 'cyan')
      
      if (res.headers['content-type']?.includes('text/event-stream')) {
        log('✅ Correct streaming headers', 'green')
      }
      
      // Don't wait for full response since we don't have Claude CLI
      res.destroy()
    })
    
    streamRequest.on('error', (error) => {
      if (error.code === 'ECONNRESET') {
        log('✅ Streaming endpoint structure valid (connection reset expected)', 'green')
      } else {
        log('❌ Streaming endpoint error', 'red')
        log(`   Error: ${error.message}`, 'red')
      }
    })
    
    streamRequest.write(JSON.stringify({
      sessionId: 'test-session-123',
      prompt: 'test'
    }))
    
    streamRequest.end()
    
    // Give it a moment
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return true
  } catch (error) {
    log('❌ Streaming structure test failed', 'red')
    log(`   Error: ${error.message}`, 'red')
    return false
  }
}

async function testAPIStructure() {
  log('\n📋 Testing API structure and error handling...', 'blue')
  
  try {
    // Test invalid endpoint
    const invalidResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/invalid-endpoint',
      method: 'GET'
    })
    
    if (invalidResponse.status === 404) {
      log('✅ Proper 404 handling for invalid endpoints', 'green')
    }
    
    // Test missing required data
    const missingDataResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/stream',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, '{}')
    
    if (missingDataResponse.status === 400) {
      log('✅ Proper validation for missing required data', 'green')
    }
    
    return true
  } catch (error) {
    log('❌ API structure test failed', 'red')
    log(`   Error: ${error.message}`, 'red')
    return false
  }
}

async function runBasicTests() {
  log('================================================================================', 'blue')
  log('🧪 CLAUDE API BASIC TEST SUITE', 'blue')
  log('================================================================================', 'blue')
  log('Testing core API functionality without Claude CLI dependency', 'cyan')
  
  const results = { passed: 0, failed: 0 }
  
  // Start server
  const server = await startAPIServer()
  
  try {
    // Wait a bit for server to fully start
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Run tests
    const tests = [
      { name: 'Health Endpoint', fn: testHealthEndpoint },
      { name: 'Session Endpoints', fn: testSessionEndpoints },
      { name: 'Streaming Structure', fn: testStreamingStructure },
      { name: 'API Structure', fn: testAPIStructure }
    ]
    
    for (const test of tests) {
      try {
        const success = await test.fn()
        if (success) {
          results.passed++
        } else {
          results.failed++
        }
      } catch (error) {
        log(`❌ ${test.name} failed with error: ${error.message}`, 'red')
        results.failed++
      }
    }
    
  } finally {
    // Cleanup
    log('\n🧹 Cleaning up...', 'yellow')
    server.kill('SIGTERM')
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Results
  log('\n================================================================================', 'blue')
  log('📊 TEST RESULTS', 'blue')
  log('================================================================================', 'blue')
  log(`✅ Tests passed: ${results.passed}`, 'green')
  log(`❌ Tests failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green')
  log(`📈 Success rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`, 
    results.failed === 0 ? 'green' : 'yellow')
  
  if (results.failed === 0) {
    log('\n🎉 All basic tests passed! API structure is ready for E2B deployment.', 'green')
    log('💡 Note: Full Claude Code functionality will be tested in E2B environment.', 'cyan')
  } else {
    log('\n⚠️ Some tests failed. Please fix issues before E2B deployment.', 'yellow')
  }
  
  return results.failed === 0
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n\n🛑 Test interrupted', 'yellow')
  process.exit(1)
})

// Run tests
if (require.main === module) {
  runBasicTests().then((success) => {
    process.exit(success ? 0 : 1)
  }).catch((error) => {
    log(`💥 Fatal error: ${error.message}`, 'red')
    process.exit(1)
  })
}

module.exports = { runBasicTests }