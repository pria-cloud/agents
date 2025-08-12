#!/bin/bash
# /home/user/scripts/init-pria-project.sh

PROJECT_DIR=$1
PROJECT_NAME=$2
ANTHROPIC_API_KEY=$3
WORKSPACE_ID=$4
SESSION_ID=$5

# Check if parameters provided
if [ -z "$PROJECT_DIR" ] || [ -z "$PROJECT_NAME" ]; then
    echo "Usage: $0 <project_dir> <project_name> [anthropic_api_key] [workspace_id] [session_id]"
    exit 1
fi

echo "Initializing PRIA project: $PROJECT_NAME at $PROJECT_DIR"

# Create project directory
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Initialize git repository
git init
git config user.name "PRIA Builder"
git config user.email "builder@pria.dev"

# Create .claude directory structure
mkdir -p .claude/projects .claude/todos

# Create .gitattributes for session file handling
cat > .gitattributes << 'EOF'
# Claude session files should use 'ours' merge strategy to prevent conflicts
.claude/projects/*.jsonl merge=ours
.claude/todos/*.json merge=ours
EOF

# Create basic README
cat > README.md << EOF
# ${PROJECT_NAME}

This project was created with PRIA App Builder.

## Claude Session Management

This project includes Claude session persistence through the \`.claude/\` directory:
- \`.claude/projects/\` - Contains conversation history
- \`.claude/todos/\` - Contains todo lists and task tracking

These files are automatically synchronized with the repository to maintain development context across sessions.

## Development

The project is designed to work with Claude Code CLI for development assistance.

EOF

# Set up Claude API key if provided
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "Setting up Claude Code CLI configuration..."
    export ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
    
    # Ensure Claude config directory exists for current user
    mkdir -p ~/.claude/projects
    
    # Test Claude CLI and create initial project session
    echo "Testing Claude Code CLI connection and creating project session..."
    if command -v claude >/dev/null 2>&1; then
        # Test basic Claude CLI functionality
        echo "test" | claude -p >/dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "✓ Claude Code CLI configured successfully"
            
            # Create an initial Claude session in this project directory to register it
            echo "Creating initial Claude project session..."
            echo "Create initial PRIA project setup for ${PROJECT_NAME}" | claude -p --dangerously-skip-permissions --output-format json >/dev/null 2>&1
            
            if [ $? -eq 0 ]; then
                echo "✓ Claude project session created - will be visible in claudecodeui"
            else
                echo "⚠ Failed to create Claude project session"
            fi
        else
            echo "⚠ Claude Code CLI test failed"
        fi
    else
        echo "⚠ Claude Code CLI not found in PATH"
    fi
fi

# Create project metadata
cat > .pria/project.json << EOF
{
  "name": "${PROJECT_NAME}",
  "created": "$(date -Iseconds)",
  "workspaceId": "${WORKSPACE_ID}",
  "sessionId": "${SESSION_ID}",
  "version": "1.0.0"
}
EOF

mkdir -p .pria

# Add initial commit
git add .
git commit -m "Initial commit: PRIA project setup"

echo "✓ PRIA project initialized successfully: ${PROJECT_NAME}"
echo "  Directory: ${PROJECT_DIR}"
echo "  Workspace ID: ${WORKSPACE_ID}"
echo "  Session ID: ${SESSION_ID}"