# 🚀 Quick Start: Deploy Scaffold to Daytona

Deploy your scaffold application to Daytona in under 5 minutes!

## Your API Key
```
Set your DAYTONA_API_KEY environment variable or pass it as an argument
```

## Option 1: One-Command Deployment

### Using CLI (Recommended - No dependency conflicts)
```bash
npm run daytona:deploy:cli
```

### Using Node.js SDK
```bash
npm run daytona:deploy
```

### Using Python SDK
```bash
npm run daytona:deploy:python
```

## Option 2: Manual Scripts

### Make scripts executable first:
```bash
chmod +x daytona-deploy.js daytona-deploy.py
```

### Deploy from current directory:
```bash
./daytona-deploy.js
# OR
./daytona-deploy.py
```

### Deploy from specific git repository:
```bash
./daytona-deploy.js https://github.com/yourusername/your-repo.git
# OR
./daytona-deploy.py https://github.com/yourusername/your-repo.git
```

## Option 3: Daytona Dashboard

1. Go to [Daytona Dashboard](https://daytona.io/dashboard)
2. Enter your API key from Daytona dashboard
3. Click "Create Sandbox"
4. Enter your git repository URL
5. Set resources: 2 CPU, 4GB RAM, 8GB disk
6. Click "Create"

## What You Get

After deployment, your Daytona sandbox will have:

✅ **Next.js Development Server** running on port 3000
✅ **Hot Reload APIs** for live file updates
✅ **GitHub Repository Import** functionality
✅ **File Manipulation APIs** for remote development
✅ **Health Monitoring** endpoints
✅ **Webhook Support** for integrations

## Quick Test

Once deployed, test your APIs:

```bash
# Health check
curl https://your-sandbox-url.daytona.io/api/health

# File operations
curl https://your-sandbox-url.daytona.io/api/workspace/files?path=app/page.tsx

# GitHub import
curl -X POST https://your-sandbox-url.daytona.io/api/workspace/github \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/vercel/next.js-examples","targetPath":"examples"}'
```

## Need Help?

- 📖 Full documentation: [DAYTONA_DEPLOYMENT.md](./DAYTONA_DEPLOYMENT.md)
- 🔧 GitHub API docs: [GITHUB_IMPORT_API.md](./GITHUB_IMPORT_API.md)
- 🔥 Hot swap docs: [HOT_SWAP_API.md](./HOT_SWAP_API.md)
- 🐳 Docker setup: [DOCKER_DEV.md](./DOCKER_DEV.md)

## Troubleshooting

### React Dependency Conflicts (Most Common)
If you see `ERESOLVE unable to resolve dependency tree` errors:

```bash
# Option 1: Use CLI-based deployment (avoids SDK conflicts)
npm run daytona:deploy:cli

# Option 2: Install SDK with legacy peer deps
npm run daytona:install-sdk

# Option 3: Force install SDK
npm run daytona:install-sdk-force

# Then retry deployment
npm run daytona:deploy
```

### Prerequisites Missing
```bash
# Ensure you have Node.js or Python
node --version
python3 --version

# Ensure you're in a git repository
git status
```

### Permission Issues
```bash
chmod +x daytona-deploy.js daytona-deploy.py daytona-deploy-cli.js
```

### Git Repository Not Found
1. Ensure your scaffold is in a git repository
2. Push your changes to GitHub/GitLab
3. Use the repository URL with the deployment script

### API Key Issues
- Double-check the API key is correct and not expired
- Try accessing Daytona dashboard manually to verify the key works

## Ready to Go! 🎉

Your scaffold application will be running in Daytona with all the powerful APIs we built together. Perfect for remote development, team collaboration, and cloud-native workflows! 