import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { SecurityAuditor } from '@/lib/validation/security-auditor'
import { CodeReviewer } from '@/lib/validation/code-reviewer'
import { DeploymentReadinessChecker } from '@/lib/validation/deployment-readiness'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
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
    
    // Get validation reports for this session
    const { data: securityReports, error: securityError } = await supabase
      .from('security_audit_reports')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    
    const { data: codeReports, error: codeError } = await supabase
      .from('code_review_reports')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    
    const { data: deploymentReports, error: deploymentError } = await supabase
      .from('deployment_readiness_reports')
      .select('*')
      .eq('session_id', sessionId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    
    if (securityError || codeError || deploymentError) {
      console.error('Database error:', { securityError, codeError, deploymentError })
      return NextResponse.json({ error: 'Failed to fetch validation reports' }, { status: 500 })
    }
    
    // Combine and format reports
    const allReports: any[] = []
    
    // Add security reports
    securityReports?.forEach(report => {
      allReports.push({
        id: report.id,
        session_id: report.session_id,
        type: 'security_audit',
        status: report.status,
        start_time: report.start_time,
        end_time: report.end_time,
        duration_ms: report.duration_ms,
        overall_score: report.compliance_status?.compliance_score || 0,
        ready_for_deployment: report.deployment_readiness?.ready_for_deployment || false,
        summary: {
          total_issues: report.summary?.total_issues || 0,
          critical_issues: report.summary?.critical_issues || 0,
          high_issues: report.summary?.high_issues || 0,
          medium_issues: report.summary?.medium_issues || 0,
          low_issues: report.summary?.low_issues || 0,
          blocking_issues: report.deployment_readiness?.blocking_issues?.length || 0
        },
        issues: report.issues || [],
        recommendations: report.recommendations || {
          immediate_actions: [],
          before_next_deployment: [],
          long_term_improvements: [],
          monitoring_setup: []
        },
        deployment_checklist: null,
        created_at: report.created_at,
        updated_at: report.updated_at
      })
    })
    
    // Add code review reports
    codeReports?.forEach(report => {
      allReports.push({
        id: report.id,
        session_id: report.session_id,
        type: 'code_review',
        status: report.status,
        start_time: report.start_time,
        end_time: report.end_time,
        duration_ms: report.duration_ms,
        overall_score: report.metrics?.maintainability_index || 0,
        ready_for_deployment: (report.summary?.blocker_issues || 0) === 0,
        summary: {
          total_issues: report.summary?.total_issues || 0,
          critical_issues: report.summary?.critical_issues || 0,
          high_issues: report.summary?.high_issues || 0,
          medium_issues: report.summary?.medium_issues || 0,
          low_issues: report.summary?.low_issues || 0,
          blocking_issues: report.summary?.blocker_issues || 0
        },
        issues: report.issues || [],
        recommendations: report.recommendations || {
          immediate_actions: [],
          before_next_deployment: [],
          long_term_improvements: [],
          monitoring_setup: []
        },
        deployment_checklist: null,
        created_at: report.created_at,
        updated_at: report.updated_at
      })
    })
    
    // Add deployment readiness reports
    deploymentReports?.forEach(report => {
      allReports.push({
        id: report.id,
        session_id: report.session_id,
        type: 'deployment_readiness',
        status: report.status,
        start_time: report.start_time,
        end_time: report.end_time,
        duration_ms: report.duration_ms,
        overall_score: report.overall_readiness?.readiness_score || 0,
        ready_for_deployment: report.overall_readiness?.ready_for_deployment || false,
        summary: {
          total_issues: report.checks?.length || 0,
          critical_issues: report.checks?.filter((c: any) => c.severity === 'critical' && c.status === 'fail').length || 0,
          high_issues: report.checks?.filter((c: any) => c.severity === 'high' && c.status === 'fail').length || 0,
          medium_issues: report.checks?.filter((c: any) => c.severity === 'medium' && c.status === 'fail').length || 0,
          low_issues: report.checks?.filter((c: any) => c.severity === 'low' && c.status === 'fail').length || 0,
          blocking_issues: report.checks?.filter((c: any) => c.blocking && c.status === 'fail').length || 0
        },
        issues: report.checks?.filter((c: any) => c.status === 'fail').map((check: any) => ({
          id: check.id,
          type: 'misconfiguration',
          severity: check.severity,
          category: check.category,
          title: check.name,
          description: check.description,
          impact: check.details,
          remediation: {
            recommendation: check.recommendations[0] || 'No recommendation provided',
            priority: check.severity === 'critical' ? 'immediate' : 'normal',
            effort_level: check.estimated_fix_time === '30 minutes' ? 'easy' : 'moderate'
          },
          references: check.reference_links || [],
          blocking: check.blocking
        })) || [],
        recommendations: report.recommendations || {
          immediate_actions: [],
          before_next_deployment: [],
          long_term_improvements: [],
          monitoring_setup: []
        },
        deployment_checklist: report.deployment_checklist,
        created_at: report.created_at,
        updated_at: report.updated_at
      })
    })
    
    // Sort by creation date (most recent first)
    allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    return NextResponse.json({
      success: true,
      reports: allReports
    })
    
  } catch (error) {
    console.error('Error fetching validation reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch validation reports' },
      { status: 500 }
    )
  }
}