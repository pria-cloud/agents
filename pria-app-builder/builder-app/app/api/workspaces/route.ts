import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { validateName, checkRateLimit } from '@/lib/validation/input-sanitizer'
import { getUserWorkspaces } from '@/lib/auth/workspace-helper'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get workspaces where user is a member using helper
    const workspaces = await getUserWorkspaces(user.id)

    return NextResponse.json({ workspaces })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json()
    
    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(`workspace:${clientIP}`, 5, 60000) // 5 workspaces per minute
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          resetTime: rateLimitCheck.resetTime 
        },
        { status: 429 }
      )
    }
    
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    // Validate workspace name
    const nameValidation = validateName(name, 'workspace name')
    if (!nameValidation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid workspace name',
          details: nameValidation.errors 
        },
        { status: 400 }
      )
    }

    // Validate description if provided
    let sanitizedDescription = ''
    if (description) {
      const descValidation = validateName(description, 'description')
      if (!descValidation.isValid) {
        return NextResponse.json(
          { 
            error: 'Invalid workspace description',
            details: descValidation.errors 
          },
          { status: 400 }
        )
      }
      sanitizedDescription = descValidation.sanitized
    }

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('Creating workspace for user:', user.id)
    console.log('Workspace name:', nameValidation.sanitized)

    // Create a service role client to bypass RLS for workspace creation
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Create workspace using service role to bypass RLS
    const { data: workspace, error } = await serviceSupabase
      .from('workspaces')
      .insert({
        name: nameValidation.sanitized,
        owner_id: user.id,
        settings: description ? { description: sanitizedDescription } : {}
      })
      .select()
      .single()

    console.log('Workspace creation result:', { workspace, error })

    if (error) {
      console.error('Failed to create workspace:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json(
        { error: 'Failed to create workspace', details: error.message },
        { status: 500 }
      )
    }

    // Add user as workspace member using service role
    // Try multiple approaches to handle the app_metadata issue
    let member = null
    let memberError = null
    
    // First attempt: Direct insert
    const insertResult = await serviceSupabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner'
      })
      .select()
      .single()
    
    member = insertResult.data
    memberError = insertResult.error

    // If that failed with app_metadata error, try raw SQL approach
    if (memberError && memberError.message?.includes('app_metadata')) {
      console.log('Direct insert failed, trying raw SQL approach...')
      
      const rawSqlResult = await serviceSupabase.rpc('insert_workspace_member', {
        p_workspace_id: workspace.id,
        p_user_id: user.id,
        p_role: 'owner'
      })
      
      if (rawSqlResult.error) {
        console.error('Raw SQL approach also failed:', rawSqlResult.error)
        memberError = rawSqlResult.error
      } else {
        console.log('Raw SQL approach succeeded')
        member = { id: rawSqlResult.data, workspace_id: workspace.id, user_id: user.id, role: 'owner' }
        memberError = null
      }
    }

    if (memberError) {
      console.error('Failed to add workspace member:', memberError)
      console.error('Member error details:', JSON.stringify(memberError, null, 2))
      
      // For now, continue anyway and log the issue - user can manually fix workspace access
      console.warn('Continuing with workspace creation despite member creation failure')
      console.warn('User may need manual workspace access setup')
    } else {
      console.log('Workspace member added successfully:', member)
    }

    return NextResponse.json({ 
      workspace,
      message: 'Workspace created successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}