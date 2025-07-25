import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { x, y, title, description } = body
    
    const updateData: any = {}
    if (x !== undefined) updateData.x = x
    if (y !== undefined) updateData.y = y
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    
    const { data, error } = await supabase
      .from('workflow_nodes')
      .update(updateData)
      .eq('id', params.id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update workflow node' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // First delete any connections to/from this node
    await supabase
      .from('workflow_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .or(`from_node.eq.${params.id},to_node.eq.${params.id}`)
    
    // Then delete the node
    const { error } = await supabase
      .from('workflow_nodes')
      .delete()
      .eq('id', params.id)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete workflow node' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}