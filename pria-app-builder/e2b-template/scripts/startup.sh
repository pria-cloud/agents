#!/bin/bash

# PRIA E2B Template Startup Script
# Initializes the development environment for Target App generation

set -e

echo "🚀 Starting PRIA development environment..."

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors
error_exit() {
    echo "❌ Error: $1" >&2
    exit 1
}

# Set proper permissions for scripts
chmod +x /home/user/scripts/*.sh

# Create workspace directory if it doesn't exist
mkdir -p /workspace
chown -R user:user /workspace

# Set working directory
cd /workspace

# Initialize PRIA context system
log "📁 Initializing PRIA context system..."
if [ -f ".pria/scripts/init.js" ]; then
    node .pria/scripts/init.js
    if [ $? -eq 0 ]; then
        log "✅ PRIA context system initialized successfully"
    else
        error_exit "Failed to initialize PRIA context system"
    fi
else
    log "⚠️ No PRIA init script found, creating basic structure..."
    mkdir -p .pria/scripts .pria/backups
fi

# Set up Git configuration if not already configured
log "🔧 Configuring Git..."
if [ ! -z "$GIT_USER_NAME" ] && [ ! -z "$GIT_USER_EMAIL" ]; then
    git config --global user.name "$GIT_USER_NAME"
    git config --global user.email "$GIT_USER_EMAIL"
    log "✅ Git configured with provided credentials"
else
    log "📝 Using default Git configuration"
fi

# Initialize Git repository if not already initialized
if [ ! -d ".git" ]; then
    log "🔄 Initializing Git repository..."
    git init
    git branch -M main
    log "✅ Git repository initialized"
fi

# Set up GitHub CLI authentication if token is provided
if [ ! -z "$GITHUB_TOKEN" ]; then
    log "🔐 Configuring GitHub CLI..."
    echo "$GITHUB_TOKEN" | gh auth login --with-token
    if [ $? -eq 0 ]; then
        log "✅ GitHub CLI authenticated successfully"
    else
        log "⚠️ GitHub CLI authentication failed"
    fi
fi

# Set up Claude Code SDK configuration
log "🤖 Configuring Claude Code SDK..."
if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    # Create .claude.json if it doesn't exist
    if [ ! -f ".claude.json" ]; then
        cat > .claude.json << EOF
{
  "version": "1.0",
  "model": "claude-3-5-sonnet-20241022",
  "projectContext": {
    "type": "pria-target-app",
    "builderAppUrl": "${PRIA_BUILDER_APP_URL:-http://localhost:3007}",
    "sessionId": "${PRIA_SESSION_ID:-default}",
    "workspaceId": "${PRIA_WORKSPACE_ID:-default}",
    "contextFiles": [
      ".pria/current-phase.json",
      ".pria/session-context.json",
      ".pria/requirements.json",
      "TARGET_APP_SPECIFICATION.md"
    ]
  },
  "subagents": {
    "enabled": true,
    "configPath": ".pria/subagent-configs/"
  }
}
EOF
        log "✅ Claude Code SDK configuration created"
    fi
else
    log "⚠️ No Anthropic API key provided - Claude Code SDK will need manual configuration"
fi

# Create TARGET_APP_SPECIFICATION.md if it doesn't exist
if [ ! -f "TARGET_APP_SPECIFICATION.md" ]; then
    log "📋 Creating TARGET_APP_SPECIFICATION.md template..."
    cat > TARGET_APP_SPECIFICATION.md << 'EOF'
# PRIA Target App Specification

## Project Overview
- **Purpose**: [Generated application purpose - to be defined by requirements phase]
- **Scope**: [Application scope and boundaries - to be defined]
- **Users**: [Target user personas and use cases - to be defined]

## Technical Architecture
- **Database Schema**: [Tables, relationships, RLS policies - to be designed]
- **API Design**: [Endpoints, authentication, data models - to be specified]
- **Component Hierarchy**: [UI structure and data flow - to be planned]
- **Integration Points**: [External services and dependencies - to be identified]

## Requirements Implementation Status
- **Phase 1 Requirements**: [Pending - awaiting requirements gathering]
- **Phase 2 Technical Specs**: [Pending - awaiting system architecture]
- **Phase 3 Implementation Plan**: [Pending - awaiting implementation planning]
- **Current Development Status**: [Phase 1 - Requirements Gathering]

## Quality Assurance
- **Testing Strategy**: [To be defined during testing phase]
- **Security Validation**: [PRIA compliance validation pending]
- **Performance Metrics**: [To be established]
- **Accessibility**: [WCAG compliance to be validated]

## Deployment Configuration
- **Environment Variables**: [To be configured]
- **Database Migrations**: [To be created]
- **Build Process**: [To be established]
- **Monitoring**: [To be set up]

## Session Context
- **Builder App Session**: ${PRIA_SESSION_ID:-"Not configured"}
- **Workspace**: ${PRIA_WORKSPACE_ID:-"Not configured"}
- **Current Phase**: 1 (Requirements Gathering)
- **Last Updated**: $(date '+%Y-%m-%d %H:%M:%S')
- **Subagent Context**: requirements-analyst

---
*This document is automatically maintained by the PRIA system and updated as development progresses.*
EOF
    log "✅ TARGET_APP_SPECIFICATION.md template created"
fi

# Install Node.js dependencies if package.json exists
if [ -f "package.json" ]; then
    log "📦 Installing Node.js dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        log "✅ Dependencies installed successfully"
    else
        log "⚠️ Some dependencies failed to install"
    fi
fi

# Set up development tools and scripts
log "🛠️ Setting up development tools..."

# Make PRIA scripts executable
if [ -d ".pria/scripts" ]; then
    chmod +x .pria/scripts/*.js 2>/dev/null || true
    chmod +x .pria/scripts/*.sh 2>/dev/null || true
fi

# Create development convenience scripts
cat > pria-dev.sh << 'EOF'
#!/bin/bash
# PRIA Development Helper Script

case "$1" in
    "sync")
        echo "🔄 Syncing with Builder App..."
        node .pria/scripts/sync-with-builder.js
        ;;
    "validate")
        echo "✅ Running PRIA compliance validation..."
        node .pria/scripts/validate-compliance.js
        ;;
    "progress")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: ./pria-dev.sh progress <phase> <status> [percentage]"
            exit 1
        fi
        node .pria/scripts/update-progress.js "$2" "$3" "$4"
        ;;
    "status")
        echo "📊 Current PRIA Status:"
        cat .pria/current-phase.json 2>/dev/null || echo "No phase info available"
        ;;
    "claude")
        echo "🤖 Starting Claude Code SDK..."
        claude
        ;;
    *)
        echo "PRIA Development Helper"
        echo "Usage: ./pria-dev.sh {sync|validate|progress|status|claude}"
        echo ""
        echo "Commands:"
        echo "  sync      - Sync context with Builder App"
        echo "  validate  - Run PRIA compliance checks"
        echo "  progress  - Update development progress" 
        echo "  status    - Show current development status"
        echo "  claude    - Start Claude Code SDK"
        ;;
esac
EOF

chmod +x pria-dev.sh

# Set up environment variables for development
log "🌐 Setting up environment..."
export NODE_ENV=development
export PRIA_WORKSPACE="/workspace"
export PATH="/opt/node-v22.13.0-linux-x64/bin:$PATH"

# Verify installations
log "📋 Environment Check:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Claude: $(claude --version)"
echo "Git: $(git --version)"
echo "GitHub CLI: $(gh --version)"

# Sync with Builder App if configured
if [ ! -z "$PRIA_BUILDER_APP_URL" ] && [ ! -z "$PRIA_SESSION_ID" ]; then
    log "🔄 Performing initial sync with Builder App..."
    if [ -f ".pria/scripts/sync-with-builder.js" ]; then
        node .pria/scripts/sync-with-builder.js || log "⚠️ Initial sync failed, continuing..."
    fi
fi

# Report startup completion to Builder App
if [ ! -z "$PRIA_BUILDER_APP_URL" ] && [ ! -z "$PRIA_SESSION_ID" ]; then
    log "📡 Reporting environment ready to Builder App..."
    curl -X POST "$PRIA_BUILDER_APP_URL/api/workflow/$PRIA_SESSION_ID/progress" \
         -H "Content-Type: application/json" \
         -d '{
           "phase": 1,
           "status": "environment_ready",
           "percentage": 0,
           "timestamp": "'$(date -Iseconds)'",
           "subagent": "requirements-analyst",
           "message": "E2B environment initialized and ready for development"
         }' 2>/dev/null || log "⚠️ Failed to report to Builder App"
fi

log "🎉 PRIA development environment ready!"
log "📚 Available commands:"
log "  ./pria-dev.sh sync      - Sync with Builder App"
log "  ./pria-dev.sh validate  - Run compliance checks"
log "  ./pria-dev.sh claude    - Start Claude Code SDK"
log "  ./pria-dev.sh status    - Show current status"
log ""
log "🤖 To start Claude Code SDK: claude"
log "📁 Context files available in .pria/ directory"
log "📋 Project specification: TARGET_APP_SPECIFICATION.md"
log ""
log "Ready for PRIA application development! 🚀"

# Keep container running
exec "$@"