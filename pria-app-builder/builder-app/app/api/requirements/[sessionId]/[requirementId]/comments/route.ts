import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; requirementId: string }> }
) {
  try {
    const { sessionId, requirementId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Use service role to ensure we can read comments
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    const { data: comments, error } = await serviceSupabase
      .from('requirement_comments')
      .select('*')
      .eq('requirement_id', requirementId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[REQUIREMENTS COMMENTS API] Failed to fetch comments:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    // Organize comments into threads
    const commentMap = new Map()
    const rootComments: any[] = []

    // First pass: create comment map
    comments?.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // Second pass: organize into threads
    comments?.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id)
        if (parent) {
          parent.replies.push(commentMap.get(comment.id))
        }
      } else {
        rootComments.push(commentMap.get(comment.id))
      }
    })

    return NextResponse.json({ comments: rootComments })
  } catch (error) {
    console.error('[REQUIREMENTS COMMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; requirementId: string }> }
) {
  try {
    const { sessionId, requirementId } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      comment_text,
      comment_type = 'general',
      author_type = 'user',
      author_name,
      parent_comment_id,
      metadata = {}
    } = body

    if (!comment_text || comment_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      )
    }

    // Use service role to ensure we can create comments
    const { createServiceClient } = await import('@/lib/supabase/service')
    const serviceSupabase = createServiceClient()

    // Get workspace_id from the requirement
    const { data: requirement } = await serviceSupabase
      .from('requirements')
      .select('workspace_id')
      .eq('id', requirementId)
      .eq('session_id', sessionId)
      .single()

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
    }

    // Calculate thread depth if this is a reply
    let thread_depth = 0
    if (parent_comment_id) {
      const { data: parentComment } = await serviceSupabase
        .from('requirement_comments')
        .select('thread_depth')
        .eq('id', parent_comment_id)
        .single()
      
      if (parentComment) {
        thread_depth = parentComment.thread_depth + 1
      }
    }

    // Create comment
    const { data: comment, error } = await serviceSupabase
      .from('requirement_comments')
      .insert({
        requirement_id: requirementId,
        workspace_id: requirement.workspace_id,
        comment_text: comment_text.trim(),
        comment_type,
        author_type,
        author_user_id: author_type === 'user' ? user.id : null,
        author_name: author_name || (author_type === 'user' ? user.email : 'Claude Assistant'),
        parent_comment_id,
        thread_depth,
        metadata
      })
      .select()
      .single()

    if (error) {
      console.error('[REQUIREMENTS COMMENTS API] Failed to create comment:', error)
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('[REQUIREMENTS COMMENTS API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}