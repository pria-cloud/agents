#!/usr/bin/env python3
"""
Claude Code API Server - Python Implementation
Exposes Claude Code SDK functionality via HTTP endpoints with SSE streaming
Built for E2B sandbox environment with PRIA integration
"""

import os
import sys

# Ensure Python can find user-installed packages in E2B environment
home = os.path.expanduser("~")
python_version = f"python{sys.version_info.major}.{sys.version_info.minor}"
user_site_packages = os.path.join(home, '.local', 'lib', python_version, 'site-packages')
if os.path.exists(user_site_packages):
    sys.path.insert(0, user_site_packages)
    print(f"Added user site-packages to path: {user_site_packages}")
else:
    print(f"Warning: User site-packages directory not found: {user_site_packages}")

# Ensure Claude CLI is available in PATH for the Python process
current_path = os.environ.get('PATH', '')
npm_global_bin = os.path.join(home, '.npm-global', 'bin')
if npm_global_bin not in current_path:
    new_path = f"{npm_global_bin}:{current_path}"
    os.environ['PATH'] = new_path
    print(f"[CLAUDE API] Added npm-global bin to PATH: {npm_global_bin}")
    
# Verify Claude CLI is accessible
import subprocess
try:
    claude_test = subprocess.run(['claude', '--version'], capture_output=True, text=True, timeout=5)
    if claude_test.returncode == 0:
        print(f"[CLAUDE API] ✅ Claude CLI accessible: {claude_test.stdout.strip()}")
    else:
        print(f"[CLAUDE API] ❌ Claude CLI test failed: {claude_test.stderr}")
except Exception as e:
    print(f"[CLAUDE API] ❌ Claude CLI not found in PATH: {e}")
    print(f"[CLAUDE API] Current PATH: {os.environ.get('PATH', 'Not set')}")
    # Try to find Claude binary directly
    try:
        which_result = subprocess.run(['which', 'claude'], capture_output=True, text=True, timeout=5)
        if which_result.returncode == 0:
            print(f"[CLAUDE API] Claude found at: {which_result.stdout.strip()}")
        else:
            print(f"[CLAUDE API] 'which claude' failed")
    except:
        pass

import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, AsyncIterator

import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Import Claude Code SDK
try:
    from claude_code_sdk import query, ClaudeCodeOptions, AssistantMessage, TextBlock, UserMessage
    CLAUDE_SDK_AVAILABLE = True
    print("[CLAUDE API] Claude Code SDK imported successfully")
except ImportError as e:
    CLAUDE_SDK_AVAILABLE = False
    print(f"[CLAUDE API] Claude Code SDK not available: {e}")
    # Define dummy classes for development
    class ClaudeCodeOptions:
        def __init__(self, **kwargs):
            pass
    
    class AssistantMessage:
        pass
    
    class TextBlock:
        pass
    
    async def query(*args, **kwargs):
        yield {"content": "SDK not available"}

# Claude CLI will be available via PATH (set up in start_python_api.sh)


class ClaudeQueryRequest(BaseModel):
    prompt: str
    sessionId: Optional[str] = None
    options: Optional[Dict[str, Any]] = None


class ClaudeAPIServer:
    def __init__(self):
        self.app = FastAPI(
            title="Claude Code API Server (Python)",
            version="2.0.0",
            description="Python-based Claude Code SDK API with SSE streaming"
        )
        self.active_sessions: Dict[str, Any] = {}
        self.environment = self.detect_environment()
        self.setup_middleware()
        self.setup_routes()
        
    def detect_environment(self) -> Dict[str, Any]:
        """Detect if running in E2B sandbox or local environment"""
        is_e2b = bool(os.getenv("E2B_SANDBOX_ID")) or "/home/user" in os.getcwd()
        
        if is_e2b:
            working_dir = "/home/user/template"
            env_type = "e2b"
        else:
            working_dir = os.path.join(os.getcwd(), "temp-sessions")
            env_type = "local"
        
        # Ensure working directory exists
        Path(working_dir).mkdir(parents=True, exist_ok=True)
        
        # Debug: Print all environment variables that start with ANTHROPIC
        print("[DEBUG] Environment variables starting with ANTHROPIC:")
        for key, value in os.environ.items():
            if key.startswith("ANTHROPIC"):
                if value:
                    print(f"[DEBUG] {key} = {value[:20]}...{value[-10:]} (length: {len(value)})")
                else:
                    print(f"[DEBUG] {key} = (empty)")
        
        # Check for API key
        api_key = os.getenv("ANTHROPIC_API_KEY")
        print(f"[DEBUG] ANTHROPIC_API_KEY found: {bool(api_key)}")
        print(f"[DEBUG] ANTHROPIC_API_KEY length: {len(api_key) if api_key else 0}")
        
        # Debug: Show first few environment variables to confirm env access
        print("[DEBUG] Sample environment variables:")
        for i, (key, value) in enumerate(os.environ.items()):
            if i < 5:  # Show first 5 env vars
                print(f"[DEBUG] {key} = {value[:20]}...")
            else:
                break
        
        return {
            "type": env_type,
            "working_directory": working_dir,
            "api_key_available": bool(api_key),
            "api_key_length": len(api_key or ""),
            "template_version": "2.0.0"
        }
    
    def setup_middleware(self):
        """Configure CORS and other middleware"""
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    def setup_routes(self):
        """Configure all API routes"""
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint with comprehensive system information"""
            return {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "claude_sdk_available": CLAUDE_SDK_AVAILABLE,
                "claude_sdk_version": "0.0.19" if CLAUDE_SDK_AVAILABLE else None,
                "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                "active_sessions": len(self.active_sessions),
                "environment": self.environment,
                "anthropic_api_key_present": self.environment["api_key_available"],
                "anthropic_api_key_length": self.environment["api_key_length"],
                "working_directory": self.environment["working_directory"]
            }
        
        @self.app.post("/api/claude/stream")
        async def stream_claude_response(request: ClaudeQueryRequest):
            """
            Stream Claude Code responses using Server-Sent Events
            Compatible with existing Builder App SSE interface
            """
            if not CLAUDE_SDK_AVAILABLE:
                raise HTTPException(status_code=503, detail="Claude Code SDK not available")
            
            if not request.prompt:
                raise HTTPException(status_code=400, detail="Missing prompt")
            
            session_id = request.sessionId or str(uuid.uuid4())
            
            # Determine working directory for this session
            if self.environment["type"] == "e2b":
                working_dir = self.environment["working_directory"]
            else:
                working_dir = os.path.join(self.environment["working_directory"], f"session-{session_id}")
                Path(working_dir).mkdir(parents=True, exist_ok=True)
            
            print(f"[CLAUDE API] Starting stream for session: {session_id}")
            print(f"[CLAUDE API] Working directory: {working_dir}")
            print(f"[CLAUDE API] Prompt: {request.prompt[:100]}...")
            
            async def event_stream():
                try:
                    # Send initial stream start event
                    yield self.format_sse_event({
                        "type": "stream_start",
                        "sessionId": session_id,
                        "workingDirectory": working_dir,
                        "message": "Starting Claude Code execution...",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Execute Claude query and stream responses
                    async for response in self.execute_claude_query(
                        request.prompt, 
                        session_id, 
                        working_dir,
                        request.options
                    ):
                        yield self.format_sse_event(response)
                
                except Exception as error:
                    print(f"[CLAUDE API] Stream error: {error}")
                    yield self.format_sse_event({
                        "type": "error",
                        "sessionId": session_id,
                        "error": str(error),
                        "errorType": type(error).__name__,
                        "timestamp": datetime.now().isoformat()
                    })
            
            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Session-ID": session_id,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Cache-Control"
                }
            )
        
        @self.app.get("/api/claude/session/{session_id}")
        async def get_session_info(session_id: str):
            """Get information about a specific session"""
            if session_id in self.active_sessions:
                session_data = self.active_sessions[session_id]
                return {
                    "sessionId": session_id,
                    "status": "active",
                    "workingDirectory": session_data.get("working_dir"),
                    "startTime": session_data.get("start_time"),
                    "lastActivity": session_data.get("last_activity"),
                    "messageCount": session_data.get("message_count", 0)
                }
            else:
                return {
                    "sessionId": session_id,
                    "status": "not_found"
                }
        
        @self.app.post("/api/claude/session/{session_id}/abort")
        async def abort_session(session_id: str):
            """Abort an active session"""
            if session_id in self.active_sessions:
                session_data = self.active_sessions.pop(session_id)
                print(f"[CLAUDE API] Aborted session: {session_id}")
                return {
                    "sessionId": session_id,
                    "status": "aborted",
                    "duration": datetime.now().timestamp() - session_data.get("start_time", 0)
                }
            else:
                return {
                    "sessionId": session_id,
                    "status": "not_found"
                }
        
        @self.app.get("/api/claude/debug/sessions")
        async def debug_sessions():
            """Debug endpoint to view all active sessions"""
            return {
                "totalSessions": len(self.active_sessions),
                "sessions": {
                    sid: {
                        "status": data.get("status"),
                        "workingDir": data.get("working_dir"),
                        "messageCount": data.get("message_count", 0),
                        "duration": datetime.now().timestamp() - data.get("start_time", 0)
                    }
                    for sid, data in self.active_sessions.items()
                },
                "environment": self.environment,
                "serverInfo": {
                    "uptime": "N/A",  # Could implement proper uptime tracking
                    "timestamp": datetime.now().isoformat()
                }
            }
        
        @self.app.get("/test-claude-sdk")
        async def test_claude_sdk():
            """Test endpoint to verify Claude SDK functionality"""
            if not CLAUDE_SDK_AVAILABLE:
                return {
                    "success": False,
                    "error": "Claude Code SDK not available",
                    "sdkAvailable": False
                }
            
            try:
                test_prompt = "Hello! Can you respond with just 'Python SDK test successful'?"
                
                print(f"[CLAUDE API] Testing SDK with prompt: {test_prompt}")
                
                messages = []
                message_count = 0
                
                # Create test options
                options = ClaudeCodeOptions(
                    max_turns=3,
                    allowed_tools=["Read", "Write"],
                    permission_mode="bypassPermissions",
                    cwd=self.environment["working_directory"]
                )
                
                # Test the SDK with proper keyword arguments
                async for message in query(prompt=test_prompt, options=options):
                    message_count += 1
                    
                    print(f"[CLAUDE API] SDK Test Message {message_count}: {type(message)}")
                    
                    # Extract content based on message type
                    content = ""
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                content = block.text
                                break
                    elif hasattr(message, 'content'):
                        content = str(message.content)
                    elif hasattr(message, 'text'):
                        content = str(message.text)
                    else:
                        content = str(message)
                    
                    messages.append({
                        "type": type(message).__name__,
                        "content": content,
                        "contentLength": len(content)
                    })
                
                return {
                    "success": True,
                    "messageCount": message_count,
                    "messages": messages[:3],  # Return first 3 messages
                    "sdkAvailable": True,
                    "testInfo": {
                        "cwd": self.environment["working_directory"],
                        "hasApiKey": self.environment["api_key_available"],
                        "environment": self.environment["type"]
                    }
                }
            
            except Exception as error:
                print(f"[CLAUDE API] SDK test failed: {error}")
                return {
                    "success": False,
                    "error": str(error),
                    "errorType": type(error).__name__,
                    "sdkAvailable": True,
                    "testInfo": {
                        "cwd": self.environment["working_directory"],
                        "hasApiKey": self.environment["api_key_available"],
                        "environment": self.environment["type"]
                    }
                }
    
    async def execute_claude_query(
        self, 
        prompt: str, 
        session_id: str,
        working_dir: str,
        options: Optional[Dict[str, Any]] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute Claude query with streaming responses
        Yields formatted response events for SSE streaming
        """
        
        # Default options for PRIA environment
        default_options = ClaudeCodeOptions(
            max_turns=10,
            allowed_tools=["Read", "Write", "Bash"],
            permission_mode="bypassPermissions",
            system_prompt="You are Claude Code operating in a PRIA development environment. "
                         "You have full access to read, write, and execute files. "
                         "Generate production-ready, PRIA-compliant code following the guidelines.",
            cwd=working_dir
        )
        
        # Use provided options or defaults
        query_options = default_options
        if options:
            # Merge custom options if provided
            for key, value in options.items():
                if hasattr(query_options, key):
                    setattr(query_options, key, value)
        
        # Track session
        session_start_time = datetime.now().timestamp()
        self.active_sessions[session_id] = {
            "status": "active",
            "working_dir": working_dir,
            "start_time": session_start_time,
            "last_activity": session_start_time,
            "message_count": 0
        }
        
        try:
            message_count = 0
            total_content = ""
            
            print(f"[CLAUDE API] Executing query with options: {query_options}")
            
            # Execute query with async iteration using proper cwd in options
            async for message in query(prompt=prompt, options=query_options):
                message_count += 1
                
                print(f"[CLAUDE API] SDK Message {message_count}: {type(message)}")
                
                # Extract content based on message type
                extracted_content = ""
                message_type = "unknown"
                
                if isinstance(message, AssistantMessage):
                    message_type = "assistant"
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            extracted_content = block.text
                            break
                elif hasattr(message, 'content'):
                    message_type = "content"
                    extracted_content = str(message.content)
                elif hasattr(message, 'text'):
                    message_type = "text"
                    extracted_content = str(message.text)
                else:
                    message_type = "raw"
                    extracted_content = str(message)
                
                total_content += extracted_content
                
                # Update session tracking
                self.active_sessions[session_id].update({
                    "last_activity": datetime.now().timestamp(),
                    "message_count": message_count
                })
                
                # Yield streaming response in Builder App compatible format
                yield {
                    "type": "claude_message",
                    "messageNumber": message_count,
                    "content": extracted_content,
                    "metadata": {
                        "sessionId": session_id,
                        "workingDirectory": working_dir,
                        "messageId": f"sdk_msg_{message_count}",
                        "timestamp": datetime.now().isoformat(),
                        "source": "claude_code_sdk_python",
                        "messageType": message_type
                    }
                }
                
                print(f"[CLAUDE API] Content extracted ({len(extracted_content)} chars): {extracted_content[:100]}...")
            
            print(f"[CLAUDE API] SDK execution completed - {message_count} messages, {len(total_content)} chars")
            
            # Send completion event
            yield {
                "type": "stream_complete",
                "sessionId": session_id,
                "totalMessages": message_count,
                "totalContentLength": len(total_content),
                "source": "claude_code_sdk_python",
                "message": "Claude Code SDK execution completed successfully",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as error:
            print(f"[CLAUDE API] Query execution error: {error}")
            yield {
                "type": "error",
                "sessionId": session_id,
                "error": str(error),
                "errorType": type(error).__name__,
                "source": "claude_code_sdk_python",
                "timestamp": datetime.now().isoformat()
            }
        finally:
            # Cleanup session
            if session_id in self.active_sessions:
                session_duration = datetime.now().timestamp() - session_start_time
                print(f"[CLAUDE API] Session {session_id} completed in {session_duration:.2f}s")
                del self.active_sessions[session_id]
    
    def format_sse_event(self, data: Dict[str, Any]) -> str:
        """Format data as Server-Sent Event"""
        return f"data: {json.dumps(data)}\n\n"


# Global server instance
server = ClaudeAPIServer()
app = server.app


@app.on_event("startup")
async def startup_event():
    """Server startup configuration"""
    print(f"[CLAUDE API] Python Claude Code API Server starting...")
    print(f"[CLAUDE API] Environment: {server.environment['type']}")
    print(f"[CLAUDE API] Working directory: {server.environment['working_directory']}")
    print(f"[CLAUDE API] Claude SDK available: {CLAUDE_SDK_AVAILABLE}")
    print(f"[CLAUDE API] API key configured: {server.environment['api_key_available']}")
    print(f"[CLAUDE API] Template version: {server.environment['template_version']}")


@app.on_event("shutdown")
async def shutdown_event():
    """Server shutdown cleanup"""
    active_count = len(server.active_sessions)
    if active_count > 0:
        print(f"[CLAUDE API] Shutting down with {active_count} active sessions")
        server.active_sessions.clear()
    print(f"[CLAUDE API] Python Claude Code API Server shut down")


if __name__ == "__main__":
    # Server configuration
    port = int(os.getenv("CLAUDE_API_PORT", 8080))  # Use 8080 for consistency
    
    print(f"[CLAUDE API] Starting server on port {port}")
    
    uvicorn.run(
        "claude_api_server:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )