#!/usr/bin/env python3
"""
Test the PRIA E2B sandbox template
"""
import os
from e2b import Sandbox

# Test the template
def test_pria_sandbox():
    print("Testing PRIA E2B Sandbox Template...")
    print("=" * 50)
    
    try:
        # Create sandbox with our template
        sandbox = Sandbox("claude-code-ui-launcher")
        print("SUCCESS: Sandbox created successfully!")
        print(f"Sandbox URL: {sandbox.get_hostname(3009)}")
        
        # Test basic commands are available
        print("\nTesting system utilities...")
        
        # Test sleep command (was missing before)
        result = sandbox.process.start_and_wait("sleep 1 && echo 'Sleep command works'")
        if result.exit_code == 0:
            print("✅ sleep command: Available")
        else:
            print("❌ sleep command: Failed")
        
        # Test ps command
        result = sandbox.process.start_and_wait("ps aux | head -3")
        if result.exit_code == 0:
            print("✅ ps command: Available")
        else:
            print("❌ ps command: Failed")
        
        # Test grep command
        result = sandbox.process.start_and_wait("echo 'test' | grep 'test'")
        if result.exit_code == 0:
            print("✅ grep command: Available")
        else:
            print("❌ grep command: Failed")
        
        # Test Claude CLI is available
        print("\n🧠 Testing Claude CLI...")
        result = sandbox.process.start_and_wait("which claude")
        if result.exit_code == 0:
            print(f"✅ Claude CLI found at: {result.stdout.strip()}")
            
            # Test Claude CLI version
            result = sandbox.process.start_and_wait("claude --version", timeout=10)
            if result.exit_code == 0:
                print(f"✅ Claude CLI version: {result.stdout.strip()}")
            else:
                print(f"⚠️ Claude CLI version check failed: {result.stderr}")
        else:
            print("❌ Claude CLI: Not found in PATH")
        
        # Test project structure
        print("\n📂 Testing project structure...")
        result = sandbox.process.start_and_wait("ls -la /home/user/")
        if "claudecodeui" in result.stdout:
            print("✅ claudecodeui directory: Present")
        else:
            print("❌ claudecodeui directory: Missing")
        
        if "baseline-project" in result.stdout:
            print("✅ baseline-project directory: Present")
        else:
            print("❌ baseline-project directory: Missing")
        
        if ".claude" in result.stdout:
            print("✅ .claude directory: Present")
        else:
            print("❌ .claude directory: Missing")
        
        # Test services startup
        print("\n🚀 Testing services startup...")
        
        # Start the services in background
        sandbox.process.start("/home/user/start-all-services.sh")
        
        # Wait a bit for services to start
        print("⏳ Waiting 30 seconds for services to initialize...")
        sandbox.process.start_and_wait("sleep 30")
        
        # Test if services are running
        result = sandbox.process.start_and_wait("curl -s http://localhost:3008/api/github/status/test", timeout=10)
        if result.exit_code == 0:
            print("✅ API Server (3008): Running")
        else:
            print(f"❌ API Server (3008): Not responding - {result.stderr}")
        
        result = sandbox.process.start_and_wait("curl -s http://localhost:3009", timeout=10)
        if result.exit_code == 0:
            print("✅ Frontend (3009): Running")
        else:
            print(f"❌ Frontend (3009): Not responding - {result.stderr}")
        
        print(f"\n🌐 Frontend URL: {sandbox.get_hostname(3009)}")
        print(f"🔧 API URL: {sandbox.get_hostname(3008)}")
        
        # Test Claude CLI functionality
        print("\n🧪 Testing Claude CLI spawn functionality...")
        result = sandbox.process.start_and_wait(
            'cd /home/user/baseline-project && echo "test message" | claude -p --dangerously-skip-permissions', 
            timeout=30
        )
        
        if result.exit_code == 0:
            print("✅ Claude CLI spawn: Working")
            print(f"Claude response preview: {result.stdout[:200]}...")
        else:
            print(f"❌ Claude CLI spawn: Failed")
            print(f"Error: {result.stderr}")
            
            # Check if it's an authentication issue
            if "authentication" in result.stderr.lower() or "api key" in result.stderr.lower():
                print("🔑 This appears to be an API key authentication issue")
            elif "pria" in result.stderr.lower():
                print("⚠️ This might be the text replacement issue causing 'spawn pria ENOENT'")
        
        print("\n" + "=" * 50)
        print("🎉 Test completed! Sandbox is ready for use.")
        print(f"Access claudecodeui at: {sandbox.get_hostname(3009)}")
        
        # Keep sandbox open for manual testing
        input("\n⏸️ Press Enter to close the sandbox...")
        
        # Clean up
        sandbox.close()
        print("✅ Sandbox closed successfully")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pria_sandbox()