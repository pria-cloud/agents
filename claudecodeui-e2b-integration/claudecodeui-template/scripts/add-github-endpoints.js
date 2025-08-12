#!/usr/bin/env node
/**
 * Add GitHub integration endpoints to claudecodeui server
 * This script patches the server.js file to add API endpoints for GitHub operations
 */

const fs = require('fs');
const path = require('path');

// Try different possible server file locations
const possibleServerPaths = [
  '/home/user/claudecodeui/server.js',
  '/home/user/claudecodeui/server/index.js',
  '/home/user/claudecodeui/server/server.js'
];

let SERVER_PATH = null;
for (const serverPath of possibleServerPaths) {
  if (fs.existsSync(serverPath)) {
    SERVER_PATH = serverPath;
    break;
  }
}

if (!SERVER_PATH) {
  console.error('No server file found - GitHub endpoints script should run after CORS enhancement');
  process.exit(1);
}

// GitHub API endpoints code
const githubEndpoints = `
// GitHub Integration API Endpoints
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Initialize project from GitHub
app.post('/api/github/init', async (req, res) => {
  const { projectName, githubRepo, githubToken, branch = 'main' } = req.body;
  
  try {
    console.log(\`Initializing project: \${projectName} from \${githubRepo} (branch: \${branch})\`);
    
    // Set GitHub token
    if (githubToken) {
      await execAsync(\`echo "\${githubToken}" | gh auth login --with-token\`);
    }
    
    // Restore project
    const result = await execAsync(
      \`/home/user/scripts/restore-claude-project.sh "\${projectName}" "\${githubRepo}" "\${branch}"\`
    );
    
    // Start auto-sync in background
    execAsync(\`/home/user/scripts/claude-session-sync.sh "\${projectName}" &\`);
    
    res.json({ 
      success: true, 
      message: 'Project initialized from GitHub',
      output: result.stdout,
      projectPath: \`/home/user/projects/\${projectName}\`
    });
  } catch (error) {
    console.error('GitHub init error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stderr || error.toString()
    });
  }
});

// Create new project with optional baseline template
app.post('/api/github/create', async (req, res) => {
  const { projectName, template = 'blank', workspaceId, sessionId } = req.body;
  
  try {
    console.log(\`Creating new project: \${projectName} with template: \${template}\`);
    
    const projectPath = \`/home/user/projects/\${projectName}\`;
    
    // Initialize using init script
    const result = await execAsync(
      \`/home/user/scripts/init-pria-project.sh "\${projectPath}" "\${projectName}" "\${process.env.ANTHROPIC_API_KEY}" "\${workspaceId}" "\${sessionId}"\`
    );
    
    // If using baseline template, copy it
    if (template === 'baseline-nextjs' && fs.existsSync('/home/user/baseline-project')) {
      await execAsync(\`cp -r /home/user/baseline-project/. "\${projectPath}/"\`);
      // Re-run git add after copying template files
      await execAsync(\`cd "\${projectPath}" && git add . && git commit -m "Add baseline Next.js template"\`);
    }
    
    // Start auto-sync in background
    execAsync(\`/home/user/scripts/claude-session-sync.sh "\${projectName}" &\`);
    
    res.json({ 
      success: true, 
      message: 'Project created successfully',
      output: result.stdout,
      projectPath: projectPath
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stderr || error.toString()
    });
  }
});

// Manual sync trigger
app.post('/api/github/sync', async (req, res) => {
  const { projectName } = req.body;
  
  try {
    console.log(\`Manual sync triggered for project: \${projectName}\`);
    
    const projectPath = \`/home/user/projects/\${projectName}\`;
    
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ 
        success: false,
        error: 'Project not found' 
      });
    }
    
    // Trigger sync once
    const result = await execAsync(
      \`/home/user/scripts/claude-session-sync.sh "\${projectName}" once\`
    );
    
    res.json({ 
      success: true,
      message: 'Sync completed',
      output: result.stdout
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stderr || error.toString()
    });
  }
});

// Get sync status
app.get('/api/github/status/:projectName', async (req, res) => {
  const { projectName } = req.params;
  
  try {
    const projectPath = \`/home/user/projects/\${projectName}\`;
    
    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ 
        success: false,
        error: 'Project not found' 
      });
    }
    
    const result = await execAsync(\`cd "\${projectPath}" && git status --short\`);
    const gitLog = await execAsync(\`cd "\${projectPath}" && git log --oneline -5\`);
    
    res.json({ 
      success: true,
      clean: result.stdout.trim() === '',
      changes: result.stdout,
      recentCommits: gitLog.stdout.split('\n').filter(line => line.trim()),
      projectPath: projectPath
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.stderr || error.toString()
    });
  }
});

// List available projects
app.get('/api/github/projects', async (req, res) => {
  try {
    const projectsPath = '/home/user/projects';
    
    if (!fs.existsSync(projectsPath)) {
      return res.json({ success: true, projects: [] });
    }
    
    const projects = fs.readdirSync(projectsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const projectPath = path.join(projectsPath, dirent.name);
        const metadataPath = path.join(projectPath, '.pria', 'project.json');
        
        let metadata = {};
        if (fs.existsSync(metadataPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          } catch (e) {
            // Ignore metadata read errors
          }
        }
        
        return {
          name: dirent.name,
          path: projectPath,
          ...metadata
        };
      });
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Projects list error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Test endpoint for connectivity
app.get('/api/github/status/test', (req, res) => {
  res.json({
    success: true,
    message: 'GitHub API endpoints are active',
    timestamp: new Date().toISOString(),
    services: {
      git: fs.existsSync('/usr/bin/git'),
      gh: fs.existsSync('/usr/bin/gh'),
      claude: fs.existsSync('/usr/local/bin/claude') || fs.existsSync('/home/user/.npm-global/bin/claude')
    }
  });
});
`;

async function patchServerFile() {
  try {
    if (!fs.existsSync(SERVER_PATH)) {
      console.error('Server file not found:', SERVER_PATH);
      process.exit(1);
    }
    
    let serverContent = fs.readFileSync(SERVER_PATH, 'utf8');
    
    // Check if already patched
    if (serverContent.includes('GitHub Integration API Endpoints')) {
      console.log('Server already patched with GitHub API endpoints');
      return;
    }
    
    // Find where to insert GitHub endpoints (before server.listen or at the end)
    const serverListenRegex = /(server\.listen|app\.listen)/;
    const listenMatch = serverContent.match(serverListenRegex);
    
    let insertIndex;
    if (listenMatch) {
      // Insert before server.listen
      insertIndex = listenMatch.index;
    } else {
      // Insert at the end of file
      insertIndex = serverContent.length;
    }
    
    const beforeInsert = serverContent.substring(0, insertIndex);
    const afterInsert = serverContent.substring(insertIndex);
    
    serverContent = beforeInsert + '\n' + githubEndpoints + '\n' + afterInsert;
    
    // Note: fs is already imported in the original claudecodeui server, so we don't need to add it
    
    // Write the patched file
    fs.writeFileSync(SERVER_PATH, serverContent);
    console.log('✓ Server patched with GitHub API endpoints');
    
  } catch (error) {
    console.error('Error patching server file:', error);
    process.exit(1);
  }
}

// Run the patch
patchServerFile();