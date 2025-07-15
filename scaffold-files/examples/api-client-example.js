/**
 * Example API Client for communicating with Daytona workspace
 * 
 * This demonstrates how external services can interact with your
 * Next.js application running in Daytona.io, including HOT SWAPPING files!
 */

class DaytonaWorkspaceClient {
  constructor(workspaceUrl) {
    // Replace with your actual Daytona workspace URL
    this.baseUrl = workspaceUrl || 'https://your-workspace-id.daytona.app';
  }

  /**
   * Check if the workspace is healthy and running
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const data = await response.json();
      
      console.log('✅ Workspace Health:', {
        status: data.status,
        environment: data.environment,
        daytona: data.daytona,
        uptime: `${Math.floor(data.uptime / 60)} minutes`
      });
      
      return data;
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace`);
      const data = await response.json();
      
      console.log('📁 Workspace Info:', data);
      return data;
    } catch (error) {
      console.error('❌ Failed to get workspace info:', error.message);
      throw error;
    }
  }

  /**
   * List files in a specific directory
   */
  async listFiles(path = '.') {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path })
      });
      
      const data = await response.json();
      
      console.log(`📂 Files in ${path}:`);
      data.files.forEach(file => {
        const icon = file.type === 'directory' ? '📁' : '📄';
        console.log(`  ${icon} ${file.name} (${file.size} bytes)`);
      });
      
      return data.files;
    } catch (error) {
      console.error('❌ Failed to list files:', error.message);
      throw error;
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath) {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/files?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`📖 Read file: ${filePath} (${data.size} bytes)`);
        return data.content;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error(`❌ Failed to read file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * HOT SWAP: Write/update file content (triggers hot reload!)
   */
  async writeFile(filePath, content, createDirectories = true) {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/files`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath, 
          content, 
          createDirectories 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`🔄 HOT SWAPPED: ${filePath} (${data.size} bytes) - ${data.message}`);
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error(`❌ Failed to write file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath) {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`🗑️ Deleted: ${filePath}`);
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error(`❌ Failed to delete file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * HOT SWAP: Update a React component (example)
   */
  async updateReactComponent(componentPath, newCode) {
    try {
      console.log(`🔄 Hot swapping React component: ${componentPath}`);
      await this.writeFile(componentPath, newCode);
      console.log('✅ Component updated! Check your browser for hot reload.');
    } catch (error) {
      console.error('❌ Failed to update component:', error.message);
      throw error;
    }
  }

  /**
   * HOT SWAP: Update CSS/Tailwind styles
   */
  async updateStyles(cssPath, newStyles) {
    try {
      console.log(`🎨 Hot swapping styles: ${cssPath}`);
      await this.writeFile(cssPath, newStyles);
      console.log('✅ Styles updated! Check your browser for hot reload.');
    } catch (error) {
      console.error('❌ Failed to update styles:', error.message);
      throw error;
    }
  }

  /**
   * HOT SWAP: Create a new page
   */
  async createPage(pagePath, pageContent) {
    try {
      console.log(`🆕 Creating new page: ${pagePath}`);
      await this.writeFile(pagePath, pageContent, true);
      console.log('✅ Page created! Check your browser - new route should be available.');
    } catch (error) {
      console.error('❌ Failed to create page:', error.message);
      throw error;
    }
  }

  /**
   * Monitor workspace status
   */
  async monitor(intervalSeconds = 30) {
    console.log(`🔍 Starting workspace monitoring (every ${intervalSeconds}s)`);
    
    setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('❌ Monitoring check failed:', error.message);
      }
    }, intervalSeconds * 1000);
  }

  /**
   * Send data to workspace (example webhook simulation)
   */
  async sendWebhookData(data) {
    try {
      const response = await fetch(`${this.baseUrl}/api/webhooks/external`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      console.log('📤 Webhook sent successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to send webhook:', error.message);
      throw error;
    }
  }

  /**
   * 🚀 GITHUB IMPORT: Preview repository before importing
   */
  async previewGitHubRepo(repoUrl, branch = 'main') {
    try {
      const url = `${this.baseUrl}/api/workspace/github?url=${encodeURIComponent(repoUrl)}&branch=${branch}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        console.log('👀 Repository Preview:', {
          name: data.repository.fullName,
          description: data.repository.description,
          language: data.repository.language,
          stars: data.repository.stars,
          size: `${data.repository.size} KB`,
          updatedAt: data.repository.updatedAt
        });
        return data.repository;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('❌ Failed to preview repository:', error.message);
      throw error;
    }
  }

  /**
   * 🚀 GITHUB IMPORT: Import entire repository and hot swap all files
   */
  async importGitHubRepo(repoUrl, options = {}) {
    try {
      const {
        branch = 'main',
        targetPath = '.',
        overwrite = false,
        excludePatterns = ['.git', 'node_modules', '.env*', '*.log'],
        includePatterns = []
      } = options;

      console.log(`📦 Importing GitHub repository: ${repoUrl}@${branch}`);
      
      const response = await fetch(`${this.baseUrl}/api/workspace/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl,
          branch,
          targetPath,
          overwrite,
          excludePatterns,
          includePatterns
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('🎉 GitHub Import Successful!', {
          repository: data.repository,
          branch: data.branch,
          filesProcessed: data.filesProcessed,
          filesSkipped: data.filesSkipped,
          filesErrored: data.filesErrored
        });
        
        if (data.files.errors.length > 0) {
          console.warn('⚠️ Some files had errors:', data.files.errors);
        }
        
        if (data.files.skipped.length > 0) {
          console.log('⏭️ Skipped files (already exist):', data.files.skipped);
        }
        
        console.log('🔄 Hot reload should trigger automatically!');
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('❌ GitHub import failed:', error.message);
      throw error;
    }
  }

  /**
   * 🚀 GITHUB IMPORT: Import specific template (convenience method)
   */
  async importTemplate(templateRepoUrl, options = {}) {
    try {
      console.log(`📋 Importing template from: ${templateRepoUrl}`);
      
      // Default to overwrite for templates
      const templateOptions = {
        overwrite: true,
        excludePatterns: ['.git', 'node_modules', '.env*', '*.log', 'README.md'],
        ...options
      };
      
      const result = await this.importGitHubRepo(templateRepoUrl, templateOptions);
      console.log('✅ Template imported successfully! Your workspace has been updated.');
      return result;
    } catch (error) {
      console.error('❌ Template import failed:', error.message);
      throw error;
    }
  }

  /**
   * 🚀 GITHUB IMPORT: Switch to different branch/version
   */
  async switchToBranch(repoUrl, targetBranch, options = {}) {
    try {
      console.log(`🔀 Switching to branch: ${targetBranch}`);
      
      const switchOptions = {
        branch: targetBranch,
        overwrite: true,
        ...options
      };
      
      const result = await this.importGitHubRepo(repoUrl, switchOptions);
      console.log(`✅ Switched to branch ${targetBranch} successfully!`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to switch to branch ${targetBranch}:`, error.message);
      throw error;
    }
  }
}

// Hot Swap Examples
async function hotSwapExamples() {
  const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');

  try {
    // Example 1: Update a React component
    const newComponentCode = `
export default function UpdatedComponent() {
  return (
    <div className="p-4 bg-blue-500 text-white rounded">
      <h1>I was hot swapped via API! 🔥</h1>
      <p>Updated at: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}`;
    
    await client.updateReactComponent('app/components/HotSwapTest.tsx', newComponentCode);

    // Example 2: Update global styles
    const newStyles = `
/* Hot swapped styles */
.hot-swap-demo {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  color: white;
  padding: 2rem;
  border-radius: 1rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}`;
    
    await client.writeFile('app/hot-swap.css', newStyles);

    // Example 3: Create a new API route
    const newApiRoute = `
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'This API route was created via hot swap!',
    timestamp: new Date().toISOString(),
    hotSwapped: true
  });
}`;
    
    await client.createPage('app/api/hot-swap-test/route.ts', newApiRoute);

    console.log('🎉 All hot swap examples completed! Check your browser.');

  } catch (error) {
    console.error('❌ Hot swap examples failed:', error);
  }
}

// GitHub Import Examples
async function gitHubImportExamples() {
  const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');

  try {
    // Example 1: Preview a repository before importing
    console.log('🔍 Previewing repository...');
    await client.previewGitHubRepo('https://github.com/vercel/next.js-starter');

    // Example 2: Import a template repository
    console.log('📋 Importing template...');
    await client.importTemplate('https://github.com/shadcn-ui/next-template', {
      targetPath: 'templates/shadcn',
      overwrite: true
    });

    // Example 3: Import specific files from a repository
    console.log('📂 Importing specific files...');
    await client.importGitHubRepo('https://github.com/tailwindlabs/tailwindcss', {
      includePatterns: ['*.css', 'components/*'],
      targetPath: 'imported/tailwind'
    });

    // Example 4: Switch to different branch
    console.log('🔀 Switching branches...');
    await client.switchToBranch(
      'https://github.com/your-org/your-repo', 
      'feature/new-ui',
      { targetPath: 'feature-preview' }
    );

    // Example 5: Import entire repository with custom filters
    console.log('📦 Full repository import...');
    await client.importGitHubRepo('https://github.com/facebook/react', {
      branch: 'main',
      excludePatterns: [
        '.git', 'node_modules', '*.test.js', 
        'docs/*', 'scripts/*', '*.md'
      ],
      targetPath: 'external/react-source'
    });

    console.log('🎉 All GitHub import examples completed!');

  } catch (error) {
    console.error('❌ GitHub import examples failed:', error);
  }
}

// Example usage
async function example() {
  const client = new DaytonaWorkspaceClient('https://your-workspace-id.daytona.app');

  try {
    // Check workspace health
    await client.checkHealth();

    // List files
    await client.listFiles('app/components');

    // Read a file
    const content = await client.readFile('app/page.tsx');
    console.log('📄 File content preview:', content.substring(0, 200) + '...');

    // HOT SWAP: Update the main page
    const updatedPageContent = content.replace(
      'Get started by editing',
      'This page was HOT SWAPPED via API! Get started by editing'
    );
    
    await client.writeFile('app/page.tsx', updatedPageContent);

    console.log('🔥 HOT SWAP COMPLETE! Check your browser - the page should update automatically!');

    // 🚀 NEW: GitHub Repository Import
    console.log('📦 Testing GitHub import...');
    
    // Preview repository
    await client.previewGitHubRepo('https://github.com/vercel/next.js-examples');
    
    // Import a specific example
    await client.importGitHubRepo('https://github.com/vercel/next.js-examples', {
      branch: 'main',
      includePatterns: ['with-tailwindcss/*'],
      targetPath: 'examples/tailwind-example',
      overwrite: true
    });

    console.log('✅ GitHub import complete! New files hot swapped into workspace.');

    // Run hot swap examples
    // await hotSwapExamples();

    // Run GitHub import examples
    // await gitHubImportExamples();

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Run example if this script is executed directly
if (require.main === module) {
  example();
}

module.exports = DaytonaWorkspaceClient; 