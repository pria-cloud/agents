#!/usr/bin/env node

/**
 * Direct streaming test - Tests Claude Code execution via the streaming endpoint
 */

const http = require('http')

// Test configuration
const API_PORT = 8081
const TEST_SESSION_ID = `test-session-${Date.now()}`

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
  }
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function testStreaming() {
  return new Promise((resolve, reject) => {
    log('🌊 Testing Claude Code streaming...', 'blue')
    
    const postData = JSON.stringify({
      sessionId: TEST_SESSION_ID,
      prompt: 'Please respond with exactly: "Hello from Claude Code via API"'
    })
    
    const options = {
      hostname: 'localhost',
      port: API_PORT,
      path: '/api/claude/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(postData)
      }
    }
    
    const req = http.request(options, (res) => {
      log(`✅ Connected to streaming endpoint (${res.statusCode})`, 'green')
      log(`   Headers: ${JSON.stringify(res.headers)}`, 'cyan')
      
      let messageCount = 0
      let receivedContent = ''
      let buffer = ''
      
      res.on('data', (chunk) => {
        buffer += chunk.toString()
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              messageCount++
              
              log(`📨 Message ${messageCount}: ${data.type}`, 'cyan')
              
              if (data.content) {
                receivedContent += data.content
                log(`   Content: ${data.content}`, 'cyan')
              }
              
              if (data.error) {
                log(`❌ Error: ${data.error}`, 'red')
              }
              
              if (data.type === 'stream_complete') {
                log(`✅ Stream completed successfully`, 'green')
                log(`📝 Full response: "${receivedContent}"`, 'green')
                log(`📊 Total messages: ${messageCount}`, 'green')
                
                if (data.claudeSessionId) {
                  log(`🆔 Claude session ID: ${data.claudeSessionId}`, 'green')
                }
                
                resolve({
                  success: true,
                  messageCount,
                  content: receivedContent,
                  claudeSessionId: data.claudeSessionId
                })
                return
              }
              
              if (data.type === 'error') {
                log(`❌ Stream error: ${data.error}`, 'red')
                resolve({
                  success: false,
                  error: data.error,
                  messageCount
                })
                return
              }
            } catch (parseError) {
              // Skip non-JSON lines
            }
          }
        }
      })
      
      res.on('end', () => {
        log(`📡 Stream ended`, 'yellow')
        resolve({
          success: messageCount > 0,
          messageCount,
          content: receivedContent
        })
      })
      
      res.on('error', (error) => {
        log(`❌ Stream error: ${error.message}`, 'red')
        reject(error)
      })
    })
    
    req.on('error', (error) => {
      log(`❌ Request error: ${error.message}`, 'red')
      reject(error)
    })
    
    req.setTimeout(30000, () => {
      log(`⏰ Request timeout`, 'yellow')
      req.destroy()
      resolve({
        success: false,
        error: 'timeout',
        messageCount: 0
      })
    })
    
    req.write(postData)
    req.end()
  })
}

async function runStreamingTest() {
  log('================================================================================', 'blue')
  log('🧪 CLAUDE CODE STREAMING TEST', 'blue')
  log('================================================================================', 'blue')
  log(`🎯 Session ID: ${TEST_SESSION_ID}`, 'cyan')
  log(`🌐 Testing on port: ${API_PORT}`, 'cyan')
  
  try {
    const result = await testStreaming()
    
    log('\n================================================================================', 'blue')
    log('📊 TEST RESULTS', 'blue')
    log('================================================================================', 'blue')
    
    if (result.success) {
      log('🎉 SUCCESS: Claude Code streaming is working!', 'green')
      log(`✅ Messages received: ${result.messageCount}`, 'green')
      log(`✅ Content length: ${result.content?.length || 0} characters`, 'green')
      
      if (result.claudeSessionId) {
        log(`✅ Session management: Claude session ID captured`, 'green')
      }
      
      log('\n💡 The API server can successfully execute Claude Code and stream responses!', 'green')
      
    } else {
      log('❌ FAILURE: Claude Code streaming is not working', 'red')
      
      if (result.error) {
        log(`   Error: ${result.error}`, 'red')
      }
      
      log('💡 Check the API server logs for details', 'yellow')
    }
    
    return result.success
    
  } catch (error) {
    log('💥 FATAL ERROR', 'red')
    log(`   ${error.message}`, 'red')
    return false
  }
}

if (require.main === module) {
  runStreamingTest().then((success) => {
    process.exit(success ? 0 : 1)
  })
}

module.exports = { runStreamingTest }