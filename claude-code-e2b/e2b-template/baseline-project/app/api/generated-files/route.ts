import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')
    
    let query = supabase
      .from('generated_files')
      .select('*')
      .eq('workspace_id', workspaceId)
    
    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }
    
    const { data, error } = await query.order('file_path', { ascending: true })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // cookieStore is now handled internally by createServerClient
    const supabase = await createServerClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 403 })
    }
    
    const body = await request.json()
    const { session_id, file_path, content, file_type, generated_by } = body
    
    if (!session_id || !file_path || content === undefined) {
      return NextResponse.json({ error: 'Session ID, file path, and content are required' }, { status: 400 })
    }
    
    // Generate checksum for content
    const checksum = crypto.createHash('md5').update(content).digest('hex')
    
    // Check if file already exists
    const { data: existingFile } = await supabase
      .from('generated_files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('session_id', session_id)
      .eq('file_path', file_path)
      .single()
    
    if (existingFile) {
      // Update existing file
      const { data, error } = await supabase
        .from('generated_files')
        .update({
          content,
          checksum,
          file_type: file_type || 'text',
          generated_by: generated_by || 'user',
          version: existingFile.version + 1
        })
        .eq('id', existingFile.id)
        .select()
        .single()
      
      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
      }
      
      return NextResponse.json(data)
    } else {
      // Create new file
      const { data, error } = await supabase
        .from('generated_files')
        .insert({
          workspace_id: workspaceId,
          session_id,
          file_path,
          content,
          file_type: file_type || 'text',
          checksum,
          generated_by: generated_by || 'user',
          version: 1
        })
        .select()
        .single()
      
      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: 'Failed to create file' }, { status: 500 })
      }
      
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}