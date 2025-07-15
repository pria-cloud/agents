import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

// GET /api/workspace/files?path=<path> - Read file content
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const fullPath = join(process.cwd(), filePath);
    
    // Security check - ensure path is within project directory
    if (!fullPath.startsWith(process.cwd())) {
      return NextResponse.json(
        { error: 'Access denied - path outside project directory' },
        { status: 403 }
      );
    }

    const content = await readFile(fullPath, 'utf-8');
    const stats = await stat(fullPath);
    
    return NextResponse.json({
      path: filePath,
      content: content,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      success: true
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to read file: ${error.message}`, success: false },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

// POST /api/workspace/files - List files in directory
export async function POST(request: NextRequest) {
  try {
    const { path: requestPath = '.' } = await request.json();
    const fullPath = join(process.cwd(), requestPath);
    
    // Security check
    if (!fullPath.startsWith(process.cwd())) {
      return NextResponse.json(
        { error: 'Access denied - path outside project directory' },
        { status: 403 }
      );
    }
    
    const entries = await readdir(fullPath);
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(fullPath, entry);
        const stats = await stat(entryPath);
        return {
          name: entry,
          path: join(requestPath, entry).replace(/\\/g, '/'),
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
    );

    return NextResponse.json({ 
      path: requestPath,
      files,
      success: true
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to list files: ${error.message}`, success: false },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

// PUT /api/workspace/files - Create or update file (HOT SWAP)
export async function PUT(request: NextRequest) {
  try {
    const { path: filePath, content, createDirectories = true } = await request.json();
    
    if (!filePath || content === undefined) {
      return NextResponse.json(
        { error: 'Path and content are required' },
        { status: 400 }
      );
    }

    const fullPath = join(process.cwd(), filePath);
    
    // Security check
    if (!fullPath.startsWith(process.cwd())) {
      return NextResponse.json(
        { error: 'Access denied - path outside project directory' },
        { status: 403 }
      );
    }

    // Create directories if needed
    if (createDirectories) {
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    // Write the file
    await writeFile(fullPath, content, 'utf-8');
    const stats = await stat(fullPath);
    
    console.log(`🔄 Hot swapped file: ${filePath}`);
    
    return NextResponse.json({
      path: filePath,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      message: 'File updated successfully - hot reload should trigger',
      success: true
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to write file: ${error.message}`, success: false },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

// DELETE /api/workspace/files - Delete file
export async function DELETE(request: NextRequest) {
  try {
    const { path: filePath } = await request.json();
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    const fullPath = join(process.cwd(), filePath);
    
    // Security check
    if (!fullPath.startsWith(process.cwd())) {
      return NextResponse.json(
        { error: 'Access denied - path outside project directory' },
        { status: 403 }
      );
    }

    await unlink(fullPath);
    
    console.log(`🗑️ Deleted file: ${filePath}`);
    
    return NextResponse.json({
      path: filePath,
      message: 'File deleted successfully',
      success: true
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to delete file: ${error.message}`, success: false },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
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