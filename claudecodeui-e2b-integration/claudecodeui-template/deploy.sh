#!/bin/bash

# Deploy script for Claude Code UI E2B template

set -e

echo "🚀 Deploying Claude Code UI E2B Template..."

# Check if e2b CLI is installed
if ! command -v e2b &> /dev/null; then
    echo "❌ E2B CLI not found. Please install it first:"
    echo "npm install -g @e2b/cli"
    echo "or"
    echo "brew install e2b"
    exit 1
fi

# Check if user is logged in
if ! e2b auth whoami &> /dev/null; then
    echo "❌ Not logged in to E2B. Please run:"
    echo "e2b auth login"
    exit 1
fi

echo "✅ E2B CLI ready"

# Build and deploy the template
echo "🔨 Building and deploying template..."
e2b template build

echo "✅ Template deployed successfully!"
echo ""
echo "📋 Template Information:"
echo "  - Template will auto-start claudecodeui on port 3009"
echo "  - Backend API available on port 3008"
echo "  - Claude Code CLI pre-installed"
echo ""
echo "🔑 To get your template ID, run:"
echo "  e2b template list"
echo ""
echo "📝 Update your launcher's .env.local with the new template ID:"
echo "  E2B_TEMPLATE_ID=your-template-id-here"