#!/usr/bin/env python3
"""
Simple test for PRIA E2B sandbox template
"""
from e2b import Sandbox

def test_sandbox():
    print("Creating PRIA sandbox...")
    
    try:
        # Create sandbox
        sandbox = Sandbox("claude-code-ui-launcher")
        print("SUCCESS: Sandbox created!")
        
        # Test system commands
        print("\nTesting system commands...")
        result = sandbox.process.start_and_wait("sleep 1 && echo 'System commands work'")
        print(f"Sleep test: {'PASS' if result.exit_code == 0 else 'FAIL'}")
        
        result = sandbox.process.start_and_wait("ps aux | head -1")
        print(f"Process list: {'PASS' if result.exit_code == 0 else 'FAIL'}")
        
        result = sandbox.process.start_and_wait("which claude")
        print(f"Claude CLI found: {'PASS' if result.exit_code == 0 else 'FAIL'}")
        if result.exit_code == 0:
            print(f"  Location: {result.stdout.strip()}")
        
        # Test directory structure
        print("\nTesting directories...")
        result = sandbox.process.start_and_wait("ls -la /home/user/ | grep -E '(claudecodeui|baseline-project|.claude)'")
        if result.exit_code == 0:
            print("Directory structure: PASS")
            print(f"  Found: {result.stdout.strip()}")
        else:
            print("Directory structure: FAIL")
        
        # Start services
        print("\nStarting services...")
        sandbox.process.start("/home/user/start-all-services.sh")
        
        # Wait and test
        print("Waiting 20 seconds for startup...")
        sandbox.process.start_and_wait("sleep 20")
        
        # Test API server
        result = sandbox.process.start_and_wait("curl -s http://localhost:3008/api/github/status/test")
        print(f"API Server (3008): {'RUNNING' if result.exit_code == 0 else 'FAIL'}")
        
        # Test frontend
        result = sandbox.process.start_and_wait("curl -s http://localhost:3009")
        print(f"Frontend (3009): {'RUNNING' if result.exit_code == 0 else 'FAIL'}")
        
        print(f"\nSUCCESS: Sandbox ready!")
        print(f"Frontend: {sandbox.get_hostname(3009)}")
        print(f"API: {sandbox.get_hostname(3008)}")
        
        input("Press Enter to close...")
        sandbox.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_sandbox()