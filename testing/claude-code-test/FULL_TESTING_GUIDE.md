# 🚀 Full Claude Code E2B Testing Guide

## 🎯 Overview

You now have **both testing modes** available:
- **Mock Mode**: Safe UI testing with simulated responses
- **Full Mode**: Real Claude Code SDK integration with E2B sandboxes

## 🧪 Current Status: Mock Mode

The application is currently in **mock mode** for safe UI testing. The chat agent will show:

```
🧪 Mock Mode Active

I received: "your message"

To test the full Claude Code E2B integration:
1. Set TESTING_MODE=full in your .env.local
2. Restart the dev server
3. I'll then create a real E2B sandbox with Claude Code SDK
```

## 🚀 Enable Full Claude Code Testing

### Step 1: Switch to Full Mode

Edit your `.env.local` file:

```bash
# Change this line from 'mock' to 'full'
TESTING_MODE=full
```

### Step 2: Restart Development Server

```bash
cd claude-code-test
npm run dev
```

### Step 3: Start a New Session

1. Go to `http://localhost:3002`
2. Click **"Start New Session"**
3. Select **Business** or **Developer** mode
4. Start chatting!

## 🎭 What Happens in Full Mode

### 1. **E2B Sandbox Creation**
When you send your first message:
- Creates E2B sandbox using template `33mz2agmad58ip0izxbc`
- Starts Claude Code SDK inside the sandbox
- Updates progress sidebar with sandbox status

### 2. **Real Claude Conversations**
- Messages are forwarded to Claude Code SDK in the sandbox
- Claude analyzes your requirements with full AI capabilities
- Generates real code, creates files, and manages projects

### 3. **Live Development Environment**
- View your generated application at the sandbox URL
- Real-time code generation and file modifications
- Git integration with actual commits

### 4. **Progress Tracking**
- Watch real-time progress as Claude works
- See sandbox creation, code generation, and deployment steps
- Monitor the actual development process

## 🔍 Testing Scenarios

### Business Mode Testing
```
You: "I want to create an expense reporting application"
Claude: Creates real expense app with:
├── Database schema
├── React components  
├── API endpoints
├── Authentication
├── File upload for receipts
└── Approval workflows
```

### Developer Mode Testing
```
You: "Build a task management system with Next.js and Supabase"
Claude: Generates production-ready app with:
├── Next.js 15 + TypeScript
├── Supabase integration
├── PRIA-compliant architecture
├── Full authentication system
├── Real-time updates
└── Proper RLS policies
```

## 📊 Monitoring Full Mode

### Progress Sidebar Shows:
- ✅ **Development Environment Status**
- ✅ **Sandbox ID** (first 8 characters)
- ✅ **Environment Ready** indicator
- ✅ **Real-time progress updates**

### Console Logs:
```bash
Chat request: { session_id: 'uuid', user_input: 'your message' }
Creating new E2B sandbox for session: uuid
Sandbox created: sandbox-id, URL: https://3000-sandbox-id.e2b.app
Sending message to Claude Code SDK in sandbox
```

### Database Activity:
- Session records with real sandbox IDs
- Progress events for sandbox creation
- Requirements extracted by real Claude AI

## 🔧 Troubleshooting Full Mode

### **Sandbox Creation Fails**
```bash
Error: Failed to create development environment
```
**Solutions:**
- Check E2B_API_KEY is valid
- Verify E2B_TEMPLATE_ID exists: `33mz2agmad58ip0izxbc`
- Check E2B account limits and billing

### **Claude SDK Not Responding**
```bash
Error: I'm having trouble connecting to the development environment
```
**Solutions:**
- Wait 30-60 seconds for sandbox startup
- Check ANTHROPIC_API_KEY in sandbox environment
- Verify Claude Code SDK is running on port 8080 in sandbox

### **Sandbox URL Not Accessible**
**Solutions:**
- Wait for sandbox to fully initialize
- Check if E2B sandbox is running: `https://3000-{sandbox-id}.e2b.app`
- Verify template includes web server on port 3000

## 🎯 Success Indicators

### ✅ Full Mode Working Correctly:
1. **First message** triggers sandbox creation
2. **Progress sidebar** shows sandbox ID and "Ready for development"
3. **Claude responses** are contextual and intelligent
4. **Sandbox URL** is accessible and shows generated app
5. **Database logs** show real progress events

### ✅ Generated Application Features:
- Real React components with proper TypeScript
- Working database integration with Supabase
- PRIA-compliant architecture
- Functional authentication system
- Live preview of generated application

## 🚨 Important Notes

### **Sandbox Costs**
- Each sandbox session consumes E2B credits
- Sandboxes auto-stop after 20 minutes of inactivity
- Monitor usage in E2B dashboard

### **Development Timeline**
- Sandbox creation: ~30-60 seconds
- First Claude response: ~10-30 seconds  
- Code generation: ~1-5 minutes per feature
- Full application: ~10-30 minutes depending on complexity

### **Template Requirements**
Your E2B template (`33mz2agmad58ip0izxbc`) must include:
- Claude Code SDK installed and configured
- API service running on port 8080
- Next.js baseline project on port 3000
- All required environment variables

## 🎉 Ready to Test!

**Current Mode**: Mock (safe for UI testing)
**To Enable Full Mode**: Change `TESTING_MODE=full` in `.env.local`

The infrastructure is ready - you can now test the **complete Claude Code E2B experience** with real AI-powered development!