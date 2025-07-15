import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

// GET /api/workspace - Get workspace information
export async function GET(request: NextRequest) {
  try {
    const workspaceInfo = {
      path: process.cwd(),
      environment: 'daytona',
      status: 'active',
      features: {
        hotReload: true,
        apiAccess: true,
        fileWatching: true
      }
    };

    return NextResponse.json(workspaceInfo, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get workspace info' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}

// POST /api/workspace/files - List files in workspace
export async function POST(request: NextRequest) {
  try {
    const { path: requestPath = '.' } = await request.json();
    const fullPath = join(process.cwd(), requestPath);
    
    const entries = await readdir(fullPath);
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(fullPath, entry);
        const stats = await stat(entryPath);
        return {
          name: entry,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
    );

    return NextResponse.json({ files }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to list files' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
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