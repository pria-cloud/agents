#!/bin/bash

# =============================================================================
# PRIA E2B Custom Template Build Script
# =============================================================================
# This script builds and deploys the PRIA custom E2B template with Claude Code SDK
# Template Name: pria-dev-env
# Version: 2.0.0

set -e

echo "🏗️  Building PRIA E2B Custom Template v2.0.0"
echo "=============================================="

# Configuration
TEMPLATE_NAME="pria-dev-env"
TEMPLATE_VERSION="2.0.0"
BUILD_DIR="$(pwd)"
DOCKERFILE="e2b.Dockerfile"

# Check required files exist
echo "📋 Validating template files..."
required_files=(
    "e2b.Dockerfile"
    "CLAUDE.md"
    "TARGET_APP_SPECIFICATION_TEMPLATE.md"
    "template/package.json"
    "scripts/init-pria-project.sh"
    "scripts/setup-environment.sh"
    "scripts/setup-subagents.sh"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
    echo "✅ Found: $file"
done

# Check E2B CLI is installed
if ! command -v e2b &> /dev/null; then
    echo "❌ E2B CLI not found. Please install with: npm install -g @e2b/cli"
    exit 1
fi

# Login check
echo "🔐 Checking E2B authentication..."
if ! e2b auth info &> /dev/null; then
    echo "❌ Not logged in to E2B. Please run: e2b auth login"
    exit 1
fi

echo "✅ E2B authentication verified"

# Skip Docker build for now - E2B will handle building
echo ""
echo "🐳 Skipping local Docker build - E2B will build the image..."
echo "✅ Ready to deploy to E2B"

# Create/update E2B template
echo ""
echo "🚀 Deploying to E2B..."

# Check if template already exists
if e2b template list | grep -q "$TEMPLATE_NAME"; then
    echo "📝 Updating existing template: $TEMPLATE_NAME"
    e2b template build --name "$TEMPLATE_NAME" --dockerfile "$DOCKERFILE"
else
    echo "🆕 Creating new template: $TEMPLATE_NAME"
    e2b template build --name "$TEMPLATE_NAME" --dockerfile "$DOCKERFILE"
fi

if [ $? -eq 0 ]; then
    echo "✅ E2B template deployed successfully"
else
    echo "❌ E2B template deployment failed"
    exit 1
fi

# Get template ID
TEMPLATE_ID=$(e2b template list | grep "$TEMPLATE_NAME" | awk '{print $1}')

echo ""
echo "🎉 PRIA E2B Template Deployment Complete!"
echo "=========================================="
echo "Template Name: $TEMPLATE_NAME"
echo "Template ID: $TEMPLATE_ID"
echo "Version: $TEMPLATE_VERSION"
echo ""
echo "📋 Usage in code:"
echo "  template: '$TEMPLATE_NAME'"
echo "  // or"
echo "  templateId: '$TEMPLATE_ID'"
echo ""
echo "🔧 Environment variable for Builder App:"
echo "  E2B_TEMPLATE_ID=$TEMPLATE_ID"
echo ""
echo "✅ Ready for use in PRIA App Builder!"