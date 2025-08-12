#!/bin/bash

# Fix Claude command execution issues
echo "🔧 Fixing Claude CLI command execution..."

# Ensure Claude CLI is in PATH
export PATH="/home/user/.npm-global/bin:$PATH"

# Create a wrapper script that forces 'claude' command
cat > /home/user/claude-wrapper.sh << 'EOF'
#!/bin/bash
# Claude CLI wrapper to ensure correct command execution
exec /home/user/.npm-global/bin/claude "$@"
EOF

chmod +x /home/user/claude-wrapper.sh

# Create symbolic link in /usr/local/bin for system-wide access
ln -sf /home/user/claude-wrapper.sh /usr/local/bin/claude 2>/dev/null || true

# Also create a 'pria' symlink that points to claude (in case the branding affects command lookup)
ln -sf /home/user/.npm-global/bin/claude /usr/local/bin/pria 2>/dev/null || true

echo "✅ Claude command fixes applied"