# E2B Sandbox Template Deployment Guide

This guide will help you deploy the baseline-project as a custom E2B sandbox template.

## Prerequisites

1. **E2B Account**: Sign up at [e2b.dev](https://e2b.dev)
2. **E2B CLI**: Install the CLI tool
3. **Docker**: Required for building the template

## Step 1: Install E2B CLI

```bash
# Install via npm
npm install -g @e2b/cli

# Or install via Homebrew (macOS)
brew install e2b-dev/e2b/e2b

# Or download binary from GitHub releases
```

## Step 2: Authentication

```bash
# Login to E2B
e2b login

# Verify authentication
e2b whoami
```

## Step 3: Initialize Template

Navigate to the baseline-project directory and initialize the E2B template:

```bash
cd baseline-project

# Initialize template (this will create/update e2b.toml)
e2b template init

# Build the template
e2b template build
```

## Step 4: Deploy Template

```bash
# Build and deploy the template
e2b template build

# The output will show your template ID, for example:
# ✅ Template built successfully
# 📋 Template ID: abc123def456
# 🌐 You can now create sandboxes with this template
```

## Step 5: Update Environment Variables

After getting your template ID, update the environment variables in your agent configurations:

### For app-builder agent:
```bash
# In your .env file
E2B_TEMPLATE_ID=your-actual-template-id-here
E2B_TEAM_ID=your-team-id-here
E2B_API_KEY=your-e2b-api-key-here
```

### For app-builder-claude agent:
```bash
# In your .env file
E2B_TEMPLATE_ID=your-actual-template-id-here
E2B_TEAM_ID=your-team-id-here
E2B_API_KEY=your-e2b-api-key-here
```

## Step 6: Test the Template

You can test the template locally:

```bash
# Test sandbox creation
e2b sandbox create your-template-id

# Or test via the SDK
```

## Template Configuration

The `e2b.toml` file contains the template configuration:

```toml
[template]
name = "baseline-project"
dockerfile = "e2b.Dockerfile"

[build]
# Build configuration

[environment]
NODE_ENV = "development"
NEXT_TELEMETRY_DISABLED = "1"
```

## Template Features

Your deployed template will include:

- ✅ **Next.js 15** with React 19
- ✅ **Supabase** with SSR support
- ✅ **Tailwind CSS 4** with utilities
- ✅ **shadcn/ui** components (auto-installed)
- ✅ **Jest** testing framework
- ✅ **TypeScript** configuration
- ✅ **Development server** with hot reloading
- ✅ **Authentication** middleware
- ✅ **Environment** configuration

## Sandbox Usage

Once deployed, your agents will create sandboxes using:

```javascript
const sandbox = await Sandbox.create({
  template: 'your-template-id',
  timeoutMs: 300000
})
```

## Updating the Template

To update the template after making changes:

```bash
# Rebuild and redeploy
e2b template build

# The template ID remains the same
```

## Troubleshooting

### Common Issues:

1. **Build fails**: Check Docker is running and e2b.Dockerfile syntax
2. **Template not found**: Verify template ID is correct
3. **Permissions**: Ensure you have access to the team/organization
4. **Network issues**: Check internet connection and e2b.dev status

### Debug Commands:

```bash
# List your templates
e2b template list

# Get template details
e2b template get your-template-id

# View build logs
e2b template logs your-template-id
```

## Cost Considerations

- **Template storage**: Free for basic templates
- **Sandbox runtime**: Charged based on usage
- **Concurrent sandboxes**: Limited by your plan
- **Bandwidth**: Included in most plans

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive data
- Templates are private to your team by default
- Sandbox instances are isolated and secure

## Next Steps

After successful deployment:

1. Update agent configurations with new template ID
2. Test sandbox creation in development
3. Monitor sandbox usage and costs
4. Consider template versioning for updates

## Support

- **Documentation**: [e2b.dev/docs](https://e2b.dev/docs)
- **Discord**: Join the E2B Discord community
- **GitHub**: [github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B)
- **Email**: support@e2b.dev