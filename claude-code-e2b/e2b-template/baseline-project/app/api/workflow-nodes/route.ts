import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
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
    
    const searchParams = request.nextUrl.searchParams
    const workflowId = searchParams.get('workflow_id')
    
    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch workflow nodes' }, { status: 500 })
    }
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

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
    const { workflow_id, type, title, description, x, y } = body
    
    if (!workflow_id || !type || !title) {
      return NextResponse.json({ error: 'Workflow ID, type, and title are required' }, { status: 400 })
    }
    
    const { data, error } = await supabase
      .from('workflow_nodes')
      .insert({
        workspace_id: workspaceId,
        workflow_id,
        type,
        title,
        description,
        x: x || 100,
        y: y || 100
      })
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create workflow node' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}