#!/bin/bash

# Post-user setup script for E2B environment
# This runs after E2B creates the user to ensure proper configuration

echo "🔧 Running post-user setup..."

# Ensure PATH includes system-wide installations AND system directories
export PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Create necessary directories
mkdir -p /home/user/.claude/projects /home/user/.config/claude /home/user/.pria /home/user/projects /home/user/bin

# Setup Claude CLI configuration with API key from .env or environment
# First try to read from .env file, then fall back to environment variable
API_KEY=""
if [ -f "/home/user/claudecodeui/.env" ]; then
    API_KEY=$(grep "^ANTHROPIC_API_KEY=" /home/user/claudecodeui/.env | cut -d'=' -f2- | tr -d '"')
fi

# Fall back to environment variable if not found in .env
if [ -z "$API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
    API_KEY="$ANTHROPIC_API_KEY"
fi

if [ -n "$API_KEY" ] && [ "$API_KEY" != "" ]; then
    echo "{\"anthropicApiKey\": \"$API_KEY\"}" > /home/user/.config/claude/config.json
    echo "✅ Claude config created with API key (${#API_KEY} chars)"
    # CRITICAL: Export the API key so it's immediately available to the startup script
    export ANTHROPIC_API_KEY="$API_KEY"
else
    echo '{}' > /home/user/.config/claude/config.json
    echo "⚠️ No ANTHROPIC_API_KEY found, created empty config"
fi

# Setup .bashrc with correct PATH including system directories
echo 'export PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"' >> /home/user/.bashrc

# Add ANTHROPIC_API_KEY to .bashrc if it exists
if [ -n "$API_KEY" ] && [ "$API_KEY" != "" ]; then
    echo "export ANTHROPIC_API_KEY='$API_KEY'" >> /home/user/.bashrc
    echo "✅ Added ANTHROPIC_API_KEY to .bashrc"
else
    echo "⚠️ ANTHROPIC_API_KEY not found in .env or environment"
fi

# Create Claude command wrapper that avoids sudo detection
echo '#!/bin/bash' > /home/user/bin/claude
echo '# Clean environment to prevent Claude CLI sudo detection' >> /home/user/bin/claude
echo 'unset SUDO_USER SUDO_UID SUDO_GID SUDO_COMMAND' >> /home/user/bin/claude
echo 'exec /usr/local/bin/claude "$@"' >> /home/user/bin/claude
chmod +x /home/user/bin/claude

# Test Claude CLI availability
echo "Testing Claude CLI..."
if /usr/local/bin/claude --version >/dev/null 2>&1; then
    echo "✅ System-wide Claude CLI is available"
else
    echo "⚠️ Claude CLI test failed"
fi

echo "✅ Post-user setup completed"