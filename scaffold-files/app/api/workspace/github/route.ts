import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, stat, rm } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { existsSync } from 'fs';

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

// POST /api/workspace/github - Import GitHub repository
export async function POST(request: NextRequest) {
  try {
    const { 
      repoUrl, 
      branch = 'main', 
      targetPath = '.', 
      overwrite = false,
      excludePatterns = ['.git', 'node_modules', '.env*', '*.log'],
      includePatterns = []
    } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    console.log(`📦 Starting GitHub import: ${repoInfo.owner}/${repoInfo.repo}@${branch}`);

    // Download repository from GitHub
    const files = await downloadGitHubRepo(repoInfo, branch);
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files found in repository or repository is empty' },
        { status: 404 }
      );
    }

    // Filter files based on patterns
    const filteredFiles = filterFiles(files, excludePatterns, includePatterns);
    
    console.log(`📁 Found ${filteredFiles.length} files to import`);

    // Hot swap all files
    const results = await hotSwapFiles(filteredFiles, targetPath, overwrite);

    const response = {
      success: true,
      repository: `${repoInfo.owner}/${repoInfo.repo}`,
      branch: branch,
      targetPath: targetPath,
      filesProcessed: results.success.length,
      filesSkipped: results.skipped.length,
      filesErrored: results.errors.length,
      files: {
        success: results.success,
        skipped: results.skipped,
        errors: results.errors
      },
      message: `Successfully imported ${results.success.length} files from GitHub repository`
    };

    console.log(`✅ GitHub import complete: ${results.success.length} files hot swapped`);

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error: any) {
    console.error('❌ GitHub import failed:', error);
    return NextResponse.json(
      { 
        error: `GitHub import failed: ${error.message}`,
        success: false 
      },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

// GET /api/workspace/github?url=<repo-url>&branch=<branch> - Preview repository contents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('url');
    const branch = searchParams.get('branch') || 'main';

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL' },
        { status: 400 }
      );
    }

    // Get repository info from GitHub API
    const repoData = await getGitHubRepoInfo(repoInfo, branch);
    
    return NextResponse.json({
      success: true,
      repository: repoData,
      previewNote: 'Use POST to actually import the repository'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to preview repository: ${error.message}`, success: false },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    // Handle various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/tree\/([^\/]+))?(?:\/(.+))?$/,
      /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
          branch: match[3],
          path: match[4]
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function getGitHubRepoInfo(repoInfo: GitHubRepoInfo, branch: string) {
  const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
  
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    defaultBranch: data.default_branch,
    language: data.language,
    size: data.size,
    stars: data.stargazers_count,
    forks: data.forks_count,
    updatedAt: data.updated_at,
    htmlUrl: data.html_url
  };
}

async function downloadGitHubRepo(repoInfo: GitHubRepoInfo, branch: string): Promise<Array<{path: string, content: string}>> {
  // Use GitHub API to get repository tree
  const treeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${branch}?recursive=1`;
  
  const treeResponse = await fetch(treeUrl);
  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status} ${treeResponse.statusText}`);
  }
  
  const treeData = await treeResponse.json();
  
  const files: Array<{path: string, content: string}> = [];
  
  // Download each file
  for (const item of treeData.tree) {
    if (item.type === 'blob') {
      try {
        const fileResponse = await fetch(item.url);
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          
          if (fileData.encoding === 'base64') {
            // Decode base64 content
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            files.push({
              path: item.path,
              content: content
            });
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to download file ${item.path}:`, error);
      }
    }
  }
  
  return files;
}

function filterFiles(
  files: Array<{path: string, content: string}>, 
  excludePatterns: string[], 
  includePatterns: string[]
): Array<{path: string, content: string}> {
  return files.filter(file => {
    const filePath = file.path;
    
    // Check exclude patterns
    for (const pattern of excludePatterns) {
      if (matchPattern(filePath, pattern)) {
        return false;
      }
    }
    
    // If include patterns are specified, file must match at least one
    if (includePatterns.length > 0) {
      return includePatterns.some(pattern => matchPattern(filePath, pattern));
    }
    
    return true;
  });
}

function matchPattern(filePath: string, pattern: string): boolean {
  // Simple pattern matching (could be enhanced with proper glob matching)
  if (pattern.includes('*')) {
    const regexPattern = pattern.replace(/\*/g, '.*');
    return new RegExp(regexPattern).test(filePath);
  }
  
  return filePath.includes(pattern);
}

async function hotSwapFiles(
  files: Array<{path: string, content: string}>, 
  targetPath: string, 
  overwrite: boolean
) {
  const results = {
    success: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{path: string, error: string}>
  };

  for (const file of files) {
    try {
      const fullPath = join(process.cwd(), targetPath, file.path);
      
      // Security check
      if (!fullPath.startsWith(process.cwd())) {
        results.errors.push({
          path: file.path,
          error: 'Access denied - path outside project directory'
        });
        continue;
      }

      // Check if file exists and overwrite policy
      if (existsSync(fullPath) && !overwrite) {
        results.skipped.push(file.path);
        continue;
      }

      // Create directory if needed
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Write file
      await writeFile(fullPath, file.content, 'utf-8');
      results.success.push(file.path);
      
      console.log(`🔄 Hot swapped: ${file.path}`);

    } catch (error: any) {
      results.errors.push({
        path: file.path,
        error: error.message
      });
      console.error(`❌ Failed to hot swap ${file.path}:`, error.message);
    }
  }

  return results;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 