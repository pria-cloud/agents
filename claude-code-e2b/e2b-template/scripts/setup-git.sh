#!/bin/bash

# Git Setup Script for Claude Code E2B Integration
# This script configures git in the container environment

set -e

echo "🔧 Setting up Git configuration..."

# Set default git configuration if not already set
if ! git config --global user.name > /dev/null 2>&1; then
    git config --global user.name "${GIT_USER_NAME:-Claude Code E2B}"
    echo "✅ Set git user.name to: $(git config --global user.name)"
fi

if ! git config --global user.email > /dev/null 2>&1; then
    git config --global user.email "${GIT_USER_EMAIL:-claude@anthropic.com}"
    echo "✅ Set git user.email to: $(git config --global user.email)"
fi

# Set up git to use credential helper if token is provided
if [ ! -z "$GITHUB_TOKEN" ]; then
    git config --global credential.helper store
    echo "https://oauth2:$GITHUB_TOKEN@github.com" > ~/.git-credentials
    echo "✅ GitHub credentials configured"
fi

# Configure git settings for better experience in container
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.editor "nano"
git config --global color.ui auto

# Set up safe directory (important for container environments)
if [ ! -z "$PROJECT_ROOT" ]; then
    git config --global --add safe.directory "$PROJECT_ROOT"
    echo "✅ Added $PROJECT_ROOT as safe directory"
fi

git config --global --add safe.directory /code
git config --global --add safe.directory /code/baseline-project
git config --global --add safe.directory '/code/*'

echo "🎉 Git setup completed!"
echo ""
echo "Current Git Configuration:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git config --global --list | grep -E "(user\.|credential\.|init\.|pull\.|core\.editor|color\.ui)" || true
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"