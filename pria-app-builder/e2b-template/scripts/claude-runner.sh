#!/bin/bash
# Claude Code SDK Runner Script for PRIA Projects
# Handles Claude Code execution with proper error handling and logging

set -e

COMMAND=${1:-"help"}
PROJECT_DIR=${2:-"."}
ANTHROPIC_API_KEY=${3:-""}
PROMPT=${4:-""}

cd "$PROJECT_DIR"

# Function to setup Claude Code configuration
setup_claude_config() {
  local api_key=$1
  
  echo "🔧 Setting up Claude Code configuration..."
  
  if [ ! -z "$api_key" ]; then
    cat > .claude.json << EOF
{
  "version": "1.0",
  "model": "claude-3-5-sonnet-20241022",
  "anthropic_api_key": "$api_key"
}
EOF
    echo "✅ Claude configuration updated with API key"
  else
    if [ ! -f ".claude.json" ]; then
      cp /home/user/.claude.json.template .claude.json
      echo "✅ Default Claude configuration created"
    fi
  fi
}

# Function to run Claude Code with a prompt
run_claude_prompt() {
  local prompt=$1
  
  echo "🤖 Running Claude Code with prompt..."
  echo "Prompt: $prompt"
  echo "Working directory: $(pwd)"
  echo ""
  
  # Use piped approach to avoid hanging issues
  # Skip permissions for smooth sandbox operations
  echo "$prompt" | claude -p --dangerously-skip-permissions 2>&1 | tee /tmp/claude-output.log
  
  local exit_code=${PIPESTATUS[1]}
  
  if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Claude Code execution completed successfully"
  else
    echo ""
    echo "❌ Claude Code execution failed with exit code: $exit_code"
    echo "Check the output above for error details"
    return $exit_code
  fi
}

# Function to run Claude Code interactively
run_claude_interactive() {
  echo "🤖 Starting Claude Code interactive session..."
  echo "Type 'exit' or press Ctrl+C to quit"
  echo ""
  
  claude --dangerously-skip-permissions
}

# Function to initialize Claude in the project
init_claude_project() {
  echo "🚀 Initializing Claude Code in project..."
  
  # Ensure .claude.json exists
  setup_claude_config "$ANTHROPIC_API_KEY"
  
  # Check if Claude can access the project
  echo "Testing Claude Code access..."
  
  if claude --version >/dev/null 2>&1; then
    echo "✅ Claude Code is available"
  else
    echo "❌ Claude Code is not available or not properly installed"
    return 1
  fi
  
  # Test basic functionality
  echo "Testing basic Claude functionality..."
  echo "list the files in this directory" | claude -p --dangerously-skip-permissions > /tmp/test-output.log 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✅ Claude Code is working correctly"
    echo "Sample output:"
    head -5 /tmp/test-output.log
  else
    echo "⚠️  Claude Code test failed, but continuing..."
    cat /tmp/test-output.log
  fi
}

# Function to check Claude Code status
check_claude_status() {
  echo "📊 Claude Code Status:"
  echo "Version: $(claude --version 2>/dev/null || echo 'Not available')"
  echo "Config file: $([ -f '.claude.json' ] && echo 'Present' || echo 'Missing')"
  echo "Working directory: $(pwd)"
  echo "API Key: $([ ! -z "$ANTHROPIC_API_KEY" ] && echo 'Provided' || echo 'Not provided')"
  
  if [ -f ".claude.json" ]; then
    echo ""
    echo "Configuration:"
    cat .claude.json | jq . 2>/dev/null || cat .claude.json
  fi
}

# Function to run Claude with file context
run_claude_with_context() {
  local prompt=$1
  local files=${2:-""}
  
  echo "🤖 Running Claude Code with file context..."
  
  if [ ! -z "$files" ]; then
    echo "Including files: $files"
    context_prompt="$prompt

Please analyze these files:
$(for file in $files; do
  if [ -f "$file" ]; then
    echo "=== $file ==="
    cat "$file"
    echo ""
  fi
done)"
  else
    context_prompt="$prompt"
  fi
  
  echo "$context_prompt" | claude -p --dangerously-skip-permissions
}

# Function to generate project documentation
generate_docs() {
  echo "📚 Generating project documentation with Claude..."
  
  local doc_prompt="Please analyze this Next.js project and create comprehensive documentation including:

1. Project overview and architecture
2. File structure explanation
3. Component documentation
4. API routes documentation
5. Setup and installation instructions
6. Development workflow
7. Deployment instructions

Please create a detailed README.md file."

  run_claude_prompt "$doc_prompt"
}

# Function to run code analysis
analyze_code() {
  echo "🔍 Running code analysis with Claude..."
  
  local analysis_prompt="Please analyze this codebase for:

1. Code quality and best practices
2. Potential bugs or issues
3. Performance optimizations
4. Security considerations
5. TypeScript type safety
6. Next.js best practices
7. Accessibility issues
8. Suggestions for improvements

Provide detailed feedback with specific examples and recommendations."

  run_claude_prompt "$analysis_prompt"
}

# Main execution
case $COMMAND in
  "setup")
    setup_claude_config "$ANTHROPIC_API_KEY"
    ;;
  "init")
    init_claude_project
    ;;
  "run")
    if [ -z "$PROMPT" ]; then
      echo "❌ No prompt provided for run command"
      exit 1
    fi
    setup_claude_config "$ANTHROPIC_API_KEY"
    run_claude_prompt "$PROMPT"
    ;;
  "interactive")
    setup_claude_config "$ANTHROPIC_API_KEY"
    run_claude_interactive
    ;;
  "status")
    check_claude_status
    ;;
  "context")
    FILES=${5:-""}
    if [ -z "$PROMPT" ]; then
      echo "❌ No prompt provided for context command"
      exit 1
    fi
    setup_claude_config "$ANTHROPIC_API_KEY"
    run_claude_with_context "$PROMPT" "$FILES"
    ;;
  "docs")
    setup_claude_config "$ANTHROPIC_API_KEY"
    generate_docs
    ;;
  "analyze")
    setup_claude_config "$ANTHROPIC_API_KEY"
    analyze_code
    ;;
  "help")
    echo "📖 Claude Runner Script Usage:"
    echo ""
    echo "claude-runner.sh <command> [project_dir] [api_key] [prompt] [additional_args]"
    echo ""
    echo "Commands:"
    echo "  setup      - Setup Claude configuration"
    echo "  init       - Initialize Claude in project"
    echo "  run        - Run Claude with a prompt"
    echo "  interactive - Start interactive Claude session"
    echo "  status     - Check Claude status"
    echo "  context    - Run Claude with file context"
    echo "  docs       - Generate project documentation"
    echo "  analyze    - Run code analysis"
    echo "  help       - Show this help"
    echo ""
    echo "Examples:"
    echo "  claude-runner.sh setup /workspace/my-app \$ANTHROPIC_API_KEY"
    echo "  claude-runner.sh run /workspace/my-app \$ANTHROPIC_API_KEY 'Create a todo component'"
    echo "  claude-runner.sh context /workspace/my-app \$ANTHROPIC_API_KEY 'Review this code' 'src/components/*.tsx'"
    echo "  claude-runner.sh docs /workspace/my-app \$ANTHROPIC_API_KEY"
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    echo "Run 'claude-runner.sh help' for usage information"
    exit 1
    ;;
esac