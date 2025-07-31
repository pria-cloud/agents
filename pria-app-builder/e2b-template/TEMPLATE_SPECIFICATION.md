# PRIA E2B Custom Template Specification

## Overview
This document defines the requirements for the PRIA custom E2B template (`pria-dev-env`) that must be kept in sync with Builder App improvements.

## Template Updates Required (Based on Recent Builder App Changes)

### 1. Claude Code SDK Integration (CRITICAL)
**Builder App Changes**: Moved from CLI to TypeScript SDK with `query()` function
**Template Requirements**:
```bash
# Pre-install latest Claude Code SDK
npm install -g @anthropic-ai/claude-code@latest

# Verify installation
claude --version

# Create default configuration
mkdir -p /home/user/.claude
cat > /home/user/.claude/config.json << 'EOF'
{
  "version": "1.0",
  "model": "claude-3-5-sonnet-20241022",
  "default_max_turns": 10,
  "permission_mode": "default"
}
EOF
```

### 2. Official Sub-agents Directory Structure
**Builder App Changes**: Implemented official Claude Code sub-agents pattern
**Template Requirements**:
```bash
# Create sub-agents directory structure
mkdir -p /home/user/template/.claude/agents

# Pre-configure standard PRIA sub-agents
/home/user/scripts/setup-subagents.sh
```

**Required Sub-agents Configuration** (`/home/user/scripts/setup-subagents.sh`):
```bash
#!/bin/bash

# Requirements Analyst
cat > /home/user/template/.claude/agents/requirements-analyst.md << 'EOF'
---
name: requirements-analyst
description: Senior business analyst for requirements gathering
tools: [write-file, read-file, list-files]
---

You are a senior business analyst specializing in requirements gathering for enterprise applications.

## Responsibilities
- Conduct thorough requirements discovery
- Create user stories with acceptance criteria
- Identify business rules and constraints
- Support iterative requirement refinement

## Context7 Usage
- Always research with Context7 before technical recommendations
- Reference current best practices and component libraries
- Use "/context7 search [topic]" for relevant documentation
EOF

# Architecture Expert  
cat > /home/user/template/.claude/agents/architecture-expert.md << 'EOF'
---
name: architecture-expert  
description: Senior software architect for system design
tools: [write-file, read-file, list-files, run-command]
---

You are a senior software architect specializing in modern web applications.

## Responsibilities
- Design system architecture with multi-tenancy
- Create database schemas with RLS
- Plan API design and integration patterns
- Ensure PRIA compliance and scalability

## Context7 Usage
- Research architectural patterns and best practices
- Reference latest framework capabilities
- Validate security and compliance requirements
EOF

# Continue for all other sub-agents (code-reviewer, security-auditor, etc.)
```

### 3. Enhanced GitHub Integration
**Builder App Changes**: Added encryption, orchestrator, webhook management
**Template Requirements**:
```bash
# Install Git and GitHub CLI
apt-get update
apt-get install -y git gh curl wget

# Pre-configure Git
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global push.default simple

# Verify installations
git --version
gh --version
```

### 4. Complete PRIA Project Template
**Builder App Changes**: Optimized sandbox initialization with comprehensive setup
**Template Requirements**: Pre-create the complete PRIA project structure

**Project Initialization Script** (`/home/user/scripts/init-pria-project.sh`):
```bash
#!/bin/bash

PROJECT_DIR="$1"
PROJECT_NAME="$2"
ANTHROPIC_API_KEY="$3"
WORKSPACE_ID="$4"
SESSION_ID="$5"

echo "TEMPLATE_VERSION:2.0.0"
echo "Initializing PRIA project: $PROJECT_NAME"

# Create project directory
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Copy pre-configured template
cp -r /home/user/template/* .
cp -r /home/user/template/.* . 2>/dev/null || true

# Update package.json with project-specific values
sed -i "s/PLACEHOLDER_PROJECT_NAME/$PROJECT_NAME/g" package.json
sed -i "s/PLACEHOLDER_SESSION_ID/${SESSION_ID:0:8}/g" package.json

# Configure Claude Code SDK
cat > .claude.json << EOF
{
  "version": "1.0",
  "model": "claude-3-5-sonnet-20241022",
  "anthropic_api_key": "$ANTHROPIC_API_KEY",
  "workspace_id": "$WORKSPACE_ID",
  "session_id": "$SESSION_ID"
}
EOF

# Set up environment variables template
cat > .env.example << EOF
# PRIA Application Environment Variables
NODE_ENV=development
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# Install dependencies (optimized for E2B)
npm ci --silent --production=false

echo "PRIA project initialized successfully"
echo "Project directory: $PROJECT_DIR"
echo "Claude Code SDK configured"
echo "Sub-agents ready"
```

### 5. Pre-configured PRIA Project Template
**Template Structure** (`/home/user/template/`):
```
template/
├── package.json (with latest dependencies)
├── tsconfig.json 
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── middleware.ts
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts  
│   │   └── middleware.ts
│   ├── utils.ts
│   └── types/
│       └── index.ts
├── components/
│   └── ui/ (shadcn/ui components)
├── .claude/
│   ├── config.json
│   └── agents/ (all sub-agents pre-configured)
├── .gitignore
└── README.md
```

### 6. Performance Optimization
**Template Requirements**:
```bash
# Pre-install monitoring utilities
npm install -g @vercel/ncc autocannon

# Setup performance baseline tools
mkdir -p /home/user/tools
curl -o /home/user/tools/lighthouse-cli https://github.com/GoogleChrome/lighthouse/releases/latest/download/lighthouse-cli-linux
chmod +x /home/user/tools/lighthouse-cli
```

### 7. Security and Compliance Tools
```bash
# Install security scanning tools
npm install -g audit-ci snyk

# Setup security baseline
/home/user/scripts/security-setup.sh
```

## Template Build Process

### Docker Configuration for E2B Template
```dockerfile
FROM node:18-ubuntu

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt install gh -y

# Install Claude Code SDK globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create user structure
RUN useradd -m -s /bin/bash user
WORKDIR /home/user

# Copy template files and scripts
COPY template/ /home/user/template/
COPY scripts/ /home/user/scripts/
RUN chmod +x /home/user/scripts/*.sh

# Setup default configurations
RUN /home/user/scripts/setup-environment.sh

USER user
```

## Synchronization Strategy

### 1. Version Control
- E2B template version should match Builder App major versions
- Template updates trigger via CI/CD when Builder App is updated
- Version tracking in template initialization scripts

### 2. Automated Updates
```bash
# Template update trigger (in Builder App CI/CD)
if [[ "$BUILDER_APP_UPDATED" == "true" ]]; then
  echo "Triggering E2B template rebuild..."
  curl -X POST "$E2B_TEMPLATE_BUILD_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d '{"version": "'$BUILDER_APP_VERSION'", "trigger": "builder-app-update"}'
fi
```

### 3. Validation
```bash
# Template validation script
/home/user/scripts/validate-template.sh

# Should verify:
# - Claude Code SDK version matches Builder App expectations
# - All sub-agents are configured correctly  
# - Dependencies are at expected versions
# - Security tools are properly installed
# - Project template creates valid PRIA applications
```

## Critical Synchronization Points

1. **Claude Code SDK Updates**: Template must be rebuilt when SDK versions change
2. **Sub-agent Pattern Changes**: Template sub-agents must match Builder App expectations  
3. **Dependency Updates**: Template package.json must align with Builder App requirements
4. **Security Updates**: Template security tools must match Builder App validation expectations
5. **Project Structure Changes**: Template must reflect any PRIA architecture updates

## Next Steps

1. **Create E2B Template Repository**: Separate repo for template configuration
2. **Setup CI/CD Pipeline**: Auto-rebuild template when Builder App changes
3. **Implement Template Validation**: Ensure template works with current Builder App
4. **Version Synchronization**: Keep template versions aligned with Builder App releases
5. **Testing Integration**: Test template with actual Builder App deployment flows

This ensures the E2B custom template stays in perfect sync with all Builder App improvements, eliminating the initialization overhead we've been optimizing.