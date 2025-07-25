#!/bin/bash

# PRIA Vercel Setup Script
# Automates the setup of Vercel deployment for PRIA-generated applications

set -e

echo "🚀 PRIA Vercel Deployment Setup"
echo "================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel@latest
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit from PRIA"
fi

# Login to Vercel (if not already logged in)
echo "🔐 Checking Vercel authentication..."
vercel whoami > /dev/null 2>&1 || {
    echo "Please login to Vercel:"
    vercel login
}

# Get project name
if [ -z "$1" ]; then
    echo "Enter your project name:"
    read -r PROJECT_NAME
else
    PROJECT_NAME="$1"
fi

# Set up Vercel project
echo "🏗️  Setting up Vercel project: $PROJECT_NAME"

# Create vercel.json if it doesn't exist
if [ ! -f "vercel.json" ]; then
    echo "📝 Creating vercel.json configuration..."
    cat > vercel.json << EOL
{
  "name": "$PROJECT_NAME",
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key",
    "GITHUB_CLIENT_ID": "@github_client_id",
    "GITHUB_CLIENT_SECRET": "@github_client_secret",
    "E2B_API_KEY": "@e2b_api_key",
    "E2B_TEMPLATE_ID": "@e2b_template_id",
    "VERCEL_TOKEN": "@vercel_token"
  },
  
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 30
    },
    "app/api/claude/**/*.ts": {
      "runtime": "nodejs20.x", 
      "maxDuration": 60
    },
    "app/api/e2b/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 300
    },
    "app/api/github/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 60
    }
  },
  
  "regions": ["iad1", "sfo1", "lhr1"],
  
  "github": {
    "enabled": true,
    "autoAlias": true
  }
}
EOL
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

# Get project information
PROJECT_INFO=$(vercel project ls | grep "$PROJECT_NAME" | head -1)
PROJECT_ID=$(echo "$PROJECT_INFO" | awk '{print $1}')

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo "Project ID: $PROJECT_ID"
echo "Project Name: $PROJECT_NAME"
echo ""

# Set up environment variables
echo "🔧 Setting up environment variables..."
echo "You'll need to add these secrets in your Vercel dashboard:"
echo ""
echo "Required secrets:"
echo "- supabase_url: Your Supabase project URL"
echo "- supabase_anon_key: Your Supabase anonymous key"
echo "- supabase_service_role_key: Your Supabase service role key"
echo "- github_client_id: GitHub OAuth app client ID"
echo "- github_client_secret: GitHub OAuth app client secret"
echo "- e2b_api_key: E2B API key"
echo "- e2b_template_id: E2B template ID"
echo "- vercel_token: Vercel API token"
echo ""

# Prompt for automatic secret setup
echo "Would you like to set up secrets now? (y/n)"
read -r SETUP_SECRETS

if [ "$SETUP_SECRETS" = "y" ] || [ "$SETUP_SECRETS" = "Y" ]; then
    echo "📝 Setting up secrets..."
    
    echo "Enter your Supabase URL:"
    read -r SUPABASE_URL
    echo "$SUPABASE_URL" | vercel secrets add supabase_url
    
    echo "Enter your Supabase anonymous key:"
    read -r SUPABASE_ANON_KEY
    echo "$SUPABASE_ANON_KEY" | vercel secrets add supabase_anon_key
    
    echo "Enter your Supabase service role key:"
    read -r SUPABASE_SERVICE_ROLE_KEY
    echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel secrets add supabase_service_role_key
    
    echo "Enter your GitHub Client ID:"
    read -r GITHUB_CLIENT_ID
    echo "$GITHUB_CLIENT_ID" | vercel secrets add github_client_id
    
    echo "Enter your GitHub Client Secret:"
    read -r GITHUB_CLIENT_SECRET
    echo "$GITHUB_CLIENT_SECRET" | vercel secrets add github_client_secret
    
    echo "Enter your E2B API Key:"
    read -r E2B_API_KEY
    echo "$E2B_API_KEY" | vercel secrets add e2b_api_key
    
    echo "Enter your E2B Template ID:"
    read -r E2B_TEMPLATE_ID
    echo "$E2B_TEMPLATE_ID" | vercel secrets add e2b_template_id
    
    echo "Enter your Vercel API Token:"
    read -r VERCEL_TOKEN
    echo "$VERCEL_TOKEN" | vercel secrets add vercel_token
    
    echo "✅ Secrets configured!"
fi

# Create GitHub workflow if it doesn't exist
if [ ! -d ".github/workflows" ]; then
    echo "📁 Creating GitHub Actions workflow..."
    mkdir -p .github/workflows
    
    cat > .github/workflows/vercel-deploy.yml << 'EOL'
name: Vercel Deployment Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
      - name: Build Project Artifacts
        run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
EOL
fi

# Set up Git remote if it doesn't exist
if ! git remote get-url origin &> /dev/null; then
    echo "🔗 Git remote setup required for automatic deployments"
    echo "Please push this repository to GitHub and configure the remote:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "git push -u origin main"
fi

echo ""
echo "🎉 PRIA Vercel Setup Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub (if not already done)"
echo "2. Configure GitHub secrets for automatic deployments:"
echo "   - VERCEL_ORG_ID"
echo "   - VERCEL_PROJECT_ID" 
echo "   - VERCEL_TOKEN"
echo "3. Your app will auto-deploy on every push to main/develop"
echo ""
echo "🔗 Vercel Dashboard: https://vercel.com/dashboard"
echo "📚 Documentation: https://vercel.com/docs"
echo ""