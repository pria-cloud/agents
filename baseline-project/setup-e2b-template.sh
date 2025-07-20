#!/bin/bash

# E2B Template Setup Script
# This script helps deploy the baseline-project as an E2B template

set -e

echo "🚀 Setting up E2B Template for baseline-project"
echo "==============================================="

# Check if E2B CLI is installed
if ! command -v e2b &> /dev/null; then
    echo "❌ E2B CLI is not installed"
    echo "Please install it first:"
    echo "  npm install -g @e2b/cli"
    echo "  or visit: https://e2b.dev/docs/getting-started"
    exit 1
fi

# Check if user is logged in
if ! e2b whoami &> /dev/null; then
    echo "❌ You are not logged in to E2B"
    echo "Please login first:"
    echo "  e2b login"
    exit 1
fi

echo "✅ E2B CLI is installed and you are logged in"

# Get current user info
USER_INFO=$(e2b whoami)
echo "👤 Logged in as: $USER_INFO"

# Check if we're in the right directory
if [ ! -f "e2b.Dockerfile" ]; then
    echo "❌ e2b.Dockerfile not found"
    echo "Please run this script from the baseline-project directory"
    exit 1
fi

echo "✅ Found e2b.Dockerfile"

# Initialize template if e2b.toml doesn't exist
if [ ! -f "e2b.toml" ]; then
    echo "📝 Initializing E2B template..."
    e2b template init
else
    echo "✅ e2b.toml already exists"
fi

# Build the template
echo "🔨 Building E2B template..."
echo "This may take a few minutes..."

BUILD_OUTPUT=$(e2b template build 2>&1)
echo "$BUILD_OUTPUT"

# Extract template ID from output
if echo "$BUILD_OUTPUT" | grep -q "Template built successfully"; then
    # Try to extract template ID from the output
    if echo "$BUILD_OUTPUT" | grep -q "Template ID:"; then
        TEMPLATE_ID=$(echo "$BUILD_OUTPUT" | grep "Template ID:" | sed 's/.*Template ID: //' | tr -d ' ')
    else
        # If not found in output, try to get from e2b.toml
        if [ -f "e2b.toml" ]; then
            TEMPLATE_ID=$(grep "template_id" e2b.toml | cut -d '"' -f 2 | head -1)
        fi
    fi
    
    if [ -n "$TEMPLATE_ID" ]; then
        echo ""
        echo "✅ Template built successfully!"
        echo "📋 Template ID: $TEMPLATE_ID"
        echo ""
        echo "🔧 Next steps:"
        echo "1. Add this template ID to your agent environment variables:"
        echo "   E2B_TEMPLATE_ID=$TEMPLATE_ID"
        echo ""
        echo "2. Update your .env files in the agent directories:"
        echo "   - app-builder/.env"
        echo "   - app-builder-claude/.env"
        echo ""
        echo "3. Test the template:"
        echo "   e2b sandbox create $TEMPLATE_ID"
        echo ""
        echo "📚 For more details, see: E2B_DEPLOYMENT_GUIDE.md"
    else
        echo "⚠️  Template built but could not extract Template ID"
        echo "Please check the output above or run: e2b template list"
    fi
else
    echo "❌ Template build failed"
    echo "Please check the output above for errors"
    exit 1
fi

echo ""
echo "🎉 E2B template setup complete!"