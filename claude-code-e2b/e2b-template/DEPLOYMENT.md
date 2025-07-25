# E2B Template Deployment Guide

## 🚀 Quick Start

### Step 1: Prerequisites

```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login to E2B (you'll need to create an account at e2b.dev)
e2b auth login
```

### Step 2: Deploy Template

```bash
# Navigate to the template directory
cd claude-code-e2b/e2b-template

# Run the deployment script
./create-template.sh
```

The script will:
1. ✅ Check prerequisites
2. ✅ Build API service
3. ✅ Prepare baseline project
4. ✅ Create E2B template
5. ✅ Run health checks
6. ✅ Generate template ID

### Step 3: Get Your Template ID

After successful deployment, you'll see output like:
```
🎉 Claude Code E2B Template Created Successfully!
Template ID: claude-code-e2b-20241223-142537
```

**Save this Template ID** - you'll need it for:
- Local testing
- PRIA frontend integration
- Creating sandboxes

## 🧪 Test Your Template

### Create Test Sandbox

```bash
# Replace with your actual template ID
export TEMPLATE_ID="your-template-id-here"

# Create a test sandbox
e2b sandbox create $TEMPLATE_ID
```

You'll get output with sandbox URLs:
```
Sandbox ID: abc123def456
API Service: https://abc123def456-8080.e2b.dev
Frontend: https://abc123def456-3000.e2b.dev
```

### Verify Services

```bash
# Test API health (replace with your sandbox ID)
curl https://abc123def456-8080.e2b.dev/health

# Should return:
{
  "status": "healthy",
  "timestamp": "2024-01-23T14:25:37.123Z",
  "services": {
    "claude": true,
    "git": true,
    "project": true,
    "files": true
  }
}
```

### Test Frontend

Open the frontend URL in your browser:
```
https://abc123def456-3000.e2b.dev
```

You should see the baseline Next.js application.

## 🔧 Configure Environment Variables

### Set API Keys in E2B

```bash
# Set your Anthropic API key for Claude integration
e2b template env set $TEMPLATE_ID ANTHROPIC_API_KEY "your-anthropic-api-key"

# Optional: Set Supabase credentials
e2b template env set $TEMPLATE_ID NEXT_PUBLIC_SUPABASE_URL "your-supabase-url"
e2b template env set $TEMPLATE_ID NEXT_PUBLIC_SUPABASE_ANON_KEY "your-supabase-anon-key"
e2b template env set $TEMPLATE_ID SUPABASE_SERVICE_ROLE_KEY "your-service-role-key"

# Optional: Set Git credentials
e2b template env set $TEMPLATE_ID GIT_USER_NAME "Your Name"
e2b template env set $TEMPLATE_ID GIT_USER_EMAIL "your.email@domain.com"
e2b template env set $TEMPLATE_ID GITHUB_TOKEN "your-github-token"
```

## 📝 Update Integration Files

### Update Local Testing

Copy your template ID to the local testing environment:

```bash
# Edit the local testing .env.local file
E2B_TEMPLATE_ID=your-template-id-here
```

### Update PRIA Integration

Add the template ID to your PRIA environment:

```bash
# In your PRIA .env.local
E2B_TEMPLATE_ID=your-template-id-here
```

## 🔄 Template Updates

When you need to update the template:

### Method 1: Update Existing Template

```bash
# Make your code changes
# Then redeploy
./create-template.sh
```

### Method 2: Create New Version

```bash
# Create a new template version
./create-template.sh

# Update your integration with the new template ID
```

## 📊 Monitor Template

### View Template Details

```bash
# List your templates
e2b template list

# Get specific template info
e2b template get $TEMPLATE_ID
```

### View Sandbox Logs

```bash
# Create a sandbox for debugging
SANDBOX_ID=$(e2b sandbox create $TEMPLATE_ID --json | jq -r '.id')

# View logs
e2b sandbox logs $SANDBOX_ID

# Clean up
e2b sandbox close $SANDBOX_ID
```

## 🐛 Troubleshooting

### Template Build Fails

```bash
# Check build logs
e2b template logs $TEMPLATE_ID

# Test locally first
cd claude-code-e2b/e2b-template
docker build -f e2b.Dockerfile -t test-template .
docker run -p 3000:3000 -p 8080:8080 test-template
```

### Services Don't Start

```bash
# Create sandbox and check logs
SANDBOX_ID=$(e2b sandbox create $TEMPLATE_ID --json | jq -r '.id')
sleep 30  # Wait for services to start
e2b sandbox logs $SANDBOX_ID

# Check specific service logs
e2b sandbox exec $SANDBOX_ID "cat /code/logs/api-service.log"
e2b sandbox exec $SANDBOX_ID "cat /code/logs/nextjs.log"
```

### Health Check Fails

```bash
# Test API directly in sandbox
e2b sandbox exec $SANDBOX_ID "curl -s http://localhost:8080/health"

# Check if processes are running
e2b sandbox exec $SANDBOX_ID "ps aux | grep -E 'node|npm'"

# Check port usage
e2b sandbox exec $SANDBOX_ID "netstat -tlnp"
```

### Common Issues & Solutions

**Issue**: `ANTHROPIC_API_KEY not set`
**Solution**: Set environment variable in E2B template

**Issue**: Next.js fails to start
**Solution**: Check if port 3000 is available, check dependencies

**Issue**: API service returns 500 errors
**Solution**: Check API logs, verify all services are initialized

**Issue**: Template build timeout
**Solution**: Optimize Dockerfile, remove unnecessary files

## ✅ Success Checklist

Before considering your template ready:

- [ ] Template creates successfully
- [ ] Both services (API + Next.js) start
- [ ] Health endpoint returns 200
- [ ] Frontend loads in browser
- [ ] API endpoints respond correctly
- [ ] WebSocket connections work
- [ ] File operations function
- [ ] Git operations work
- [ ] Environment variables are set
- [ ] Template ID is saved

## 🎯 Integration Ready

Once your template is working:

1. **Template ID**: `your-template-id-here`
2. **API URL Pattern**: `https://{sandbox-id}-8080.e2b.dev`
3. **Frontend URL Pattern**: `https://{sandbox-id}-3000.e2b.dev`
4. **Health Check**: `GET /health`
5. **WebSocket**: `ws://{sandbox-id}-8080.e2b.dev`

You're now ready to integrate with:
- ✅ Local testing environment
- ✅ PRIA frontend integration
- ✅ Production deployment

## 📞 Support

If you encounter issues:

1. Check E2B template logs
2. Test template locally with Docker
3. Verify environment variables
4. Check API and service logs
5. Review E2B documentation: [docs.e2b.dev](https://docs.e2b.dev)

Your Claude Code E2B template is now ready for integration! 🎉