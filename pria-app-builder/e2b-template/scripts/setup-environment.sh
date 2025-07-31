#!/bin/bash

# PRIA E2B Template Environment Setup Script
# Sets up the complete development environment for PRIA Target Apps

set -e

echo "=== PRIA E2B Template Environment Setup ==="
echo "Template Version: 2.0.0"
echo "$(date): Starting environment setup..."

# Create necessary directories
echo "Creating directory structure..."
mkdir -p /home/user/.claude
mkdir -p /home/user/template/.claude/agents
mkdir -p /home/user/tools
mkdir -p /home/user/logs
mkdir -p /home/user/.config/gh

# Set up Claude Code SDK configuration
echo "Configuring Claude Code SDK..."
cat > /home/user/.claude/config.json << 'EOF'
{
  "version": "1.0",
  "model": "claude-3-5-sonnet-20241022",
  "default_max_turns": 10,
  "permission_mode": "default",
  "tools": {
    "write_file": {"enabled": true},
    "read_file": {"enabled": true},
    "list_files": {"enabled": true},
    "run_command": {"enabled": true},
    "grep": {"enabled": true},
    "edit": {"enabled": true}
  },
  "workspace": {
    "auto_save": true,
    "preserve_context": true
  }
}
EOF

# Set up Git configuration
echo "Configuring Git..."
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global push.default simple
git config --global user.name "PRIA Development"
git config --global user.email "dev@pria.ai"
git config --global core.autocrlf false

# Set up Node.js environment
echo "Setting up Node.js environment..."
export PATH=/home/user/.npm-global/bin:$PATH
npm config set registry https://registry.npmjs.org/
npm config set audit-level moderate
npm config set fund false
npm config set update-notifier false
npm config set prefix /home/user/.npm-global

# Install global development tools
echo "Installing global development tools..."
echo "Installing Claude Code SDK..."
export PATH=/home/user/.npm-global/bin:$PATH
npm install -g @anthropic-ai/claude-code@latest --silent || echo "Claude Code SDK installation failed"

# Verify installations
echo "Verifying installations..."
node --version
npm --version
git --version
gh --version || echo "GitHub CLI not available"
export PATH=/home/user/.npm-global/bin:$PATH && claude --version || echo "Claude Code SDK not available"

# Set up performance monitoring tools
echo "Setting up performance monitoring..."
curl -L -o /home/user/tools/lighthouse-cli https://github.com/GoogleChrome/lighthouse/releases/latest/download/lighthouse-cli-linux || echo "Lighthouse CLI download skipped"
chmod +x /home/user/tools/lighthouse-cli || true

# Create environment validation script
cat > /home/user/scripts/validate-environment.sh << 'EOF'
#!/bin/bash

echo "=== PRIA Environment Validation ==="

# Check Node.js
node_version=$(node --version)
echo "Node.js: $node_version"

# Check npm
npm_version=$(npm --version)
echo "npm: $npm_version"

# Check Git
git_version=$(git --version)
echo "Git: $git_version"

# Check Claude Code SDK
export PATH=/home/user/.npm-global/bin:$PATH
if command -v claude &> /dev/null; then
    claude_version=$(claude --version)
    echo "Claude Code SDK: $claude_version"
else
    echo "Claude Code SDK: Not available"
fi

# Check GitHub CLI
if command -v gh &> /dev/null; then
    gh_version=$(gh --version | head -1)
    echo "GitHub CLI: $gh_version"
else
    echo "GitHub CLI: Not available"
fi

# Check directory structure
echo "Checking directory structure..."
[ -d "/home/user/.claude" ] && echo "✓ Claude config directory exists" || echo "✗ Claude config directory missing"
[ -d "/home/user/template" ] && echo "✓ Template directory exists" || echo "✗ Template directory missing"
[ -d "/home/user/scripts" ] && echo "✓ Scripts directory exists" || echo "✗ Scripts directory missing"
[ -d "/home/user/tools" ] && echo "✓ Tools directory exists" || echo "✗ Tools directory missing"

# Check configuration files
[ -f "/home/user/.claude/config.json" ] && echo "✓ Claude config exists" || echo "✗ Claude config missing"

echo "=== Environment validation complete ==="
EOF

chmod +x /home/user/scripts/validate-environment.sh

# Set up logging
echo "Setting up logging..."
mkdir -p /home/user/logs
touch /home/user/logs/environment-setup.log
touch /home/user/logs/project-initialization.log
touch /home/user/logs/claude-execution.log

# Set ownership
chown -R user:user /home/user

echo "=== Environment setup complete ==="
echo "Template ready for PRIA project initialization"
echo "Setup log available at: /home/user/logs/environment-setup.log"

# Log completion
echo "$(date): Environment setup completed successfully" >> /home/user/logs/environment-setup.log