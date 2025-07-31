# PRIA E2B Custom Template v2.0.0
# Enhanced development environment for PRIA Target Apps with Claude Code SDK integration

FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=development
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT_LEVEL=moderate

# Create user early to set proper ownership (sudo will be configured later)
RUN useradd -m -s /bin/bash user

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    # Core system tools
    curl \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    git \
    unzip \
    build-essential \
    software-properties-common \
    # Development tools
    python3 \
    python3-pip \
    jq \
    tree \
    htop \
    # Security and performance tools
    openssl \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Skip sudo configuration - not needed in E2B sandbox

# Install Node.js 22 (current LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install gh -y \
    && rm -rf /var/lib/apt/lists/*

# Switch to user and set working directory
USER user
WORKDIR /home/user

# Set up Node.js environment for user with proper prefix
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set audit-level moderate && \
    npm config set fund false && \
    npm config set update-notifier false && \
    npm config set prefix /home/user/.npm-global && \
    echo 'export PATH=/home/user/.npm-global/bin:$PATH' >> /home/user/.bashrc

# Install global development tools including Claude Code SDK
# Installing one by one to avoid potential conflicts
RUN export PATH=/home/user/.npm-global/bin:$PATH && \
    npm install -g @anthropic-ai/claude-code@latest && \
    npm install -g @vercel/ncc && \
    npm install -g autocannon && \
    npm install -g audit-ci || true

# Create directory structure
RUN mkdir -p /home/user/{template,scripts,tools,logs,.claude,.config/gh}

# Copy template files and scripts (these will be added during the build)
COPY --chown=user:user template/ /home/user/template/
COPY --chown=user:user scripts/ /home/user/scripts/
COPY --chown=user:user CLAUDE.md /home/user/template/
COPY --chown=user:user TARGET_APP_SPECIFICATION_TEMPLATE.md /home/user/template/

# Make scripts executable
RUN chmod +x /home/user/scripts/*.sh

# Set up Claude Code SDK configuration directory
RUN mkdir -p /home/user/.claude

# Run environment setup script
RUN /home/user/scripts/setup-environment.sh

# Run sub-agents setup script  
RUN /home/user/scripts/setup-subagents.sh

# Set up performance monitoring tools
RUN mkdir -p /home/user/tools && \
    curl -L -o /home/user/tools/lighthouse-cli https://github.com/GoogleChrome/lighthouse/releases/latest/download/lighthouse-cli-linux || echo "Lighthouse CLI download skipped" && \
    chmod +x /home/user/tools/lighthouse-cli || true

# Create validation and startup scripts
RUN echo '#!/bin/bash\n\
echo "=== PRIA E2B Template v2.0.0 Ready ==="\n\
echo "Claude Code SDK: $(claude --version 2>/dev/null || echo \"Installation required\")"\n\
echo "Node.js: $(node --version)"\n\
echo "npm: $(npm --version)"\n\
echo "Git: $(git --version)"\n\
echo "GitHub CLI: $(gh --version | head -1 2>/dev/null || echo \"Available\")"\n\
echo ""\n\
echo "📂 Template structure ready at: /home/user/template/"\n\
echo "🤖 Sub-agents configured: 8 specialized agents available"\n\
echo "🔧 Scripts available in: /home/user/scripts/"\n\
echo "📋 Run validation: /home/user/scripts/validate-environment.sh"\n\
echo "🚀 Initialize project: /home/user/scripts/init-pria-project.sh"\n\
echo ""\n\
if [ "$1" ]; then\n\
    echo "🎯 Running project initialization..."\n\
    exec "$@"\n\
else\n\
    echo "💡 Ready for PRIA project initialization!"\n\
    echo "   Usage: docker run -it pria-dev-env /home/user/scripts/init-pria-project.sh <args>"\n\
    exec /bin/bash\n\
fi' > /home/user/startup.sh && \
    chmod +x /home/user/startup.sh

# Create comprehensive validation script
RUN echo '#!/bin/bash\n\
echo "=== PRIA Template Validation ==="\n\
errors=0\n\
\n\
# Check required commands\n\
for cmd in node npm git; do\n\
    if command -v $cmd >/dev/null 2>&1; then\n\
        echo "✅ $cmd available"\n\
    else\n\
        echo "❌ $cmd missing"\n\
        errors=$((errors + 1))\n\
    fi\n\
done\n\
\n\
# Check template structure\n\
for dir in template scripts tools logs .claude; do\n\
    if [ -d "/home/user/$dir" ]; then\n\
        echo "✅ Directory $dir exists"\n\
    else\n\
        echo "❌ Directory $dir missing"\n\
        errors=$((errors + 1))\n\
    fi\n\
done\n\
\n\
# Check key template files\n\
key_files=(\n\
    "template/package.json"\n\
    "template/CLAUDE.md"\n\
    "template/.claude/agents/_registry.json"\n\
    "scripts/init-pria-project.sh"\n\
    "scripts/setup-subagents.sh"\n\
)\n\
\n\
for file in "${key_files[@]}"; do\n\
    if [ -f "/home/user/$file" ]; then\n\
        echo "✅ File $file exists"\n\
    else\n\
        echo "❌ File $file missing"\n\
        errors=$((errors + 1))\n\
    fi\n\
done\n\
\n\
# Check sub-agents\n\
agent_count=$(ls /home/user/template/.claude/agents/*.md 2>/dev/null | wc -l)\n\
if [ "$agent_count" -ge 8 ]; then\n\
    echo "✅ Sub-agents configured ($agent_count agents)"\n\
else\n\
    echo "❌ Insufficient sub-agents ($agent_count found, 8+ required)"\n\
    errors=$((errors + 1))\n\
fi\n\
\n\
echo ""\n\
if [ $errors -eq 0 ]; then\n\
    echo "🎉 PRIA Template validation passed - ready for use!"\n\
    exit 0\n\
else\n\
    echo "💥 PRIA Template validation failed with $errors errors"\n\
    exit 1\n\
fi' > /home/user/validate-template.sh && \
    chmod +x /home/user/validate-template.sh

# Run template validation
RUN /home/user/validate-template.sh

# Create workspace directory for projects
RUN mkdir -p /home/user/workspace

# Set final working directory
WORKDIR /home/user/workspace

# Health check to ensure template is working
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /home/user/validate-template.sh || exit 1

# Set startup command
ENTRYPOINT ["/home/user/startup.sh"]
CMD []

# Metadata
LABEL org.opencontainers.image.title="PRIA Development Environment"
LABEL org.opencontainers.image.description="E2B template for PRIA Target App development with Claude Code SDK"
LABEL org.opencontainers.image.version="2.0.0"
LABEL org.opencontainers.image.authors="PRIA App Builder"
LABEL pria.template.version="2.0.0"
LABEL pria.claude.sdk.version="latest"
LABEL pria.nodejs.version="18"
LABEL pria.features="claude-sdk,subagents,github-integration,performance-monitoring"