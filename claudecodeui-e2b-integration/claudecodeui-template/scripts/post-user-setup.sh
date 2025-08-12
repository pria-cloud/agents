#!/bin/bash

# Post-user setup script for E2B environment
# This runs after E2B creates the user to ensure proper configuration

echo "🔧 Running post-user setup..."

# Ensure PATH includes system-wide installations AND system directories
export PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Create necessary directories
mkdir -p /home/user/.claude/projects /home/user/.config/claude /home/user/.pria /home/user/projects /home/user/bin

# Setup Claude CLI configuration with environment variable
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "{\"anthropicApiKey\": \"$ANTHROPIC_API_KEY\"}" > /home/user/.config/claude/config.json
    echo "✅ Claude config created with API key"
else
    echo '{}' > /home/user/.config/claude/config.json
    echo "⚠️ No ANTHROPIC_API_KEY found, created empty config"
fi

# Setup .bashrc with correct PATH including system directories
echo 'export PATH="/usr/local/lib/npm-global/bin:/usr/local/bin:/home/user/.npm-global/bin:/home/user/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"' >> /home/user/.bashrc

# Add ANTHROPIC_API_KEY to .bashrc if it exists in environment
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'" >> /home/user/.bashrc
    echo "✅ Added ANTHROPIC_API_KEY to .bashrc"
else
    echo "⚠️ ANTHROPIC_API_KEY not found in environment"
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