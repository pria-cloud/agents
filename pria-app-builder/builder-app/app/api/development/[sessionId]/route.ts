import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { IterativeDevelopmentManager } from '@/lib/development/iterative-development-manager'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'progress'

    const devManager = new IterativeDevelopmentManager(params.sessionId, workspaceId)

    switch (action) {
      case 'progress':
        const progress = await devManager.getDevelopmentProgress()
        return NextResponse.json(progress)

      case 'session':
        const session = await devManager.getDevelopmentSession()
        if (!session) {
          // Initialize if doesn't exist
          const newSession = await devManager.initializeDevelopmentSession()
          return NextResponse.json(newSession)
        }
        return NextResponse.json(session)

      case 'compliance':
        // Get latest compliance report
        const { data: complianceData } = await supabase
          .from('compliance_reports')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return NextResponse.json(complianceData || { message: 'No compliance reports yet' })

      case 'files':
        // Get generated files
        const { data: files } = await supabase
          .from('generated_files')
          .select('*')
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('updated_at', { ascending: false })

        return NextResponse.json({ files: files || [] })

      case 'iterations':
        // Get development iterations
        const { data: iterations } = await supabase
          .from('development_iterations')
          .select(`
            *,
            development_tasks!task_id (title, type, priority)
          `)
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        return NextResponse.json({ iterations: iterations || [] })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEVELOPMENT API] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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
    const { action, ...data } = body

    const devManager = new IterativeDevelopmentManager(params.sessionId, workspaceId)

    switch (action) {
      case 'initialize':
        const session = await devManager.initializeDevelopmentSession()
        return NextResponse.json({ 
          session,
          success: true,
          message: 'Development session initialized'
        })

      case 'start_iteration':
        const { taskId, description, userRequirements } = data
        
        if (!taskId || !description) {
          return NextResponse.json({ 
            error: 'Missing required fields: taskId, description' 
          }, { status: 400 })
        }

        const iteration = await devManager.startDevelopmentIteration(
          taskId, 
          description, 
          userRequirements || ''
        )

        return NextResponse.json({
          iteration,
          success: true,
          message: `Started iteration ${iteration.iteration_number}`
        })

      case 'process_code':
        const { iterationId, generatedFiles } = data
        
        if (!iterationId || !generatedFiles) {
          return NextResponse.json({ 
            error: 'Missing required fields: iterationId, generatedFiles' 
          }, { status: 400 })
        }

        const processResult = await devManager.processCodeGeneration(
          iterationId, 
          generatedFiles
        )

        return NextResponse.json({
          ...processResult,
          success: true,
          message: `Processed ${processResult.files_processed} files`
        })

      case 'complete_iteration':
        const { iterationId: completeIterationId, finalFiles, userFeedback } = data
        
        if (!completeIterationId || !finalFiles) {
          return NextResponse.json({ 
            error: 'Missing required fields: iterationId, finalFiles' 
          }, { status: 400 })
        }

        const completeResult = await devManager.completeIteration(
          completeIterationId,
          finalFiles,
          userFeedback
        )

        return NextResponse.json({
          ...completeResult,
          success: true,
          message: completeResult.success 
            ? 'Iteration completed successfully' 
            : 'Iteration completed with issues'
        })

      case 'save_files':
        const { taskId: saveTaskId, files } = data
        
        if (!saveTaskId || !files) {
          return NextResponse.json({ 
            error: 'Missing required fields: taskId, files' 
          }, { status: 400 })
        }

        // Save files to database
        const fileRecords = files.map(file => ({
          workspace_id: workspaceId,
          session_id: params.sessionId,
          task_id: saveTaskId,
          file_path: file.path,
          file_content: file.content,
          file_type: file.type || 'component',
          compliance_issues: file.compliance_issues || 0,
          created_at: file.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        const { data: savedFiles, error: saveError } = await supabase
          .from('generated_files')
          .upsert(fileRecords)
          .select()

        if (saveError) {
          console.error('[DEVELOPMENT API] Failed to save files:', saveError)
          return NextResponse.json({ error: 'Failed to save files' }, { status: 500 })
        }

        return NextResponse.json({
          files: savedFiles,
          success: true,
          message: `Saved ${files.length} files`
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEVELOPMENT API] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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
    const { action, ...updateData } = body

    switch (action) {
      case 'update_session':
        const { data: updatedSession, error: sessionError } = await supabase
          .from('development_sessions')
          .update({
            ...updateData,
            updated_at: new Date().toISOString()
          })
          .eq('session_id', params.sessionId)
          .eq('workspace_id', workspaceId)
          .select()
          .single()

        if (sessionError) {
          console.error('[DEVELOPMENT API] Failed to update session:', sessionError)
          return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
        }

        return NextResponse.json({
          session: updatedSession,
          success: true,
          message: 'Development session updated'
        })

      case 'update_file':
        const { fileId, fileContent, complianceIssues } = updateData
        
        if (!fileId) {
          return NextResponse.json({ error: 'File ID required' }, { status: 400 })
        }

        const { data: updatedFile, error: fileError } = await supabase
          .from('generated_files')
          .update({
            file_content: fileContent,
            compliance_issues: complianceIssues,
            updated_at: new Date().toISOString()
          })
          .eq('id', fileId)
          .eq('workspace_id', workspaceId)
          .select()
          .single()

        if (fileError) {
          console.error('[DEVELOPMENT API] Failed to update file:', fileError)
          return NextResponse.json({ error: 'Failed to update file' }, { status: 500 })
        }

        return NextResponse.json({
          file: updatedFile,
          success: true,
          message: 'File updated successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEVELOPMENT API] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const targetId = searchParams.get('id')

    switch (action) {
      case 'file':
        if (!targetId) {
          return NextResponse.json({ error: 'File ID required' }, { status: 400 })
        }

        const { error: fileError } = await supabase
          .from('generated_files')
          .delete()
          .eq('id', targetId)
          .eq('workspace_id', workspaceId)

        if (fileError) {
          console.error('[DEVELOPMENT API] Failed to delete file:', fileError)
          return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'File deleted successfully'
        })

      case 'iteration':
        if (!targetId) {
          return NextResponse.json({ error: 'Iteration ID required' }, { status: 400 })
        }

        const { error: iterationError } = await supabase
          .from('development_iterations')
          .delete()
          .eq('id', targetId)
          .eq('workspace_id', workspaceId)

        if (iterationError) {
          console.error('[DEVELOPMENT API] Failed to delete iteration:', iterationError)
          return NextResponse.json({ error: 'Failed to delete iteration' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          message: 'Iteration deleted successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('[DEVELOPMENT API] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}