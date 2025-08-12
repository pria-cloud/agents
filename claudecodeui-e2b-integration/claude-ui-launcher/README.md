# Claude Code UI Launcher

A Next.js application that creates E2B sandboxes with Claude Code UI and displays them in iframes.

## Features

- **Template-Based Sandboxes**: Uses E2B templates with pre-configured Claude Code UI
- **Auto-Start Services**: Templates automatically start Claude Code UI on creation
- **Ready Detection**: Templates wait for services to be ready before becoming available
- **Session Management**: Track and manage multiple sandbox sessions
- **Embedded Interface**: View Claude Code UI directly via iframe

## System Architecture

### 1. E2B Template (`../claudecodeui-template/`)
- **Dockerfile**: Debian-based image with Node.js 20, Claude Code CLI, and claudecodeui
- **Configuration**: E2B template with auto-start and ready commands
- **Ports**: 3008 (backend API), 3009 (frontend UI)

### 2. Next.js Launcher (this directory)
- **Frontend**: React interface for managing sessions
- **API Routes**: Creates and manages E2B sandboxes using template ID
- **Environment**: Configurable template ID and API key

## Prerequisites

1. **E2B Account**: Sign up at [e2b.dev](https://e2b.dev/) and get your API key
2. **E2B CLI**: Install with `npm install -g @e2b/cli` or `brew install e2b`
3. **Node.js**: Version 18 or higher

## Setup Instructions

### Step 1: Deploy E2B Template

1. Navigate to the template directory:
   ```bash
   cd ../claudecodeui-template/
   ```

2. Ensure you're logged into E2B:
   ```bash
   e2b auth login
   ```

3. Build and deploy the template:
   ```bash
   ./deploy.sh
   ```

4. Get your template ID:
   ```bash
   e2b template list
   ```

### Step 2: Configure Environment

1. Update `.env.local` with your template ID:
   ```env
   E2B_API_KEY=your_e2b_api_key_here
   E2B_TEMPLATE_ID=your_template_id_here
   ```

### Step 3: Install and Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## How It Works

### Template Architecture
- **Base Image**: `e2bdev/code-interpreter:latest` (Debian-based)
- **Start Command**: `cd /home/user/claudecodeui && npm run dev`
- **Ready Command**: `curl -f http://localhost:3009 || exit 1`
- **Pre-installed**: Node.js 20, Claude Code CLI, claudecodeui project

### Sandbox Creation Process
1. User clicks "Launch New Claude Code UI"
2. API creates sandbox using configured template ID
3. Template auto-starts Claude Code UI and waits for readiness
4. Sandbox becomes available immediately when ready
5. Frontend displays Claude Code UI in iframe

### Configuration Files

**Template Configuration (`e2b.toml`):**
```toml
[template]
dockerfile = "e2b.Dockerfile"
start_cmd = "cd /home/user/claudecodeui && npm run dev"
ready_cmd = "curl -f http://localhost:3009 || exit 1"
```

**Environment Variables:**
- `E2B_API_KEY`: Your E2B API key (required)
- `E2B_TEMPLATE_ID`: Your deployed template ID (required)
- `NEXT_PUBLIC_APP_URL`: URL of your Next.js app (optional)

## API Endpoints

### `POST /api/sandbox/create`
Creates a new sandbox from the configured template.

**Request:**
```json
{
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://3009-abc123.e2b.dev",
  "sandboxId": "sandbox-456",
  "sessionId": "session-123"
}
```

### `POST /api/sandbox/close`
Terminates an existing sandbox.

**Request:**
```json
{
  "sessionId": "session-123"
}
```

## Troubleshooting

### Template Issues
- **Build fails**: Ensure E2B CLI is installed and you're logged in
- **Template not found**: Check template ID in environment variables
- **Services not starting**: Check template logs with `e2b sandbox logs <id>`

### Sandbox Issues
- **Creation fails**: Verify API key and template ID are correct
- **UI not loading**: Wait for ready command to complete (check template logs)
- **Connection errors**: Ensure template exposes correct ports (3008, 3009)

### Common Commands
```bash
# List templates
e2b template list

# View template logs
e2b sandbox logs <sandbox-id>

# Delete template
e2b template delete <template-id>

# Login to E2B
e2b auth login
```

## Security Considerations

- E2B sandboxes are isolated environments
- Iframe uses sandbox attributes for security
- Claude Code UI tools are disabled by default
- API keys are server-side only

## Next Steps

- Add user authentication
- Implement persistent session storage
- Add template version management
- Implement auto-cleanup for idle sessions
- Add real-time sandbox monitoring