import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { getWorkspaceIdFromSession, validateUserWorkspaceAccess } from '@/lib/auth/workspace-helper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get workspace ID from session and validate access
    const workspaceId = await getWorkspaceIdFromSession(sessionId)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const hasAccess = await validateUserWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Use service role to access app_builder schema
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get technical specifications for the session
    const { data: technicalSpecs, error } = await serviceSupabase
      .from('technical_specs')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[TECH SPECS API] Database error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ 
      technicalSpecs: technicalSpecs || [],
      sessionId: sessionId
    })

  } catch (error) {
    console.error('[TECH SPECS API] Failed to get technical specifications:', error)
    return NextResponse.json({ error: 'Failed to get technical specifications' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get workspace ID from session and validate access
    const workspaceId = await getWorkspaceIdFromSession(sessionId)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const hasAccess = await validateUserWorkspaceAccess(user.id, workspaceId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, description, content, priority = 'medium' } = body

    // Validate required fields
    if (!type || !title || !description) {
      return NextResponse.json({ 
        error: 'Missing required fields: type, title, description' 
      }, { status: 400 })
    }

    // Use service role to access app_builder schema
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Create new technical specification
    const { data: techSpec, error } = await serviceSupabase
      .from('technical_specs')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        type,
        title: title.trim(),
        description: description.trim(),
        content: content || {},
        status: 'draft',
        version: 1,
        priority,
        metadata: {
          created_by: 'manual',
          workflow_phase: 2,
          extraction_confidence: 1.0,
          pria_compliance: true
        }
      })
      .select()
      .single()

    if (error) {
      console.error('[TECH SPECS API] Failed to create specification:', error)
      return NextResponse.json({ error: 'Failed to create specification' }, { status: 500 })
    }

    return NextResponse.json({ 
      techSpec,
      success: true
    })

  } catch (error) {
    console.error('[TECH SPECS API] Failed to create technical specification:', error)
    return NextResponse.json({ error: 'Failed to create technical specification' }, { status: 500 })
  }
}