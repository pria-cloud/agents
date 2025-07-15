# 🔥 Hot Swap File API

Your Daytona workspace now supports **real-time file hot swapping** through API calls! This means you can modify, create, and delete files remotely, and the changes will be immediately reflected in your development environment with hot reload.

## 🚀 Quick Start

### Test Hot Swapping
```bash
# 1. Start your development environment
npm run docker:dev
# OR in Daytona: it auto-starts

# 2. Test the file API
npm run daytona:read-file      # Read a file
npm run daytona:hot-swap-demo  # Hot swap a demo file
```

## 📡 API Endpoints

### 1. **Read File Content**
```bash
GET /api/workspace/files?path=<file-path>
```

**Example:**
```bash
curl "http://localhost:3000/api/workspace/files?path=app/page.tsx"
```

**Response:**
```json
{
  "path": "app/page.tsx",
  "content": "export default function Home() {...}",
  "size": 1234,
  "modified": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

### 2. **List Directory Contents**
```bash
POST /api/workspace/files
Content-Type: application/json

{
  "path": "app/components"
}
```

**Response:**
```json
{
  "path": "app/components",
  "files": [
    {
      "name": "Button.tsx",
      "path": "app/components/Button.tsx",
      "type": "file",
      "size": 512,
      "modified": "2024-01-15T10:30:00.000Z"
    }
  ],
  "success": true
}
```

### 3. **🔥 HOT SWAP: Write/Update File**
```bash
PUT /api/workspace/files
Content-Type: application/json

{
  "path": "app/components/NewComponent.tsx",
  "content": "export default function NewComponent() { return <div>Hot Swapped!</div>; }",
  "createDirectories": true
}
```

**Response:**
```json
{
  "path": "app/components/NewComponent.tsx",
  "size": 98,
  "modified": "2024-01-15T10:35:00.000Z",
  "message": "File updated successfully - hot reload should trigger",
  "success": true
}
```

### 4. **Delete File**
```bash
DELETE /api/workspace/files
Content-Type: application/json

{
  "path": "app/components/OldComponent.tsx"
}
```

## 🔄 Hot Reload Mechanism

When you hot swap files through the API:

1. **File is written** to the filesystem
2. **Next.js file watcher** detects the change
3. **Hot reload triggers** automatically
4. **Browser updates** without refresh
5. **React components re-render** with new code

### What Triggers Hot Reload:
- ✅ **React Components** (`.tsx`, `.jsx`)
- ✅ **Pages** (`app/*/page.tsx`)
- ✅ **API Routes** (`app/api/*/route.ts`)
- ✅ **CSS/Styles** (`.css`, `.scss`)
- ✅ **TypeScript/JavaScript** (`.ts`, `.js`)

## 🛠️ Using the API Client

### JavaScript/Node.js Example
```javascript
const DaytonaWorkspaceClient = require('./examples/api-client-example.js');
const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');

// Hot swap a React component
await client.writeFile('app/components/HotTest.tsx', `
export default function HotTest() {
  return (
    <div className="p-4 bg-green-500 text-white rounded">
      <h1>🔥 Hot Swapped Component!</h1>
      <p>Updated at: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
`);

// Update styles
await client.writeFile('app/globals.css', `
/* Hot swapped styles! */
.hot-swap-indicator {
  position: fixed;
  top: 10px;
  right: 10px;
  background: #ff4444;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 9999;
}
`);

// Create a new API route
await client.writeFile('app/api/hot-swapped/route.ts', `
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: "This endpoint was hot swapped!",
    timestamp: new Date().toISOString()
  });
}
`);
```

### Python Example
```python
import requests
import json

class DaytonaClient:
    def __init__(self, workspace_url):
        self.base_url = workspace_url
    
    def hot_swap_file(self, file_path, content):
        response = requests.put(
            f"{self.base_url}/api/workspace/files",
            json={
                "path": file_path,
                "content": content,
                "createDirectories": True
            }
        )
        return response.json()

# Usage
client = DaytonaClient("https://your-workspace-id.daytona.app")

# Hot swap a component
new_component = '''
export default function PythonCreated() {
  return <div>Created from Python! 🐍</div>;
}
'''

result = client.hot_swap_file("app/components/PythonCreated.tsx", new_component)
print(f"Hot swap result: {result}")
```

### cURL Examples
```bash
# Read file
curl -s "https://your-workspace-id.daytona.app/api/workspace/files?path=app/page.tsx"

# Hot swap file
curl -X PUT "https://your-workspace-id.daytona.app/api/workspace/files" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "app/test-hot-swap.tsx",
    "content": "export default function Test() { return <div>Hot Swapped via cURL!</div>; }"
  }'

# Delete file
curl -X DELETE "https://your-workspace-id.daytona.app/api/workspace/files" \
  -H "Content-Type: application/json" \
  -d '{"path": "app/test-hot-swap.tsx"}'
```

## 🎯 Use Cases

### 1. **Live Code Editor Integration**
Build web-based code editors that can modify files in real-time:
```javascript
// When user types in browser editor
onCodeChange = async (newCode) => {
  await client.writeFile(currentFile, newCode);
  // Hot reload happens automatically!
};
```

### 2. **AI Code Generation**
Generate code with AI and hot swap it immediately:
```javascript
const aiGeneratedComponent = await generateWithAI(prompt);
await client.writeFile('app/components/AIGenerated.tsx', aiGeneratedComponent);
```

### 3. **Template System**
Apply templates and themes dynamically:
```javascript
const template = await fetchTemplate('dark-theme');
await client.writeFile('app/globals.css', template.css);
await client.writeFile('tailwind.config.ts', template.tailwindConfig);
```

### 4. **Remote Development**
Control development environment from external tools:
```javascript
// Deploy new feature branch code
const featureCode = await fetchFromGitHub(branchName);
for (const [filePath, content] of Object.entries(featureCode)) {
  await client.writeFile(filePath, content);
}
```

## 🔒 Security Features

### Path Validation
- ✅ **Directory traversal protection** - Cannot access files outside project
- ✅ **Path sanitization** - Malicious paths are blocked
- ✅ **Project boundary enforcement** - Only project files accessible

### Access Control
```javascript
// All file operations are restricted to project directory
const fullPath = join(process.cwd(), userPath);
if (!fullPath.startsWith(process.cwd())) {
  throw new Error('Access denied');
}
```

## 🚨 Error Handling

### Common Errors
```json
// File not found
{
  "error": "Failed to read file: ENOENT: no such file or directory",
  "success": false
}

// Access denied
{
  "error": "Access denied - path outside project directory",
  "success": false
}

// Invalid content
{
  "error": "Path and content are required",
  "success": false
}
```

### Client Error Handling
```javascript
try {
  await client.writeFile('invalid/path/../../../etc/passwd', 'hack');
} catch (error) {
  console.error('Hot swap failed:', error.message);
  // Handle security error appropriately
}
```

## 📊 Performance Considerations

### Optimization Tips
- **Batch operations** when possible
- **Use createDirectories: false** if directories exist
- **Monitor file sizes** - large files take longer to process
- **Cache file content** to avoid unnecessary updates

### File Size Limits
- ✅ **Text files**: Up to 10MB recommended
- ✅ **Binary files**: Not supported via API
- ✅ **Directories**: Auto-created as needed

## 🔧 Testing Your Setup

### 1. Test Basic Operations
```bash
# Test all endpoints
npm run daytona:health       # Workspace health
npm run daytona:workspace    # Workspace info
npm run daytona:test-api     # List files
npm run daytona:read-file    # Read file content
npm run daytona:hot-swap-demo # Hot swap demo
```

### 2. Manual Testing
```bash
# Create test file
curl -X PUT "http://localhost:3000/api/workspace/files" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "hot-swap-test.txt",
    "content": "Hello from API!"
  }'

# Verify file exists
ls -la hot-swap-test.txt

# Read via API
curl "http://localhost:3000/api/workspace/files?path=hot-swap-test.txt"

# Delete file
curl -X DELETE "http://localhost:3000/api/workspace/files" \
  -H "Content-Type: application/json" \
  -d '{"path": "hot-swap-test.txt"}'
```

## 🎉 Advanced Examples

### Real-time Code Collaboration
```javascript
// WebSocket + Hot Swap for real-time collaboration
websocket.onmessage = async (event) => {
  const { filePath, content, userId } = JSON.parse(event.data);
  
  if (userId !== currentUser.id) {
    await client.writeFile(filePath, content);
    showNotification(`File updated by ${userId}`);
  }
};
```

### Automated Testing Integration
```javascript
// Generate and test components automatically
const testComponent = generateTestComponent();
await client.writeFile('app/components/Test.tsx', testComponent);

// Wait for hot reload
await new Promise(resolve => setTimeout(resolve, 1000));

// Run tests on the hot-swapped component
const testResults = await runComponentTests();
```

---

**🔥 Your development environment now supports full remote file manipulation with instant hot reload!**

Ready to build the next generation of development tools! 🚀 