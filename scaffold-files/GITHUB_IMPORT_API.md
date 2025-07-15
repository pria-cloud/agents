# 🚀 GitHub Repository Import API

Your Daytona workspace now supports **importing entire GitHub repositories** with instant hot swapping! This enables powerful workflows like template deployment, branch switching, code synchronization, and automated repository cloning.

## 🎯 Quick Start

### Test GitHub Import
```bash
# 1. Start your development environment
npm run docker:dev
# OR in Daytona: auto-starts

# 2. Preview a repository
npm run daytona:github-preview

# 3. Import repository files
npm run daytona:github-import
```

## 📡 API Endpoints

### 1. **Preview Repository**
```bash
GET /api/workspace/github?url=<repo-url>&branch=<branch>
```

**Example:**
```bash
curl "http://localhost:3000/api/workspace/github?url=https://github.com/vercel/next.js-examples&branch=main"
```

**Response:**
```json
{
  "success": true,
  "repository": {
    "name": "next.js-examples",
    "fullName": "vercel/next.js-examples",
    "description": "Next.js examples",
    "defaultBranch": "main",
    "language": "JavaScript",
    "size": 12345,
    "stars": 5000,
    "forks": 1000,
    "updatedAt": "2024-01-15T10:30:00Z",
    "htmlUrl": "https://github.com/vercel/next.js-examples"
  },
  "previewNote": "Use POST to actually import the repository"
}
```

### 2. **🚀 Import Repository (Hot Swap)**
```bash
POST /api/workspace/github
Content-Type: application/json

{
  "repoUrl": "https://github.com/owner/repo",
  "branch": "main",
  "targetPath": ".",
  "overwrite": false,
  "excludePatterns": [".git", "node_modules", ".env*", "*.log"],
  "includePatterns": []
}
```

**Parameters:**
- `repoUrl` (required): GitHub repository URL
- `branch` (optional): Branch/tag to import (default: "main")  
- `targetPath` (optional): Target directory in workspace (default: ".")
- `overwrite` (optional): Overwrite existing files (default: false)
- `excludePatterns` (optional): Files/patterns to exclude
- `includePatterns` (optional): Only include matching files (if specified)

**Response:**
```json
{
  "success": true,
  "repository": "vercel/next.js-examples",
  "branch": "main",
  "targetPath": ".",
  "filesProcessed": 45,
  "filesSkipped": 2,
  "filesErrored": 0,
  "files": {
    "success": ["app/page.tsx", "components/Header.tsx", ...],
    "skipped": ["README.md", "package.json"],
    "errors": []
  },
  "message": "Successfully imported 45 files from GitHub repository"
}
```

## 🔄 Hot Reload Process

When you import a GitHub repository:

1. **Repository is fetched** from GitHub API
2. **Files are downloaded** and decoded
3. **Filtering is applied** (include/exclude patterns)
4. **Files are written** to the workspace filesystem
5. **Hot reload triggers** automatically for all changes
6. **Browser updates** reflect all imported files instantly

## 🛠️ Using the API Client

### JavaScript/Node.js Examples

```javascript
const DaytonaWorkspaceClient = require('./examples/api-client-example.js');
const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');

// Preview repository
const repoInfo = await client.previewGitHubRepo(
  'https://github.com/shadcn-ui/ui'
);

// Import entire repository
await client.importGitHubRepo('https://github.com/vercel/next.js-examples', {
  branch: 'main',
  targetPath: 'examples',
  overwrite: true,
  excludePatterns: ['.git', 'node_modules', '*.md']
});

// Import template (convenience method)
await client.importTemplate('https://github.com/shadcn-ui/next-template');

// Switch to different branch
await client.switchToBranch(
  'https://github.com/your-org/your-repo', 
  'feature/new-design'
);
```

### Python Example
```python
import requests

class GitHubImporter:
    def __init__(self, workspace_url):
        self.base_url = workspace_url
    
    def import_repo(self, repo_url, **options):
        response = requests.post(
            f"{self.base_url}/api/workspace/github",
            json={
                "repoUrl": repo_url,
                **options
            }
        )
        return response.json()

# Usage
importer = GitHubImporter("https://your-workspace-id.daytona.app")
result = importer.import_repo(
    "https://github.com/tailwindlabs/tailwindcss",
    includePatterns=["src/**/*.css"],
    targetPath="styles/tailwind"
)
print(f"Imported {result['filesProcessed']} files")
```

### cURL Examples
```bash
# Preview repository
curl -s "https://workspace.daytona.app/api/workspace/github?url=https://github.com/facebook/react"

# Import repository
curl -X POST "https://workspace.daytona.app/api/workspace/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/vercel/next.js-examples",
    "branch": "main",
    "includePatterns": ["with-tailwindcss/*"],
    "targetPath": "imported/tailwind-example",
    "overwrite": true
  }'

# Import template
curl -X POST "https://workspace.daytona.app/api/workspace/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/shadcn-ui/next-template",
    "overwrite": true,
    "excludePatterns": [".git", "README.md", "*.md"]
  }'
```

## 🎯 Use Cases

### 1. **Template Deployment**
Deploy entire project templates instantly:
```javascript
// Deploy a complete Next.js + Tailwind template
await client.importTemplate('https://github.com/vercel/next.js-tailwind-template', {
  overwrite: true,
  excludePatterns: ['.git', 'README.md', '.env.example']
});
```

### 2. **Branch Switching**
Switch between different branches for testing:
```javascript
// Switch to feature branch for preview
await client.switchToBranch(
  'https://github.com/your-org/your-app',
  'feature/new-ui',
  { targetPath: 'preview/new-ui' }
);

// Switch back to main
await client.switchToBranch(
  'https://github.com/your-org/your-app',
  'main',
  { overwrite: true }
);
```

### 3. **Component Library Import**
Import specific components from design systems:
```javascript
// Import only components from Shadcn UI
await client.importGitHubRepo('https://github.com/shadcn-ui/ui', {
  includePatterns: ['components/ui/*'],
  targetPath: 'components/shadcn',
  branch: 'main'
});
```

### 4. **Code Synchronization**
Keep workspace in sync with external repositories:
```javascript
// Sync with latest changes
setInterval(async () => {
  await client.importGitHubRepo(
    'https://github.com/your-org/shared-components',
    { 
      targetPath: 'shared',
      overwrite: true,
      branch: 'main'
    }
  );
  console.log('📦 Synced with latest shared components');
}, 60000); // Every minute
```

### 5. **Multi-Repository Workspace**
Combine multiple repositories:
```javascript
// Create multi-repo workspace
const repos = [
  { url: 'https://github.com/tailwindlabs/tailwindcss', path: 'styles' },
  { url: 'https://github.com/shadcn-ui/ui', path: 'components' },
  { url: 'https://github.com/vercel/next.js-examples', path: 'examples' }
];

for (const repo of repos) {
  await client.importGitHubRepo(repo.url, {
    targetPath: repo.path,
    includePatterns: ['src/*', 'components/*']
  });
}
```

## 🔒 Security Features

### Repository Validation
- ✅ **GitHub URL validation** - Only GitHub.com URLs accepted
- ✅ **Public repository access** - No authentication required
- ✅ **Path traversal protection** - Cannot write outside project
- ✅ **File filtering** - Control what gets imported

### Access Control
```javascript
// Security checks in API
if (!fullPath.startsWith(process.cwd())) {
  throw new Error('Access denied - path outside project directory');
}
```

### Rate Limiting Considerations
- GitHub API has rate limits (5000 requests/hour for authenticated, 60 for unauthenticated)
- Large repositories may take time to download
- Consider caching for frequently accessed repositories

## 📊 Pattern Filtering

### Exclude Patterns (Default)
```javascript
const defaultExcludePatterns = [
  '.git',           // Git metadata
  'node_modules',   // Dependencies
  '.env*',          // Environment files
  '*.log',          // Log files
  '.DS_Store',      // macOS files
  'Thumbs.db'       // Windows files
];
```

### Include Patterns Examples
```javascript
// Only TypeScript/JavaScript files
includePatterns: ['*.ts', '*.tsx', '*.js', '*.jsx']

// Only components and styles
includePatterns: ['components/*', 'styles/*', '*.css']

// Specific directory structure
includePatterns: ['src/components/*', 'src/hooks/*', 'src/utils/*']

// Multiple file types
includePatterns: ['*.md', '*.json', 'config/*']
```

### Pattern Matching
- `*` matches any characters within a directory level
- `/**/*` matches files in subdirectories
- Exact string matching for specific files/directories

## 🚨 Error Handling

### Common Errors
```json
// Repository not found
{
  "error": "GitHub API error: 404 Not Found",
  "success": false
}

// Invalid URL
{
  "error": "Invalid GitHub repository URL",
  "success": false
}

// Branch not found
{
  "error": "Failed to fetch repository tree: 404 Not Found",
  "success": false
}

// File write errors
{
  "files": {
    "errors": [
      {
        "path": "src/component.tsx",
        "error": "EACCES: permission denied"
      }
    ]
  }
}
```

### Client Error Handling
```javascript
try {
  await client.importGitHubRepo('https://github.com/invalid/repo');
} catch (error) {
  if (error.message.includes('404')) {
    console.error('Repository not found or private');
  } else if (error.message.includes('rate limit')) {
    console.error('GitHub API rate limit exceeded');
  } else {
    console.error('Import failed:', error.message);
  }
}
```

## 📈 Performance Optimization

### Best Practices
- **Use include patterns** to limit scope
- **Exclude large directories** (node_modules, .git)
- **Target specific paths** instead of root
- **Monitor file count** - large repos take longer

### Example Optimized Import
```javascript
// Efficient component library import
await client.importGitHubRepo('https://github.com/large-ui-library/components', {
  includePatterns: ['dist/components/*', '*.d.ts'],
  excludePatterns: ['src/*', 'tests/*', 'docs/*'],
  targetPath: 'external/ui-lib'
});
```

## 🔧 Testing Your Setup

### 1. Test Basic Import
```bash
# Preview repository
npm run daytona:github-preview

# Import test repository
npm run daytona:github-import

# Check imported files
npm run daytona:test-api
```

### 2. Manual Testing
```bash
# Test different repository
curl -X POST "http://localhost:3000/api/workspace/github" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/your-username/your-repo",
    "branch": "main",
    "targetPath": "test-import",
    "overwrite": true
  }'
```

### 3. Verify Hot Reload
1. Import repository with React components
2. Check browser for immediate updates
3. Verify new routes/pages are accessible
4. Confirm styles are applied

## 🎉 Advanced Workflows

### Automated Template Switching
```javascript
// Template management system
const templates = {
  'blog': 'https://github.com/vercel/next.js-blog-template',
  'ecommerce': 'https://github.com/vercel/commerce',
  'dashboard': 'https://github.com/shadcn-ui/next-template'
};

async function switchTemplate(templateName) {
  const repoUrl = templates[templateName];
  if (!repoUrl) throw new Error('Template not found');
  
  await client.importTemplate(repoUrl, {
    overwrite: true,
    excludePatterns: ['.git', 'README.md', 'package-lock.json']
  });
  
  console.log(`✅ Switched to ${templateName} template`);
}

// Usage
await switchTemplate('dashboard');
```

### Multi-Environment Sync
```javascript
// Sync development environment with production branch
async function syncWithProduction() {
  await client.importGitHubRepo('https://github.com/your-org/your-app', {
    branch: 'production',
    targetPath: 'production-preview',
    overwrite: true
  });
}

// Sync with staging
async function syncWithStaging() {
  await client.importGitHubRepo('https://github.com/your-org/your-app', {
    branch: 'staging',
    targetPath: 'staging-preview',
    overwrite: true
  });
}
```

### Component Discovery
```javascript
// Discover and import components from multiple repositories
const componentRepos = [
  'https://github.com/shadcn-ui/ui',
  'https://github.com/headlessui/headlessui',
  'https://github.com/tailwindlabs/heroicons'
];

for (const [index, repo] of componentRepos.entries()) {
  await client.importGitHubRepo(repo, {
    includePatterns: ['components/*', 'src/components/*'],
    targetPath: `external/components-${index + 1}`,
    overwrite: true
  });
}
```

---

**🚀 Your workspace now supports importing entire GitHub repositories with instant hot reload!**

This opens up incredible possibilities:
- 🎨 **Instant template deployment**
- 🔄 **Branch switching and testing**  
- 📦 **Component library integration**
- 🔀 **Multi-repository workflows**
- 🤖 **Automated code synchronization**

Ready to revolutionize your development workflow! 🎉 