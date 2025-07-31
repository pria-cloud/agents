import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { ArtifactReferenceSystem } from '@/lib/workflow/artifact-reference-system'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    const supabase = await createServerClient()
    
    // Get user and workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }
    
    // Verify session belongs to workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    switch (action) {
      case 'statistics':
        const stats = await ArtifactReferenceSystem.getArtifactStatistics(sessionId, workspaceId)
        return NextResponse.json({ success: true, statistics: stats })
        
      case 'list':
        // Get all artifacts for the session
        const { data: artifacts, error: artifactsError } = await supabase
          .from('subagent_artifacts')
          .select('*')
          .eq('session_id', sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
        
        if (artifactsError) {
          return NextResponse.json({ error: 'Failed to fetch artifacts' }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          artifacts: artifacts?.map(artifact => ({
            id: artifact.id,
            reference_key: artifact.reference_key,
            source_agent: artifact.source_agent,
            artifact_type: artifact.artifact_type,
            metadata: artifact.metadata,
            created_at: artifact.created_at,
            updated_at: artifact.updated_at
          })) || []
        })
        
      default:
        // Default: return summary information
        const summary = await this.getArtifactSummary(supabase, sessionId, workspaceId)
        return NextResponse.json({ success: true, ...summary })
    }
    
  } catch (error) {
    console.error('Error fetching artifacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch artifacts' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const body = await request.json()
    const { action, references, query } = body
    
    const supabase = await createServerClient()
    
    // Get user and workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 })
    }
    
    // Verify session belongs to workspace
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    switch (action) {
      case 'resolve':
        // Resolve artifact references
        if (!references || !Array.isArray(references)) {
          return NextResponse.json({ error: 'References array required' }, { status: 400 })
        }
        
        const artifactContext = await ArtifactReferenceSystem.resolveArtifactReferences(
          sessionId,
          workspaceId,
          references
        )
        
        return NextResponse.json({
          success: true,
          context: artifactContext,
          formatted_prompt: ArtifactReferenceSystem.formatArtifactsForPrompt(artifactContext)
        })
        
      case 'parse':
        // Parse artifact references from text
        if (!query || typeof query !== 'string') {
          return NextResponse.json({ error: 'Query string required' }, { status: 400 })
        }
        
        const parsedReferences = ArtifactReferenceSystem.parseArtifactReferences(query)
        
        return NextResponse.json({
          success: true,
          references: parsedReferences,
          count: parsedReferences.length
        })
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Error processing artifacts:', error)
    return NextResponse.json(
      { error: 'Failed to process artifacts' },
      { status: 500 }
    )
  }
}

// Helper function to get artifact summary
async function getArtifactSummary(supabase: any, sessionId: string, workspaceId: string) {
  try {
    const { data: artifacts, error } = await supabase
      .from('subagent_artifacts')
      .select('source_agent, artifact_type, metadata, created_at')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
    
    if (error) {
      throw error
    }
    
    const stats = {
      total_count: artifacts?.length || 0,
      agents: [...new Set(artifacts?.map(a => a.source_agent) || [])],
      types: [...new Set(artifacts?.map(a => a.artifact_type) || [])],
      phases: [...new Set(artifacts?.map(a => a.metadata?.phase).filter(p => p) || [])],
      recent_activity: artifacts?.filter(a => {
        const daysSince = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24)
        return daysSince <= 7
      }).length || 0
    }
    
    return {
      summary: stats,
      sample_artifacts: artifacts?.slice(0, 5).map(a => ({
        agent: a.source_agent,
        type: a.artifact_type,
        phase: a.metadata?.phase,
        created_at: a.created_at
      })) || []
    }
    
  } catch (error) {
    console.error('Error generating artifact summary:', error)
    return {
      summary: {
        total_count: 0,
        agents: [],
        types: [],
        phases: [],
        recent_activity: 0
      },
      sample_artifacts: []
    }
  }
}