#!/usr/bin/env python3

import os
import sys
import time
import threading
import ssl
import urllib3
from daytona_sdk import Daytona

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def main():
    # Get API key from command line or environment
    api_key = sys.argv[1] if len(sys.argv) > 1 else os.getenv('DAYTONA_API_KEY')
    
    if not api_key:
        print('❌ DAYTONA_API_KEY environment variable or command line argument required')
        print('Usage: python daytona-create-and-preview.py <api_key>')
        sys.exit(1)
    
    try:
        print('🚀 Creating new Daytona sandbox...')
        
        # Set environment variables for the SDK
        os.environ['DAYTONA_API_KEY'] = api_key
        os.environ['DAYTONA_API_URL'] = 'https://api.daytona.io'
        os.environ['DAYTONA_TARGET'] = 'us'
        
        # Initialize Daytona SDK with environment variables
        daytona = Daytona()
        
        # Create a new sandbox
        print('📦 Creating sandbox...')
        sandbox = daytona.create()
        
        print(f'✅ Sandbox created successfully!')
        print(f'📋 Sandbox ID: {sandbox.id}')
        
        # Setup the sandbox
        print('\n📂 Setting up sandbox...')
        setup_sandbox(sandbox)
        
        # Get preview link for port 3000
        print('\n🌐 Getting preview URL for port 3000...')
        preview_info = sandbox.get_preview_link(3000)
        
        print(f"Preview link url: {preview_info.url}")
        print(f"Preview link token: {preview_info.token}")
        
        print('\n🎉 SUCCESS! Your scaffold application is ready!')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print(f'🔗 Preview URL: {preview_info.url}')
        print(f'🔑 Auth Token: {preview_info.token}')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        
        print(f'\n📋 Access Methods:')
        print(f'🌐 Browser: {preview_info.url}')
        print(f'💻 cURL: curl -H "x-daytona-preview-token: {preview_info.token}" {preview_info.url}')
        
        return {
            'sandbox_id': sandbox.id,
            'url': preview_info.url,
            'token': preview_info.token
        }
        
    except Exception as error:
        print(f'❌ Error: {str(error)}')
        
        # Try alternative approach with explicit SSL context
        try:
            print('\n🔄 Trying alternative SSL configuration...')
            
            # Create unverified SSL context
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Re-initialize with different settings
            os.environ['PYTHONHTTPSVERIFY'] = '0'
            
            daytona = Daytona()
            sandbox = daytona.create()
            
            print(f'✅ Sandbox created with alternative SSL config!')
            print(f'📋 Sandbox ID: {sandbox.id}')
            
            setup_sandbox(sandbox)
            
            preview_info = sandbox.get_preview_link(3000)
            
            print(f"Preview link url: {preview_info.url}")
            print(f"Preview link token: {preview_info.token}")
            
            return {
                'sandbox_id': sandbox.id,
                'url': preview_info.url,
                'token': preview_info.token
            }
            
        except Exception as alt_error:
            print(f'❌ Alternative approach also failed: {str(alt_error)}')
            sys.exit(1)

def setup_sandbox(sandbox):
    """Set up the sandbox with repository clone, dependency installation, and dev server"""
    
    print('📂 Cloning repository...')
    clone_code = '''
import subprocess
import os

# Change to home directory
os.chdir('/home/daytona')
print(f"Current directory: {os.getcwd()}")

# Clone the repository
print("Cloning repository...")
result = subprocess.run(['git', 'clone', 'https://github.com/pria-cloud/agents.git'], 
                       capture_output=True, text=True)
print(f"Clone exit code: {result.returncode}")
print(f"Clone output: {result.stdout}")
if result.stderr:
    print(f"Clone errors: {result.stderr}")

# List directory contents
print(f"Directory contents after clone: {os.listdir('.')}")
'''
    
    response = sandbox.process.code_run(clone_code)
    print(f"✅ Repository cloned")
    print(f"📝 Clone output: {response.result}")
    
    print('🔧 Installing dependencies...')
    install_code = '''
import subprocess
import os

# Change to the scaffold-files directory
os.chdir('/home/daytona/agents/scaffold-files')
print(f"Changed to agents/scaffold-files directory")
print(f"Current directory: {os.getcwd()}")
print(f"Files here: {os.listdir('.')}")

# Install dependencies with legacy peer deps to handle React version conflicts
result = subprocess.run(['npm', 'install', '--legacy-peer-deps'], 
                       capture_output=True, text=True)
print(f"Exit code: {result.returncode}")
print(f"Output: {result.stdout}")
if result.stderr:
    print(f"Errors: {result.stderr}")
'''
    
    response = sandbox.process.code_run(install_code)
    print(f"✅ Dependencies installed")
    print(f"📝 Install output: {response.result}")
    
    print('🚀 Starting development server in background...')
    dev_server_code = '''
import subprocess
import threading
import os

def start_dev_server():
    """Start the development server in background"""
    os.chdir('/home/daytona/agents/scaffold-files')
    print("Starting npm run dev in background...")
    
    # Start dev server
    process = subprocess.Popen(['npm', 'run', 'dev'], 
                              stdout=subprocess.PIPE, 
                              stderr=subprocess.PIPE, 
                              text=True)
    
    print(f"Development server started with PID: {process.pid}")
    return process

# Start dev server in background thread
thread = threading.Thread(target=start_dev_server)
thread.daemon = True
thread.start()

print("✅ Development server startup initiated in background")
print("⏳ Server should be available in 30-60 seconds on port 3000")
'''
    
    response = sandbox.process.code_run(dev_server_code)
    print(f"✅ Development server started")
    print(f"📝 Server output: {response.result}")
    
    # Wait a bit for the server to start
    print('⏳ Waiting for development server to initialize...')
    time.sleep(10)

if __name__ == '__main__':
    main() 