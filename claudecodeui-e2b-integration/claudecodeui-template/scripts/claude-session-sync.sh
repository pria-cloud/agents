#!/bin/bash
# /home/user/scripts/claude-session-sync.sh

PROJECT_NAME=$1
PROJECT_PATH="/home/user/projects/${PROJECT_NAME}"
CLAUDE_PROJECT_DIR=$(echo "${PROJECT_PATH}" | sed 's/\//-/g')

sync_claude_sessions() {
    cd "${PROJECT_PATH}"
    
    # Create .claude directory structure in project
    mkdir -p .claude/projects .claude/todos
    
    # Copy relevant Claude sessions
    if [ -d "$HOME/.claude/projects/${CLAUDE_PROJECT_DIR}" ]; then
        cp -r "$HOME/.claude/projects/${CLAUDE_PROJECT_DIR}" ".claude/projects/"
    fi
    
    # Copy todo lists for this project's sessions
    for session_file in "$HOME/.claude/projects/${CLAUDE_PROJECT_DIR}"/*.jsonl; do
        if [ -f "$session_file" ]; then
            session_id=$(basename "$session_file" .jsonl)
            todo_file="$HOME/.claude/todos/${session_id}-agent-${session_id}.json"
            if [ -f "$todo_file" ]; then
                cp "$todo_file" ".claude/todos/"
            fi
        fi
    done
    
    # Commit to Git
    git add .claude/ -f
    git commit -m "Auto-sync: Claude sessions - $(date '+%Y-%m-%d %H:%M:%S')" || true
    git push origin HEAD || true
}

# Check if project name provided
if [ -z "$PROJECT_NAME" ]; then
    echo "Usage: $0 <project_name>"
    exit 1
fi

# Check if project directory exists
if [ ! -d "$PROJECT_PATH" ]; then
    echo "Project directory does not exist: $PROJECT_PATH"
    exit 1
fi

# If running in watch mode (no second argument), set up file watcher
if [ "$2" != "once" ]; then
    echo "Starting Claude session sync watcher for project: $PROJECT_NAME"
    
    # Initial sync
    sync_claude_sessions
    
    # Watch for changes
    while true; do
        inotifywait -r -e modify,create,delete \
            "$HOME/.claude/projects/${CLAUDE_PROJECT_DIR}" \
            "${PROJECT_PATH}" \
            2>/dev/null
        
        sync_claude_sessions
        sleep 5
    done
else
    # Run once
    sync_claude_sessions
fi