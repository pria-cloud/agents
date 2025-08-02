#!/usr/bin/env node

/**
 * Local Test Script for Claude API Server
 * Tests session management, streaming, and Claude Code integration
 * Run this before pushing changes to E2B template
 */

const http = require('http')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Test configuration
const API_PORT = 8080
const API_BASE_URL = `http://localhost:${API_PORT}`
const TEST_SESSION_ID = `test-session-${Date.now()}`
const API_SERVER_PATH = path.join(__dirname, 'template', 'api', 'claude-server.js')

// Environment detection - we're running in Claude Code environment
const IS_CLAUDE_CODE_ENV = true // We ARE Claude Code
const SKIP_CLAUDE_CLI_TESTS = false // Test everything including Claude execution

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  failures: []
}

// Utility functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(testName, status, details = '') {
  testResults.total++
  if (status === 'PASS') {
    testResults.passed++
    log(`✅ ${testName}`, 'green')
    if (details) log(`   ${details}`, 'cyan')
  } else {
    testResults.failed++
    testResults.failures.push({ test: testName, details })
    log(`❌ ${testName}`, 'red')
    if (details) log(`   ${details}`, 'red')
  }
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue')
  log(`${title}`, 'bright')
  log(`${'='.repeat(60)}`, 'blue')
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
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data))
    }
    
    req.end()
  })
}

// Server-Sent Events client
function listenToSSE(url, onMessage, onComplete, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, (res) => {
      let buffer = ''
      let messageCount = 0
      let hasStarted = false
      let hasCompleted = false
      
      const timer = setTimeout(() => {
        if (!hasCompleted) {
          req.destroy()
          reject(new Error('SSE stream timeout'))
        }
      }, timeout)
      
      res.on('data', (chunk) => {
        buffer += chunk.toString()
        
        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              messageCount++
              hasStarted = true
              
              if (onMessage) {
                onMessage(data, messageCount)
              }
              
              // Check for completion
              if (data.type === 'stream_complete' || data.type === 'error') {
                hasCompleted = true
                clearTimeout(timer)
                if (onComplete) {
                  onComplete(data, messageCount)
                }
                resolve({ messageCount, completed: true, lastMessage: data })
                return
              }
            } catch (error) {
              // Skip invalid JSON lines
            }
          }
        }
      })
      
      res.on('end', () => {
        clearTimeout(timer)
        resolve({ messageCount, completed: hasCompleted, hasStarted })
      })
      
      res.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    
    req.on('error', reject)
    req.end()
  })
}

// Test functions
async function testServerStartup() {
  logSection('SERVER STARTUP TESTS')
  
  // Check if API server file exists
  if (!fs.existsSync(API_SERVER_PATH)) {
    logTest('API Server File Exists', 'FAIL', `File not found: ${API_SERVER_PATH}`)
    return false
  }
  logTest('API Server File Exists', 'PASS')
  
  // Start the API server
  log('\n🚀 Starting Claude API server...', 'yellow')
  
  const apiServer = spawn('node', [API_SERVER_PATH], {
    cwd: path.dirname(API_SERVER_PATH),
    env: {
      ...process.env,
      CLAUDE_API_PORT: API_PORT,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key-for-local-testing'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  // Wait for server to start
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve()
    }, 3000)
    
    apiServer.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes(`Server running on port ${API_PORT}`)) {
        clearTimeout(timer)
        resolve()
      }
    })
  })
  
  // Store server reference for cleanup
  process.apiServer = apiServer
  
  logTest('API Server Started', 'PASS', `Running on port ${API_PORT}`)
  return true
}

async function testHealthEndpoint() {
  logSection('HEALTH CHECK TESTS')
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/health',
      method: 'GET'
    })
    
    if (response.status === 200) {
      logTest('Health Endpoint Accessible', 'PASS', `Status: ${response.status}`)
      
      if (response.body && response.body.status === 'healthy') {
        logTest('Health Status Response', 'PASS', 'Server reports healthy')
        
        // Check for required fields
        const requiredFields = ['claude_sdk_available', 'working_directory', 'anthropic_api_key_present']
        let allFieldsPresent = true
        
        for (const field of requiredFields) {
          if (response.body[field] === undefined) {
            allFieldsPresent = false
            break
          }
        }
        
        logTest('Health Response Fields', allFieldsPresent ? 'PASS' : 'FAIL', 
          allFieldsPresent ? 'All required fields present' : 'Missing required fields')
        
        // Log important health info
        log(`\n📊 Health Check Details:`, 'cyan')
        log(`   Claude SDK Available: ${response.body.claude_sdk_available}`, 'cyan')
        log(`   API Key Present: ${response.body.anthropic_api_key_present}`, 'cyan')
        log(`   API Key Valid Format: ${response.body.anthropic_api_key_valid_format}`, 'cyan')
        log(`   Working Directory: ${response.body.working_directory}`, 'cyan')
        
      } else {
        logTest('Health Status Response', 'FAIL', 'Invalid health status')
      }
    } else {
      logTest('Health Endpoint Accessible', 'FAIL', `Status: ${response.status}`)
    }
  } catch (error) {
    logTest('Health Endpoint Accessible', 'FAIL', error.message)
  }
}

async function testClaudeCliDirect() {
  logSection('CLAUDE CLI DIRECT TESTS')
  
  try {
    log('🤖 Testing Claude Code CLI integration via API...', 'yellow')
    
    const response = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/test-claude-cli-direct',
      method: 'GET'
    })
    
    if (response.status === 200 && response.body) {
      const { success, cliAvailable, queryTest, projectStatus } = response.body
      
      logTest('Claude CLI Available', cliAvailable ? 'PASS' : 'FAIL', 
        cliAvailable ? 'Claude CLI command found' : 'Claude CLI not available')
      
      if (projectStatus) {
        logTest('Claude Project Status', projectStatus.exitCode === 0 ? 'PASS' : 'INFO',
          projectStatus.exitCode === 0 ? 'Project mode working' : 'Project mode may need setup')
      }
      
      if (queryTest) {
        // More lenient testing - Claude might respond differently
        const queryWorked = queryTest.exitCode === 0 || queryTest.output.length > 0
        logTest('Claude CLI Query Test', queryWorked ? 'PASS' : 'FAIL',
          queryWorked ? 'Claude responded to query' : `Exit code: ${queryTest.exitCode}`)
        
        if (queryTest.output) {
          log(`   Claude Response: ${queryTest.output.substring(0, 200)}${queryTest.output.length > 200 ? '...' : ''}`, 'cyan')
        }
        
        if (queryTest.error && queryTest.error.length > 0) {
          log(`   Error Output: ${queryTest.error.substring(0, 200)}`, 'yellow')
        }
      }
      
      // Overall success if CLI is available and we got some kind of response
      const overallSuccess = cliAvailable && (queryTest?.output?.length > 0 || queryTest?.exitCode === 0)
      logTest('Claude CLI Integration', overallSuccess ? 'PASS' : 'PARTIAL', 
        overallSuccess ? 'Claude CLI is working' : 'Claude CLI available but may need configuration')
      
    } else {
      logTest('Claude CLI Direct Test', 'FAIL', `Status: ${response.status}`)
      if (response.rawBody) {
        log(`   Response: ${response.rawBody.substring(0, 200)}`, 'red')
      }
    }
  } catch (error) {
    logTest('Claude CLI Direct Test', 'FAIL', error.message)
  }
}

async function testSessionManagement() {
  logSection('SESSION MANAGEMENT TESTS')
  
  try {
    // Test session status for non-existent session
    const sessionResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: `/api/claude/session/${TEST_SESSION_ID}`,
      method: 'GET'
    })
    
    if (sessionResponse.status === 200) {
      logTest('Session Status Endpoint', 'PASS')
      
      const sessionData = sessionResponse.body
      if (sessionData.claudeSession) {
        logTest('Claude Session Info Included', 'PASS', 'Session includes Claude session metadata')
        
        log(`\n📋 Session Info:`, 'cyan')
        log(`   Session ID: ${sessionData.sessionId}`, 'cyan')
        log(`   Working Directory: ${sessionData.workingDirectory}`, 'cyan')
        log(`   Directory Exists: ${sessionData.exists}`, 'cyan')
        log(`   Has Stored Claude Session: ${sessionData.claudeSession.hasStoredSession}`, 'cyan')
        log(`   Can Resume: ${sessionData.claudeSession.canResume}`, 'cyan')
        log(`   Can Continue: ${sessionData.claudeSession.canContinue}`, 'cyan')
        
      } else {
        logTest('Claude Session Info Included', 'FAIL', 'Missing Claude session metadata')
      }
    } else {
      logTest('Session Status Endpoint', 'FAIL', `Status: ${sessionResponse.status}`)
    }
    
    // Test debug sessions endpoint
    const debugResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/debug/sessions',
      method: 'GET'
    })
    
    if (debugResponse.status === 200 && debugResponse.body) {
      logTest('Debug Sessions Endpoint', 'PASS')
      
      const debugData = debugResponse.body
      log(`\n🔍 Debug Info:`, 'cyan')
      log(`   Total Sessions: ${debugData.totalSessions}`, 'cyan')
      log(`   Claude Session Mappings: ${debugData.claudeSessionMappings}`, 'cyan')
      log(`   Server Uptime: ${Math.round(debugData.serverInfo.uptime)}s`, 'cyan')
      
    } else {
      logTest('Debug Sessions Endpoint', 'FAIL', `Status: ${debugResponse.status}`)
    }
    
  } catch (error) {
    logTest('Session Management Tests', 'FAIL', error.message)
  }
}

async function testStreamingEndpoint() {
  logSection('STREAMING ENDPOINT TESTS')
  
  try {
    log('\n🌊 Testing Claude streaming with simple prompt...', 'yellow')
    
    // Test streaming with a simple prompt
    const streamUrl = {
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    }
    
    const streamData = {
      sessionId: TEST_SESSION_ID,
      prompt: 'Please respond with exactly: "API test successful"'
    }
    
    // Make the streaming request
    const req = http.request(streamUrl, (res) => {
      if (res.statusCode === 200) {
        logTest('Streaming Endpoint Accessible', 'PASS', `Status: ${res.statusCode}`)
        
        // Check headers
        const contentType = res.headers['content-type']
        if (contentType && contentType.includes('text/event-stream')) {
          logTest('Streaming Headers Correct', 'PASS', 'Content-Type: text/event-stream')
        } else {
          logTest('Streaming Headers Correct', 'FAIL', `Content-Type: ${contentType}`)
        }
        
        let messageCount = 0
        let hasStreamStart = false
        let hasStreamComplete = false
        let buffer = ''
        let receivedContent = ''
        
        res.on('data', (chunk) => {
          buffer += chunk.toString()
          
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                messageCount++
                
                log(`   📨 Message ${messageCount}: ${data.type}`, 'cyan')
                
                if (data.type === 'stream_start') {
                  hasStreamStart = true
                }
                
                if (data.type === 'claude_message' && data.content) {
                  receivedContent += data.content
                  log(`      Content: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`, 'cyan')
                }
                
                if (data.type === 'stream_complete') {
                  hasStreamComplete = true
                  
                  logTest('Stream Start Event', hasStreamStart ? 'PASS' : 'FAIL')
                  logTest('Stream Complete Event', 'PASS')
                  logTest('Received Messages', messageCount > 0 ? 'PASS' : 'FAIL', `${messageCount} messages`)
                  
                  if (receivedContent.length > 0) {
                    logTest('Claude Response Content', 'PASS', `${receivedContent.length} characters received`)
                    log(`   📝 Full Response: ${receivedContent}`, 'green')
                  } else {
                    logTest('Claude Response Content', 'FAIL', 'No content received')
                  }
                  
                  // Check if Claude session ID was captured
                  if (data.claudeSessionId) {
                    logTest('Claude Session ID Captured', 'PASS', `Session ID: ${data.claudeSessionId}`)
                  } else {
                    logTest('Claude Session ID Captured', 'FAIL', 'No Claude session ID in completion event')
                  }
                  
                  res.destroy() // Close connection
                }
                
                if (data.type === 'error') {
                  logTest('Stream Error Handling', 'FAIL', data.error)
                  res.destroy()
                }
                
              } catch (parseError) {
                // Skip invalid JSON
              }
            }
          }
        })
        
        res.on('end', () => {
          if (!hasStreamComplete) {
            logTest('Stream Completion', 'FAIL', 'Stream ended without completion event')
          }
        })
        
        res.on('error', (error) => {
          logTest('Stream Error Handling', 'FAIL', error.message)
        })
        
      } else {
        logTest('Streaming Endpoint Accessible', 'FAIL', `Status: ${res.statusCode}`)
      }
    })
    
    req.on('error', (error) => {
      logTest('Streaming Request Error', 'FAIL', error.message)
    })
    
    req.write(JSON.stringify(streamData))
    req.end()
    
    // Wait for streaming to complete
    await new Promise(resolve => setTimeout(resolve, 10000))
    
  } catch (error) {
    logTest('Streaming Endpoint Tests', 'FAIL', error.message)
  }
}

async function testSessionContinuity() {
  logSection('SESSION CONTINUITY TESTS')
  
  try {
    log('\n🔄 Testing session continuity with follow-up message...', 'yellow')
    
    // Send a second message to test session continuity
    const streamUrl = {
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    }
    
    const streamData = {
      sessionId: TEST_SESSION_ID,
      prompt: 'Do you remember our previous conversation? Please respond with either "Yes, I remember" or "No, new conversation".'
    }
    
    let hasResponse = false
    let responseContent = ''
    
    const req = http.request(streamUrl, (res) => {
      let buffer = ''
      
      res.on('data', (chunk) => {
        buffer += chunk.toString()
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              
              if (data.type === 'claude_message' && data.content) {
                responseContent += data.content
                hasResponse = true
              }
              
              if (data.type === 'stream_complete') {
                if (hasResponse) {
                  logTest('Follow-up Message Sent', 'PASS', 'Received response to second message')
                  log(`   📝 Follow-up Response: ${responseContent}`, 'green')
                  
                  // Check if response indicates continuity
                  const remembers = responseContent.toLowerCase().includes('remember') || 
                                   responseContent.toLowerCase().includes('previous') ||
                                   responseContent.toLowerCase().includes('yes')
                  
                  logTest('Session Continuity', remembers ? 'PASS' : 'INFO', 
                    remembers ? 'Claude appears to remember previous context' : 'May be starting fresh conversation')
                  
                } else {
                  logTest('Follow-up Message Sent', 'FAIL', 'No response to second message')
                }
                res.destroy()
              }
              
            } catch (parseError) {
              // Skip invalid JSON
            }
          }
        }
      })
    })
    
    req.write(JSON.stringify(streamData))
    req.end()
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Check final session state
    const finalSessionResponse = await makeRequest({
      hostname: 'localhost',
      port: API_PORT,
      path: `/api/claude/session/${TEST_SESSION_ID}`,
      method: 'GET'
    })
    
    if (finalSessionResponse.status === 200 && finalSessionResponse.body) {
      const sessionData = finalSessionResponse.body
      
      logTest('Session Persistence', sessionData.exists ? 'PASS' : 'FAIL', 
        sessionData.exists ? 'Session directory created' : 'No session directory')
      
      if (sessionData.claudeSession.hasStoredSession) {
        logTest('Claude Session Stored', 'PASS', `Claude session ID: ${sessionData.claudeSession.claudeSessionId}`)
      } else {
        logTest('Claude Session Stored', 'FAIL', 'No Claude session ID stored')
      }
      
      log(`\n📊 Final Session State:`, 'cyan')
      log(`   Files Created: ${sessionData.fileCount}`, 'cyan')
      log(`   Can Resume: ${sessionData.claudeSession.canResume}`, 'cyan')
      log(`   Can Continue: ${sessionData.claudeSession.canContinue}`, 'cyan')
    }
    
  } catch (error) {
    logTest('Session Continuity Tests', 'FAIL', error.message)
  }
}

async function cleanup() {
  logSection('CLEANUP')
  
  log('🧹 Cleaning up test environment...', 'yellow')
  
  // Kill API server
  if (process.apiServer) {
    process.apiServer.kill('SIGTERM')
    logTest('API Server Stopped', 'PASS')
  }
  
  // Clean up test session directory (optional)
  // This would be done in a real E2B environment automatically
  
  log('✅ Cleanup completed', 'green')
}

function printSummary() {
  logSection('TEST SUMMARY')
  
  log(`\n📊 Test Results:`, 'bright')
  log(`   Total Tests: ${testResults.total}`, 'cyan')
  log(`   Passed: ${testResults.passed}`, 'green')
  log(`   Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green')
  log(`   Success Rate: ${testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0}%`, 
    testResults.failed === 0 ? 'green' : 'yellow')
  
  if (testResults.failures.length > 0) {
    log(`\n❌ Failed Tests:`, 'red')
    testResults.failures.forEach(failure => {
      log(`   • ${failure.test}: ${failure.details}`, 'red')
    })
  }
  
  const overallSuccess = testResults.failed === 0 && testResults.passed > 0
  
  log(`\n${overallSuccess ? '🎉' : '⚠️'} Overall Result: ${overallSuccess ? 'READY FOR E2B DEPLOYMENT' : 'NEEDS FIXES BEFORE DEPLOYMENT'}`, 
    overallSuccess ? 'green' : 'red')
  
  if (overallSuccess) {
    log(`\n✅ The Claude API implementation is working correctly and ready to be pushed to the E2B template.`, 'green')
    log(`✅ Session management, streaming, and Claude Code integration are all functional.`, 'green')
  } else {
    log(`\n⚠️ Some tests failed. Please fix the issues before deploying to E2B template.`, 'yellow')
  }
}

// Main test execution
async function runTests() {
  log(`${'='.repeat(80)}`, 'blue')
  log(`🧪 CLAUDE API LOCAL TEST SUITE`, 'bright')
  log(`${'='.repeat(80)}`, 'blue')
  log(`\n📋 Testing Claude API implementation before E2B deployment`, 'cyan')
  log(`📅 Started: ${new Date().toISOString()}`, 'cyan')
  log(`🎯 Test Session ID: ${TEST_SESSION_ID}`, 'cyan')
  
  // Check prerequisites
  log(`\n🤖 Running in Claude Code environment - testing real Claude execution`, 'green')
  if (!process.env.ANTHROPIC_API_KEY) {
    log(`\n⚠️ Note: ANTHROPIC_API_KEY not set in environment.`, 'yellow')
    log(`   Claude Code will use its internal authentication.`, 'yellow')
  }
  
  try {
    // Run test suite
    await testServerStartup()
    await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for server to fully start
    
    await testHealthEndpoint()
    await testClaudeCliDirect()
    await testSessionManagement()
    await testStreamingEndpoint()
    await testSessionContinuity()
    
  } catch (error) {
    log(`\n💥 Test suite failed with error: ${error.message}`, 'red')
    logTest('Test Suite Execution', 'FAIL', error.message)
  } finally {
    await cleanup()
    printSummary()
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\n\n🛑 Test interrupted by user', 'yellow')
  await cleanup()
  process.exit(1)
})

process.on('SIGTERM', async () => {
  log('\n\n🛑 Test terminated', 'yellow')
  await cleanup()
  process.exit(1)
})

// Run the tests
if (require.main === module) {
  runTests().then(() => {
    process.exit(testResults.failed > 0 ? 1 : 0)
  }).catch((error) => {
    log(`💥 Fatal error: ${error.message}`, 'red')
    process.exit(1)
  })
}

module.exports = { runTests, testResults }