import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { e2bSandboxService } from '@/lib/services/e2b'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { operation, session_id } = body
    
    if (!session_id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }
    
    // Verify session belongs to user's workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    switch (operation) {
      case 'execute_command':
        return await handleExecuteCommand(request, session_id, session, supabase)
      
      case 'file_operation':
        return await handleFileOperation(request, session_id, session, supabase)
      
      case 'install_packages':
        return await handleInstallPackages(request, session_id, session, supabase)
      
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('E2B execute error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

async function handleExecuteCommand(
  request: NextRequest,
  sessionId: string,
  session: any,
  supabase: any
) {
  try {
    const body = await request.json()
    const { command, working_dir, timeout } = body
    
    if (!command) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 })
    }
    
    // Execute command in sandbox
    const result = await e2bSandboxService.executeCommand(sessionId, command, {
      workingDir: working_dir,
      timeout
    })
    
    // Log the execution
    await supabase
      .from('execution_results')
      .insert({
        session_id: sessionId,
        workspace_id: session.workspace_id,
        command,
        working_directory: working_dir,
        exit_code: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        execution_time: result.duration,
        status: result.exitCode === 0 ? 'success' : 'error'
      })
    
    return NextResponse.json({
      success: result.exitCode === 0,
      result
    })
    
  } catch (error) {
    console.error('Execute command error:', error)
    return NextResponse.json({ 
      error: 'Failed to execute command',
      details: error.message 
    }, { status: 500 })
  }
}

async function handleFileOperation(
  request: NextRequest,
  sessionId: string,
  session: any,
  supabase: any
) {
  try {
    const body = await request.json()
    const { type, path, content, recursive } = body
    
    if (!type || !path) {
      return NextResponse.json({ 
        error: 'Operation type and path are required' 
      }, { status: 400 })
    }
    
    // Execute file operation
    const result = await e2bSandboxService.executeFileOperation(sessionId, {
      type,
      path,
      content,
      recursive
    })
    
    // For read operations, save content to generated_files if successful
    if (type === 'read' && result.success && result.content) {
      try {
        // Check if file already exists in generated_files
        const { data: existingFile } = await supabase
          .from('generated_files')
          .select('id')
          .eq('session_id', sessionId)
          .eq('workspace_id', session.workspace_id)
          .eq('file_path', path)
          .single()
        
        const fileData = {
          session_id: sessionId,
          workspace_id: session.workspace_id,
          file_path: path,
          content: result.content,
          file_type: getFileType(path),
          generated_by: 'e2b_read',
          checksum: generateChecksum(result.content),
          version: 1
        }
        
        if (existingFile) {
          // Update existing file
          await supabase
            .from('generated_files')
            .update({
              ...fileData,
              version: existingFile.version + 1
            })
            .eq('id', existingFile.id)
        } else {
          // Insert new file
          await supabase
            .from('generated_files')
            .insert(fileData)
        }
      } catch (error) {
        console.warn('Failed to save file to database:', error.message)
        // Continue - this is not critical
      }
    }
    
    // For write operations, update generated_files
    if ((type === 'create' || type === 'update') && result.success) {
      try {
        const fileData = {
          session_id: sessionId,
          workspace_id: session.workspace_id,
          file_path: path,
          content: content || '',
          file_type: getFileType(path),
          generated_by: 'e2b_write',
          checksum: generateChecksum(content || ''),
          version: 1
        }
        
        await supabase
          .from('generated_files')
          .upsert(fileData, {
            onConflict: 'session_id,workspace_id,file_path'
          })
      } catch (error) {
        console.warn('Failed to update generated_files:', error.message)
      }
    }
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('File operation error:', error)
    return NextResponse.json({ 
      error: 'Failed to execute file operation',
      details: error.message 
    }, { status: 500 })
  }
}

async function handleInstallPackages(
  request: NextRequest,
  sessionId: string,
  session: any,
  supabase: any
) {
  try {
    const body = await request.json()
    const { packages, is_dev, working_dir } = body
    
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json({ 
        error: 'Packages array is required' 
      }, { status: 400 })
    }
    
    // Install packages
    const result = await e2bSandboxService.installPackages(sessionId, packages, {
      isDev: is_dev,
      workingDir: working_dir
    })
    
    // Log the installation
    await supabase
      .from('execution_results')
      .insert({
        session_id: sessionId,
        workspace_id: session.workspace_id,
        command: `npm install ${is_dev ? '--save-dev' : ''} ${packages.join(' ')}`,
        working_directory: working_dir,
        exit_code: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        execution_time: result.duration,
        status: result.exitCode === 0 ? 'success' : 'error'
      })
    
    return NextResponse.json({
      success: result.exitCode === 0,
      packages_installed: packages,
      result
    })
    
  } catch (error) {
    console.error('Install packages error:', error)
    return NextResponse.json({ 
      error: 'Failed to install packages',
      details: error.message 
    }, { status: 500 })
  }
}

// Helper functions

function getFileType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const typeMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'py': 'python',
    'sql': 'sql'
  }
  return typeMap[ext] || 'text'
}

function generateChecksum(content: string): string {
  // Simple hash function for content verification
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16)
}