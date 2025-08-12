# E2B Template Build Instructions

## Setup

1. **Create local environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your actual API keys:**
   ```bash
   # Required
   ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
   
   # Optional
   GITHUB_TOKEN=ghp_your-github-token-here
   GITHUB_REPOSITORY=https://github.com/pria-cloud/workspaces
   ```

3. **Build the template:**
   ```bash
   e2b template build
   ```

## How it works

- `.env.local` is read during Docker build to inject API keys into the template
- `.env.local` is gitignored so your keys never get committed
- The API key gets baked into the template's `.env` file and Claude CLI config
- Template works immediately without requiring runtime environment variable injection

## Security

- ✅ API keys are read from local `.env.local` file
- ✅ `.env.local` is gitignored (never committed)
- ✅ Keys are baked into template during build
- ✅ Template works without runtime configuration