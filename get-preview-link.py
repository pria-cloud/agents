#!/usr/bin/env python3

import os
import sys

# Set environment variables for Daytona SDK
os.environ['DAYTONA_API_KEY'] = 'dtn_48917f47a7ccd44c830b8a291e336938309a328b1748c77a3fdde9872bf0b45b'
os.environ['DAYTONA_API_URL'] = 'https://api.daytona.io'
os.environ['DAYTONA_TARGET'] = 'us'

from daytona_sdk import Daytona

def main():
    sandbox_id = 'f9b8c0fa-0649-428e-9042-d774e1123721'
    
    try:
        print(f'🔍 Getting preview info for sandbox: {sandbox_id}')
        
        # Initialize Daytona SDK
        daytona = Daytona()
        
        # Get the sandbox
        print('📡 Connecting to sandbox...')
        sandbox = daytona.find_one(sandbox_id)
        
        # Get preview link for port 3000
        print('🌐 Getting preview URL for port 3000...')
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
        
    except Exception as error:
        print(f'❌ Error: {str(error)}')
        sys.exit(1)

if __name__ == '__main__':
    main() 