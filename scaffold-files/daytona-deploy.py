#!/usr/bin/env python3
"""
Daytona Scaffold Deployment Script
Creates a Daytona sandbox from the scaffold application
"""

import os
import sys

try:
    from daytona import Daytona, CreateSandboxFromGitParams
except ImportError:
    print("Installing Daytona SDK...")
    os.system("pip install daytona")
    from daytona import Daytona, CreateSandboxFromGitParams

def deploy_scaffold_to_daytona(api_key, repo_url, organization_id=None):
    """Deploy the scaffold application to Daytona"""
    
    # Initialize Daytona client with API key
    os.environ['DAYTONA_API_KEY'] = api_key
    daytona = Daytona()
    
    try:
        print("🚀 Creating Daytona sandbox for scaffold application...")
        
        # Create sandbox from git repository
        params = CreateSandboxFromGitParams(
            repository=repo_url,
            branch="main",  # or your default branch
            auto_stop_interval=0,  # Keep running indefinitely
            resources={
                "cpu": 2,    # 2 CPU cores
                "memory": 4, # 4GB RAM  
                "disk": 8,   # 8GB disk
            },
            labels={
                "project": "scaffold-app",
                "type": "nextjs-development",
                "api-enabled": "true"
            }
        )
        
        sandbox = daytona.create(params)
        
        print(f"✅ Sandbox created successfully!")
        print(f"📋 Sandbox ID: {sandbox.id}")
        print(f"🌐 Sandbox URL: Will be available once started")
        
        # Get sandbox details
        root_dir = sandbox.get_user_root_dir()
        print(f"📁 Root directory: {root_dir}")
        
        print(f"\n🔧 Installing dependencies...")
        # Install dependencies
        install_result = sandbox.process.run("npm install")
        if install_result.exit_code == 0:
            print("✅ Dependencies installed successfully")
        else:
            print(f"❌ Failed to install dependencies: {install_result.stderr}")
        
        print(f"\n🏗️ Building application...")
        # Build the application
        build_result = sandbox.process.run("npm run build")
        if build_result.exit_code == 0:
            print("✅ Application built successfully")
        else:
            print(f"❌ Build failed: {build_result.stderr}")
        
        print(f"\n🚀 Starting development server...")
        # Start the development server in background
        start_result = sandbox.process.run("npm run dev", background=True)
        
        print(f"\n🎉 Scaffold application deployed to Daytona!")
        print(f"🔗 Access your application through Daytona's preview URL")
        print(f"🛠️ Sandbox ID: {sandbox.id}")
        
        # Return sandbox for further operations
        return sandbox
        
    except Exception as e:
        print(f"❌ Error deploying to Daytona: {str(e)}")
        return None

def create_from_current_directory(api_key):
    """Create a sandbox from the current directory (if it's a git repo)"""
    
    # Check if current directory is a git repository
    if not os.path.exists('.git'):
        print("❌ Current directory is not a git repository")
        print("💡 Please run this from your scaffold repository root, or provide a git URL")
        return None
    
    # Get the remote origin URL
    try:
        import subprocess
        result = subprocess.run(['git', 'remote', 'get-url', 'origin'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            repo_url = result.stdout.strip()
            print(f"📁 Detected repository: {repo_url}")
            return deploy_scaffold_to_daytona(api_key, repo_url)
        else:
            print("❌ Could not get git remote URL")
            return None
    except Exception as e:
        print(f"❌ Error getting git remote: {str(e)}")
        return None

if __name__ == "__main__":
    API_KEY = "dtn_9a351cb5107703f573434ff12e6571768fd8ad963188b40c8ec65cf0f173be63"
    
    print("🌟 Daytona Scaffold Deployment")
    print("=" * 40)
    
    if len(sys.argv) > 1:
        # Git repository URL provided
        repo_url = sys.argv[1]
        sandbox = deploy_scaffold_to_daytona(API_KEY, repo_url)
    else:
        # Try to deploy from current directory
        sandbox = create_from_current_directory(API_KEY)
    
    if sandbox:
        print(f"\n📋 Next steps:")
        print(f"1. Access Daytona dashboard to view your sandbox")
        print(f"2. Use sandbox ID '{sandbox.id}' for further operations")
        print(f"3. Connect to the development server via Daytona's preview")
        print(f"4. Use the APIs we built for hot-swapping files and GitHub imports") 