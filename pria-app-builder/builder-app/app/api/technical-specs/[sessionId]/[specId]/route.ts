import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string; specId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Get specific technical specification
    const { data: techSpec, error } = await supabase
      .from('technical_specs')
      .select('*')
      .eq('id', params.specId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      console.error('[TECH SPEC API] Database error:', error)
      return NextResponse.json({ error: 'Technical specification not found' }, { status: 404 })
    }

    return NextResponse.json({ techSpec })

  } catch (error) {
    console.error('[TECH SPEC API] Failed to get technical specification:', error)
    return NextResponse.json({ error: 'Failed to get technical specification' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string; specId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, content, status, priority } = body

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (content !== undefined) updateData.content = content
    if (status !== undefined) updateData.status = status
    if (priority !== undefined) updateData.priority = priority

    // Update technical specification
    const { data: techSpec, error } = await supabase
      .from('technical_specs')
      .update(updateData)
      .eq('id', params.specId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('[TECH SPEC API] Failed to update specification:', error)
      return NextResponse.json({ error: 'Failed to update specification' }, { status: 500 })
    }

    return NextResponse.json({ 
      techSpec,
      success: true
    })

  } catch (error) {
    console.error('[TECH SPEC API] Failed to update technical specification:', error)
    return NextResponse.json({ error: 'Failed to update technical specification' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string; specId: string } }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Delete technical specification
    const { error } = await supabase
      .from('technical_specs')
      .delete()
      .eq('id', params.specId)
      .eq('session_id', params.sessionId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('[TECH SPEC API] Failed to delete specification:', error)
      return NextResponse.json({ error: 'Failed to delete specification' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Technical specification deleted successfully'
    })

  } catch (error) {
    console.error('[TECH SPEC API] Failed to delete technical specification:', error)
    return NextResponse.json({ error: 'Failed to delete technical specification' }, { status: 500 })
  }
}