# Claude API Local Testing Guide

This guide helps you test the Claude API implementation locally before deploying to the E2B template.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Claude Code CLI** installed and working
3. **ANTHROPIC_API_KEY** environment variable (optional for basic testing)

## Quick Start

### 1. Install Dependencies

```bash
cd template/api
npm install
```

### 2. Run the Test Suite

```bash
# From the e2b-template directory
node test-claude-api-local.js

# OR from template/api directory
npm run test
```

## What the Tests Cover

### 🏥 Health Checks
- ✅ API server startup and accessibility
- ✅ Health endpoint response validation
- ✅ Environment variable detection
- ✅ Claude CLI availability check

### 🤖 Claude Code Integration
- ✅ Direct Claude CLI execution
- ✅ Basic query processing
- ✅ Version and status checks
- ✅ API key configuration

### 🗄️ Session Management
- ✅ Session directory creation
- ✅ Claude session ID detection and storage
- ✅ Session metadata tracking
- ✅ Debug endpoint functionality

### 🌊 Real-time Streaming
- ✅ Server-Sent Events (SSE) streaming
- ✅ JSON message parsing
- ✅ Progressive content delivery
- ✅ Stream completion handling

### 🔄 Session Continuity
- ✅ Multi-turn conversation support
- ✅ Claude session persistence
- ✅ Context restoration (--continue/--resume)
- ✅ Follow-up message handling

## Expected Test Output

```bash
================================================================================
🧪 CLAUDE API LOCAL TEST SUITE
================================================================================

📋 Testing Claude API implementation before E2B deployment
📅 Started: 2025-01-28T10:30:00.000Z
🎯 Test Session ID: test-session-1706437800000

============================================================
SERVER STARTUP TESTS
============================================================
✅ API Server File Exists
🚀 Starting Claude API server...
✅ API Server Started   Running on port 8080

============================================================
HEALTH CHECK TESTS
============================================================
✅ Health Endpoint Accessible   Status: 200
✅ Health Status Response   Server reports healthy
✅ Health Response Fields   All required fields present

📊 Health Check Details:
   Claude SDK Available: true
   API Key Present: true
   API Key Valid Format: true
   Working Directory: /path/to/api

============================================================
CLAUDE CLI DIRECT TESTS
============================================================
✅ Claude CLI Available   Claude CLI command found
✅ Claude CLI Query Test   Basic query successful
✅ Claude CLI Integration

============================================================
SESSION MANAGEMENT TESTS
============================================================
✅ Session Status Endpoint
✅ Claude Session Info Included   Session includes Claude session metadata
✅ Debug Sessions Endpoint

📋 Session Info:
   Session ID: test-session-1706437800000
   Working Directory: /home/user/session-test-session-1706437800000
   Directory Exists: false
   Has Stored Claude Session: false
   Can Resume: false
   Can Continue: false

🔍 Debug Info:
   Total Sessions: 0
   Claude Session Mappings: 0
   Server Uptime: 5s

============================================================
STREAMING ENDPOINT TESTS
============================================================
🌊 Testing Claude streaming with simple prompt...
✅ Streaming Endpoint Accessible   Status: 200
✅ Streaming Headers Correct   Content-Type: text/event-stream
   📨 Message 1: stream_start
   📨 Message 2: claude_message
      Content: Claude API test successful
   📨 Message 3: stream_complete
✅ Stream Start Event
✅ Stream Complete Event
✅ Received Messages   3 messages
✅ Claude Response Content   25 characters received
   📝 Full Response: Claude API test successful
✅ Claude Session ID Captured   Session ID: session_abc123def456

============================================================
SESSION CONTINUITY TESTS
============================================================
🔄 Testing session continuity with follow-up message...
✅ Follow-up Message Sent   Received response to second message
   📝 Follow-up Response: Yes, I remember our previous conversation.
✅ Session Continuity   Claude appears to remember previous context
✅ Session Persistence   Session directory created
✅ Claude Session Stored   Claude session ID: session_abc123def456

📊 Final Session State:
   Files Created: 3
   Can Resume: true
   Can Continue: true

============================================================
CLEANUP
============================================================
🧹 Cleaning up test environment...
✅ API Server Stopped
✅ Cleanup completed

============================================================
TEST SUMMARY
============================================================

📊 Test Results:
   Total Tests: 18
   Passed: 18
   Failed: 0
   Success Rate: 100%

🎉 Overall Result: READY FOR E2B DEPLOYMENT

✅ The Claude API implementation is working correctly and ready to be pushed to the E2B template.
✅ Session management, streaming, and Claude Code integration are all functional.
```

## Troubleshooting

### Common Issues

#### 1. Claude CLI Not Found
```bash
Error: Claude CLI not available
```
**Solution**: Install Claude Code CLI:
```bash
npm install -g @anthropic-ai/claude-code
# OR
curl -fsSL https://claude.ai/install.sh | sh
```

#### 2. API Key Issues
```bash
Error: ANTHROPIC_API_KEY not configured
```
**Solution**: Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

#### 3. Port Already in Use
```bash
Error: Port 8080 already in use
```
**Solution**: Kill existing processes:
```bash
lsof -ti:8080 | xargs kill -9
```

#### 4. Permission Errors
```bash
Error: EACCES: permission denied
```
**Solution**: Run with appropriate permissions or use a different directory.

### Debug Mode

For detailed logging, set environment variables:

```bash
DEBUG=claude-api* node test-claude-api-local.js
```

## Test Configuration

You can customize the test behavior by modifying these variables in `test-claude-api-local.js`:

```javascript
const API_PORT = 8080                    // API server port
const TEST_SESSION_ID = `test-session-${Date.now()}`  // Unique session ID
const API_BASE_URL = `http://localhost:${API_PORT}`   // API base URL
```

## Manual Testing

If you prefer manual testing, you can start the server and test endpoints individually:

```bash
# Start the API server
cd template/api
node claude-server.js

# In another terminal, test endpoints
curl http://localhost:8080/health
curl http://localhost:8080/test-claude-cli-direct
curl http://localhost:8080/api/claude/debug/sessions
```

### Testing Streaming Manually

```bash
# Test streaming endpoint
curl -X POST http://localhost:8080/api/claude/stream \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"sessionId":"manual-test-session","prompt":"Hello!"}'
```

## Success Criteria

The tests should pass with:
- ✅ All health checks passing
- ✅ Claude CLI integration working
- ✅ Session management functional
- ✅ Real-time streaming operational
- ✅ Session continuity working
- ✅ Success rate: 100%

## Next Steps

Once all tests pass:

1. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: Add comprehensive Claude API test suite"
   ```

2. **Rebuild E2B Template**:
   ```bash
   e2b template build
   ```

3. **Deploy to E2B**:
   ```bash
   e2b template deploy
   ```

4. **Test in E2B Environment**:
   - Create a new sandbox from the template
   - Verify the API server starts automatically
   - Test streaming functionality
   - Validate session management

## Support

If tests fail or you encounter issues:

1. Check the console output for specific error messages
2. Verify Claude Code CLI is properly installed
3. Ensure all dependencies are installed (`npm install`)
4. Check network connectivity and API key validity
5. Review the implementation in `template/api/claude-server.js`

The test suite provides detailed error reporting to help identify and fix issues quickly.