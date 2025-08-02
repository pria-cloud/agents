/**
 * Claude Code API Server for E2B Sandbox
 * Exposes Claude Code SDK functionality via HTTP endpoints
 * Runs inside E2B sandbox environment with access to filesystem and project context
 */

const express = require('express')
const { Server } = require('ws')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs').promises

const app = express()
const PORT = process.env.CLAUDE_API_PORT || 8080

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    claude_sdk_available: true,
    working_directory: process.cwd(),
    anthropic_api_key_present: !!process.env.ANTHROPIC_API_KEY,
    anthropic_api_key_length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
    anthropic_api_key_valid_format: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-') : false,
    environment_variables: Object.keys(process.env).filter(key => key.startsWith('ANTHROPIC') || key.startsWith('CLAUDE'))
  })
})

// Test Claude Code CLI directly (bypassing SDK)
app.get('/test-claude-cli-direct', async (req, res) => {
  const { spawn } = require('child_process')
  
  console.log(`[CLAUDE API] Testing Claude Code CLI directly`)
  console.log(`[CLAUDE API] PATH: ${process.env.PATH}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[CLAUDE API] Working directory: /home/user`)
  
  try {
    // First check if claude command is available
    const claudeVersion = spawn('claude', ['--version'], {
      env: process.env,
      cwd: '/home/user'
    })
    
    let versionOutput = ''
    let versionError = ''
    
    claudeVersion.stdout.on('data', (data) => {
      versionOutput += data.toString()
    })
    
    claudeVersion.stderr.on('data', (data) => {
      versionError += data.toString()
    })
    
    claudeVersion.on('close', (code) => {
      console.log(`[CLAUDE API] Claude CLI version check exit code: ${code}`)
      console.log(`[CLAUDE API] Version output: ${versionOutput}`)
      console.log(`[CLAUDE API] Version error: ${versionError}`)
      
      if (code === 0) {
        // Check project status first
        const claudeStatus = spawn('claude', ['-p', '--status'], {
          env: process.env,
          cwd: '/home/user'
        })
        
        let statusOutput = ''
        let statusError = ''
        
        claudeStatus.stdout.on('data', (data) => {
          statusOutput += data.toString()
        })
        
        claudeStatus.stderr.on('data', (data) => {
          statusError += data.toString()
        })
        
        claudeStatus.on('close', (statusCode) => {
          console.log(`[CLAUDE API] Claude project status check exit code: ${statusCode}`)
          console.log(`[CLAUDE API] Status output: ${statusOutput}`)
          console.log(`[CLAUDE API] Status error: ${statusError}`)
          
          // Now test a simple query with -p flag
          const claudeQuery = spawn('claude', ['-p', '--', 'Hello, respond with just "CLI test successful"'], {
            env: process.env,
            cwd: '/home/user'
          })
          
          let queryOutput = ''
          let queryError = ''
        
          claudeQuery.stdout.on('data', (data) => {
            queryOutput += data.toString()
          })
          
          claudeQuery.stderr.on('data', (data) => {
            queryError += data.toString()
          })
          
          claudeQuery.on('close', (queryCode) => {
            console.log(`[CLAUDE API] Claude CLI query exit code: ${queryCode}`)
            console.log(`[CLAUDE API] Query output: ${queryOutput}`)
            console.log(`[CLAUDE API] Query error: ${queryError}`)
            
            res.json({
              success: queryCode === 0,
              cliAvailable: true,
              cliVersion: versionOutput.trim(),
              projectStatus: {
                exitCode: statusCode,
                output: statusOutput.trim(),
                error: statusError.trim()
              },
              queryTest: {
                exitCode: queryCode,
                output: queryOutput.trim(),
                error: queryError.trim()
              }
            })
          })
        })
      } else {
        res.status(500).json({
          success: false,
          cliAvailable: false,
          error: 'Claude CLI not found or not working',
          exitCode: code,
          versionOutput: versionOutput.trim(),
          versionError: versionError.trim()
        })
      }
    })
    
  } catch (error) {
    console.error(`[CLAUDE API] Direct CLI test failed:`, error)
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
})

// Test endpoint to verify Claude Code SDK basic functionality  
app.get('/test-claude-sdk', async (req, res) => {
  console.log(`[CLAUDE API] Testing Claude Code SDK functionality`)
  console.log(`[CLAUDE API] Working directory: ${process.cwd()}`)
  console.log(`[CLAUDE API] PATH: ${process.env.PATH}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY length: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0}`)
  
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ 
      error: 'ANTHROPIC_API_KEY not found in environment',
      available_env_vars: Object.keys(process.env).filter(key => key.includes('ANTHROPIC') || key.includes('CLAUDE')),
      cwd: process.cwd(),
      path: process.env.PATH
    })
  }
  
  try {
    console.log(`[CLAUDE API] Attempting simple Claude Code SDK test`)
    console.log(`[CLAUDE API] SDK query() function available: ${typeof query === 'function'}`)
    
    // Test with a very simple prompt and minimal options
    let messageCount = 0
    const messages = []
    const startTime = Date.now()
    
    console.log(`[CLAUDE API] Starting query() call...`)
    
    // Test Claude CLI with correct flags
    const testProcess = spawn('claude', [
      '-p',
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json',
      '--verbose',
      '--',
      'Hello, can you respond with just "test successful"?'
    ], {
      cwd: '/home/user',
      env: process.env
    })
    
    let testBuffer = ''
    
    return new Promise((resolve, reject) => {
      testProcess.stdout.on('data', (data) => {
        const chunk = data.toString()
        testBuffer += chunk
        
        const lines = testBuffer.split('\n')
        testBuffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line.trim())
              messageCount++
              
              console.log(`[CLAUDE API] Received test message ${messageCount}:`, {
                type: jsonData.type,
                contentLength: jsonData.content?.length || 0,
                hasContent: !!jsonData.content
              })
              
              messages.push({
                type: jsonData.type,
                content: jsonData.content,
                contentLength: jsonData.content?.length || 0
              })
              
            } catch (parseError) {
              console.log(`[CLAUDE API] Test non-JSON line: ${line.substring(0, 100)}...`)
            }
          }
        }
      })
      
      testProcess.on('close', (code) => {
        console.log(`[CLAUDE API] Test process completed with code: ${code}`)
        resolve()
      })
      
      testProcess.on('error', (error) => {
        console.error(`[CLAUDE API] Test process error:`, error)
        reject(error)
      })
    })
    
    const duration = Date.now() - startTime
    console.log(`[CLAUDE API] SDK test completed successfully - ${messageCount} messages in ${duration}ms`)
    
    res.json({
      success: true,
      message: 'Claude Code SDK is working',
      messageCount,
      duration,
      messages: messages.slice(0, 3), // Only return first 3 messages
      testInfo: {
        cwd: process.cwd(),
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        sdkFunction: typeof query
      }
    })
    
  } catch (error) {
    console.error(`[CLAUDE API] SDK test failed:`, error)
    
    res.status(500).json({
      success: false,
      error: error.message,
      errorName: error.name,
      errorCause: error.cause,
      stack: error.stack,
      testInfo: {
        cwd: process.cwd(),
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        sdkFunction: typeof query,
        path: process.env.PATH
      }
    })
  }
})

// Environment configuration endpoint - allows setting API key at runtime
app.post('/configure-environment', (req, res) => {
  const { ANTHROPIC_API_KEY } = req.body
  
  console.log(`[CLAUDE API] Configuring environment variables`)
  console.log(`[CLAUDE API] Received API key present: ${!!ANTHROPIC_API_KEY}`)
  console.log(`[CLAUDE API] Received API key length: ${ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.length : 0}`)
  
  if (!ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY is required' })
  }
  
  if (!ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    return res.status(400).json({ error: 'Invalid ANTHROPIC_API_KEY format - must start with sk-ant-' })
  }
  
  // Set environment variable for this process
  process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY
  
  console.log(`[CLAUDE API] Environment variable set successfully`)
  
  res.json({
    success: true,
    message: 'ANTHROPIC_API_KEY configured successfully',
    api_key_length: ANTHROPIC_API_KEY.length,
    timestamp: new Date().toISOString()
  })
})

// Single message endpoint with Server-Sent Events streaming
app.post('/api/claude/stream', async (req, res) => {
  const { prompt, sessionId, options = {} } = req.body
  
  if (!prompt || !sessionId) {
    return res.status(400).json({ error: 'Missing prompt or sessionId' })
  }

  console.log(`[CLAUDE API] Starting stream for session: ${sessionId}`)
  console.log(`[CLAUDE API] Prompt: ${prompt.substring(0, 100)}...`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY length: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY starts with sk-ant-: ${process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-') : false}`)
  
  // Check if API key is available before proceeding
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`[CLAUDE API] ERROR: ANTHROPIC_API_KEY environment variable not found`)
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }
  
  if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    console.error(`[CLAUDE API] ERROR: ANTHROPIC_API_KEY does not start with sk-ant-`)
    return res.status(500).json({ error: 'Invalid ANTHROPIC_API_KEY format' })
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  const sendEvent = (type, data) => {
    const eventData = JSON.stringify({ type, ...data, timestamp: new Date().toISOString() })
    res.write(`data: ${eventData}\n\n`)
  }

  try {
    // Set working directory to session-specific path
    const workingDir = path.join('/home/user', `session-${sessionId}`)
    
    // Ensure working directory exists
    await fs.mkdir(workingDir, { recursive: true })

    console.log(`[CLAUDE API] Using working directory: ${workingDir}`)
    
    sendEvent('stream_start', {
      sessionId,
      workingDirectory: workingDir,
      message: 'Starting Claude Code execution...'
    })

    let messageCount = 0
    let totalContent = ''

    console.log(`[CLAUDE API] About to call Claude Code SDK query() function`)
    console.log(`[CLAUDE API] Working directory: ${workingDir}`)
    console.log(`[CLAUDE API] SDK Options:`, {
      cwd: workingDir,
      maxTurns: options.maxTurns || 10,
      permissionMode: 'dangerously-skip-permissions',
      context: {
        sessionId: sessionId,
        workspaceType: 'e2b-sandbox'
      }
    })
    
    try {
      // Use Claude CLI with correct flags for real-time streaming
      console.log(`[CLAUDE API] Executing Claude CLI with proper flags`)
      console.log(`[CLAUDE API] Prompt: ${prompt.substring(0, 100)}...`)
      console.log(`[CLAUDE API] Working directory: ${workingDir}`)
      console.log(`[CLAUDE API] Command: claude -p --dangerously-skip-permissions --output-format stream-json --verbose`)
      
      // Spawn Claude CLI process with correct flags
      const claudeProcess = spawn('claude', [
        '-p',
        '--dangerously-skip-permissions',
        '--output-format', 'stream-json', 
        '--verbose',
        '--',
        prompt
      ], {
        cwd: workingDir,
        env: process.env
      })
      
      let outputBuffer = ''
      let isCompleted = false
      
      // Handle real-time stdout streaming
      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString()
        outputBuffer += chunk
        
        console.log(`[CLAUDE API] Received stdout chunk: ${chunk.length} chars`)
        
        // Process stream-json lines in real-time
        const lines = outputBuffer.split('\n')
        outputBuffer = lines.pop() || '' // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const jsonData = JSON.parse(line.trim())
              messageCount++
              
              console.log(`[CLAUDE API] Parsed JSON message ${messageCount}:`, {
                type: jsonData.type,
                contentLength: jsonData.content?.length || 0
              })
              
              // Send real-time update to Builder App
              sendEvent('claude_message', {
                messageNumber: messageCount,
                type: jsonData.type || 'message',
                content: jsonData.content || jsonData.message || '',
                metadata: {
                  sessionId,
                  workingDirectory: workingDir,
                  messageId: jsonData.id || `msg_${messageCount}`,
                  timestamp: new Date().toISOString(),
                  rawLine: line.trim()
                }
              })
              
              if (jsonData.content) {
                totalContent += jsonData.content
              }
              
            } catch (parseError) {
              console.log(`[CLAUDE API] Non-JSON line (progress): ${line.substring(0, 100)}...`)
              
              // Send as progress update for verbose output
              sendEvent('progress', {
                message: line.trim(),
                step: messageCount,
                sessionId,
                timestamp: new Date().toISOString()
              })
            }
          }
        }
      })
      
      // Handle stderr (Claude often sends useful info to stderr)
      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString()
        console.log(`[CLAUDE API] Received stderr: ${chunk}`)
        
        // Send stderr as progress info
        sendEvent('progress', {
          message: chunk.trim(),
          type: 'info',
          sessionId,
          timestamp: new Date().toISOString()
        })
      })
      
      // Handle process completion
      claudeProcess.on('close', (code) => {
        console.log(`[CLAUDE API] Claude CLI process exited with code: ${code}`)
        isCompleted = true
        
        if (code !== 0) {
          console.error(`[CLAUDE API] Claude CLI failed with exit code ${code}`)
          
          sendEvent('error', {
            sessionId,
            error: `Claude CLI execution failed with exit code ${code}`,
            exitCode: code,
            type: 'cli_error'
          })
        } else {
          console.log(`[CLAUDE API] Claude CLI completed successfully`)
          
          sendEvent('stream_complete', {
            sessionId,
            totalMessages: messageCount,
            totalContentLength: totalContent.length,
            exitCode: code,
            message: 'Claude CLI execution completed successfully'
          })
        }
        
        // Close the SSE connection
        try {
          res.end()
        } catch (endError) {
          console.log(`[CLAUDE API] Connection already closed`)
        }
      })
      
      // Handle process errors
      claudeProcess.on('error', (error) => {
        console.error(`[CLAUDE API] Claude CLI spawn error:`, error)
        
        sendEvent('error', {
          sessionId,
          error: `Failed to start Claude CLI: ${error.message}`,
          details: error.stack,
          type: 'spawn_error'
        })
        
        try {
          res.end()
        } catch (endError) {
          console.log(`[CLAUDE API] Connection already closed`)
        }
      })
      
      // Handle client disconnect
      req.on('close', () => {
        if (!isCompleted) {
          console.log(`[CLAUDE API] Client disconnected, terminating Claude CLI process`)
          claudeProcess.kill('SIGTERM')
        }
      })
    } catch (claudeError) {
      console.error(`[CLAUDE API] Claude Code SDK error:`, claudeError)
      console.error(`[CLAUDE API] Error name:`, claudeError.name)
      console.error(`[CLAUDE API] Error message:`, claudeError.message)
      console.error(`[CLAUDE API] Error stack:`, claudeError.stack)
      console.error(`[CLAUDE API] Error cause:`, claudeError.cause)
      
      // Check if it's an authentication error
      if (claudeError.message && claudeError.message.toLowerCase().includes('api key')) {
        console.error(`[CLAUDE API] API key authentication error detected`)
        sendEvent('error', {
          sessionId,
          error: 'Claude Code SDK authentication failed - ANTHROPIC_API_KEY issue',
          details: claudeError.message,
          type: 'authentication_error'
        })
        return
      }
      
      // Check if it's a network/socket error
      if (claudeError.cause && claudeError.cause.code === 'UND_ERR_SOCKET') {
        console.error(`[CLAUDE API] Socket connection error detected`)
        sendEvent('error', {
          sessionId,
          error: 'Claude Code SDK network connection failed',
          details: `Socket error: ${claudeError.cause.message || 'Connection closed by remote'}`,
          type: 'network_error'
        })
        return
      }
      
      // Generic error handling
      sendEvent('error', {
        sessionId,
        error: `Claude Code SDK execution failed: ${claudeError.message}`,
        details: claudeError.stack,
        type: 'sdk_error'
      })
      return
    }

    // Send completion event
    sendEvent('stream_complete', {
      sessionId,
      totalMessages: messageCount,
      totalContentLength: totalContent.length,
      message: 'Claude Code execution completed successfully'
    })

    console.log(`[CLAUDE API] Stream completed - ${messageCount} messages, ${totalContent.length} chars`)

  } catch (error) {
    console.error('[CLAUDE API] Stream error:', error)
    
    sendEvent('error', {
      sessionId,
      error: error.message,
      stack: error.stack
    })
  } finally {
    res.end()
  }
})

// Session status endpoint
app.get('/api/claude/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  const workingDir = path.join('/home/user', `session-${sessionId}`)
  
  try {
    const stats = await fs.stat(workingDir)
    const files = await fs.readdir(workingDir)
    
    res.json({
      sessionId,
      workingDirectory: workingDir,
      exists: true,
      created: stats.birthtime,
      modified: stats.mtime,
      fileCount: files.length,
      files: files.slice(0, 10) // First 10 files
    })
  } catch (error) {
    res.json({
      sessionId,
      workingDirectory: workingDir,
      exists: false,
      error: error.message
    })
  }
})

// File operations endpoint
app.get('/api/claude/session/:sessionId/files', async (req, res) => {
  const { sessionId } = req.params
  const workingDir = path.join('/home/user', `session-${sessionId}`)
  
  try {
    const files = await fs.readdir(workingDir, { withFileTypes: true })
    const fileList = files.map(file => ({
      name: file.name,
      type: file.isDirectory() ? 'directory' : 'file',
      path: path.join(workingDir, file.name)
    }))
    
    res.json({
      sessionId,
      workingDirectory: workingDir,
      files: fileList
    })
  } catch (error) {
    res.status(404).json({
      sessionId,
      error: error.message
    })
  }
})

// Start HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CLAUDE API] Server running on port ${PORT}`)
  console.log(`[CLAUDE API] Working directory: ${process.cwd()}`)
  console.log(`[CLAUDE API] Claude Code SDK available: ${typeof query === 'function'}`)
  console.log(`[CLAUDE API] ANTHROPIC_API_KEY configured: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[CLAUDE API] Template version: 2.0.0 - Snapshot-based architecture`)
})

// WebSocket server for real-time communication (future enhancement)
const wss = new Server({ server })

wss.on('connection', (ws) => {
  console.log('[CLAUDE API] WebSocket client connected')
  
  ws.on('message', async (data) => {
    try {
      const { type, payload } = JSON.parse(data)
      
      if (type === 'claude_query') {
        const { prompt, sessionId, options } = payload
        
        ws.send(JSON.stringify({
          type: 'stream_start',
          sessionId,
          timestamp: new Date().toISOString()
        }))
        
        // Stream Claude CLI responses via WebSocket
        const workingDir = path.join('/home/user', `session-${sessionId}`)
        
        const claudeProcess = spawn('claude', [
          '-p',
          '--dangerously-skip-permissions',
          '--output-format', 'stream-json',
          '--verbose',
          '--',
          prompt
        ], {
          cwd: workingDir,
          env: process.env
        })
        
        let outputBuffer = ''
        
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString()
          outputBuffer += chunk
          
          const lines = outputBuffer.split('\n')
          outputBuffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const jsonData = JSON.parse(line.trim())
                
                ws.send(JSON.stringify({
                  type: 'claude_message',
                  data: jsonData,
                  timestamp: new Date().toISOString()
                }))
                
              } catch (parseError) {
                ws.send(JSON.stringify({
                  type: 'progress',
                  message: line.trim(),
                  timestamp: new Date().toISOString()
                }))
              }
            }
          }
        })
        
        claudeProcess.on('close', (code) => {
          ws.send(JSON.stringify({
            type: 'stream_complete',
            sessionId,
            exitCode: code,
            timestamp: new Date().toISOString()
          }))
        })
        
        claudeProcess.on('error', (error) => {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          }))
        })
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }))
    }
  })
  
  ws.on('close', () => {
    console.log('[CLAUDE API] WebSocket client disconnected')
  })
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[CLAUDE API] Shutting down gracefully...')
  server.close(() => {
    console.log('[CLAUDE API] Server closed')
    process.exit(0)
  })
})

module.exports = app