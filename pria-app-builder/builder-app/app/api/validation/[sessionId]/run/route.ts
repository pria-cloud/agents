import { NextRequest, NextResponse } from 'next/server'
import createServerClient from '@/lib/supabase/server'
import { SecurityAuditor } from '@/lib/validation/security-auditor'
import { CodeReviewer } from '@/lib/validation/code-reviewer'
import { DeploymentReadinessChecker } from '@/lib/validation/deployment-readiness'

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const body = await request.json()
    const { validation_type, config } = body
    
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
    
    let report: any = null
    
    switch (validation_type) {
      case 'security_audit':
        const securityConfig = {
          include_static_analysis: config?.include_static_analysis ?? true,
          include_dependency_scan: config?.include_dependency_scan ?? true,
          include_configuration_audit: config?.include_configuration_audit ?? true,
          include_pria_compliance: config?.include_pria_compliance ?? true,
          include_owasp_top10: config?.include_owasp_top10 ?? true,
          include_cwe_scanning: config?.include_cwe_scanning ?? false,
          severity_threshold: config?.severity_threshold ?? 'info',
          scan_depth: config?.scan_depth ?? 'standard',
          custom_rules: config?.custom_rules ?? [],
          exclude_patterns: config?.exclude_patterns ?? [],
          false_positive_tolerance: config?.false_positive_tolerance ?? 'balanced'
        }
        
        report = await SecurityAuditor.performSecurityAudit(sessionId, workspaceId, securityConfig)
        
        // Store in database
        await supabase.from('security_audit_reports').insert({
          id: report.id,
          session_id: sessionId,
          workspace_id: workspaceId,
          audit_type: report.audit_type,
          status: report.status,
          start_time: report.start_time,
          end_time: report.end_time,
          duration_ms: report.duration_ms,
          scope: report.scope,
          summary: report.summary,
          compliance_status: report.compliance_status,
          issues: report.issues,
          recommendations: report.recommendations,
          risk_assessment: report.risk_assessment,
          deployment_readiness: report.deployment_readiness,
          metadata: report.metadata
        })
        break
        
      case 'code_review':
        const codeReviewConfig = {
          include_complexity_analysis: config?.include_complexity_analysis ?? true,
          include_maintainability_check: config?.include_maintainability_check ?? true,
          include_performance_analysis: config?.include_performance_analysis ?? true,
          include_best_practices_check: config?.include_best_practices_check ?? true,
          include_pria_compliance_check: config?.include_pria_compliance_check ?? true,
          include_documentation_check: config?.include_documentation_check ?? true,
          severity_threshold: config?.severity_threshold ?? 'info',
          analysis_depth: config?.analysis_depth ?? 'standard',
          custom_rules: config?.custom_rules ?? [],
          exclude_patterns: config?.exclude_patterns ?? []
        }
        
        report = await CodeReviewer.performCodeReview(sessionId, workspaceId, codeReviewConfig)
        
        // Store in database
        await supabase.from('code_review_reports').insert({
          id: report.id,
          session_id: sessionId,
          workspace_id: workspaceId,
          review_type: report.review_type,
          status: report.status,
          start_time: report.start_time,
          end_time: report.end_time,
          duration_ms: report.duration_ms,
          scope: report.scope,
          summary: report.summary,
          overall_quality: report.overall_quality,
          metrics: report.metrics,
          issues: report.issues,
          recommendations: report.recommendations,
          pria_compliance: report.pria_compliance,
          metadata: report.metadata
        })
        break
        
      case 'deployment_readiness':
        const deploymentConfig = {
          target_environment: config?.target_environment ?? 'production',
          skip_non_critical_checks: config?.skip_non_critical_checks ?? false,
          include_performance_validation: config?.include_performance_validation ?? true,
          include_security_validation: config?.include_security_validation ?? true,
          include_compliance_validation: config?.include_compliance_validation ?? true,
          include_dependency_audit: config?.include_dependency_audit ?? true,
          custom_checks: config?.custom_checks ?? [],
          deployment_strategy: config?.deployment_strategy ?? 'blue_green',
          rollback_strategy: config?.rollback_strategy ?? 'automatic',
          monitoring_requirements: config?.monitoring_requirements ?? []
        }
        
        report = await DeploymentReadinessChecker.performReadinessCheck(
          sessionId, 
          workspaceId, 
          deploymentConfig
        )
        
        // Store in database
        await supabase.from('deployment_readiness_reports').insert({
          id: report.id,
          session_id: sessionId,
          workspace_id: workspaceId,
          target_environment: report.target_environment,
          status: report.status,
          start_time: report.start_time,
          end_time: report.end_time,
          duration_ms: report.duration_ms,
          overall_readiness: report.overall_readiness,
          checks: report.checks,
          environment_validation: report.environment_validation,
          dependency_audit: report.dependency_audit,
          performance_metrics: report.performance_metrics,
          compliance_validation: report.compliance_validation,
          security_summary: report.security_summary,
          code_quality_summary: report.code_quality_summary,
          deployment_checklist: report.deployment_checklist,
          recommendations: report.recommendations,
          metadata: report.metadata
        })
        break
        
      case 'comprehensive':
        // Run all validations in sequence
        const securityReport = await SecurityAuditor.performSecurityAudit(sessionId, workspaceId, {
          include_static_analysis: true,
          include_dependency_scan: true,
          include_configuration_audit: true,
          include_pria_compliance: true,
          include_owasp_top10: true,
          include_cwe_scanning: false,
          severity_threshold: 'info',
          scan_depth: 'comprehensive',
          custom_rules: [],
          exclude_patterns: [],
          false_positive_tolerance: 'balanced'
        })
        
        const codeReport = await CodeReviewer.performCodeReview(sessionId, workspaceId, {
          include_complexity_analysis: true,
          include_maintainability_check: true,
          include_performance_analysis: true,
          include_best_practices_check: true,
          include_pria_compliance_check: true,
          include_documentation_check: true,
          severity_threshold: 'info',
          analysis_depth: 'comprehensive',
          custom_rules: [],
          exclude_patterns: []
        })
        
        const deploymentReport = await DeploymentReadinessChecker.performReadinessCheck(
          sessionId, 
          workspaceId, 
          {
            target_environment: 'production',
            skip_non_critical_checks: false,
            include_performance_validation: true,
            include_security_validation: true,
            include_compliance_validation: true,
            include_dependency_audit: true,
            custom_checks: [],
            deployment_strategy: 'blue_green',
            rollback_strategy: 'automatic',
            monitoring_requirements: ['APM', 'Error Tracking', 'Health Checks']
          },
          securityReport,
          codeReport
        )
        
        // Store all reports
        await Promise.all([
          supabase.from('security_audit_reports').insert({
            id: securityReport.id,
            session_id: sessionId,
            workspace_id: workspaceId,
            audit_type: securityReport.audit_type,
            status: securityReport.status,
            start_time: securityReport.start_time,
            end_time: securityReport.end_time,
            duration_ms: securityReport.duration_ms,
            scope: securityReport.scope,
            summary: securityReport.summary,
            compliance_status: securityReport.compliance_status,
            issues: securityReport.issues,
            recommendations: securityReport.recommendations,
            risk_assessment: securityReport.risk_assessment,
            deployment_readiness: securityReport.deployment_readiness,
            metadata: securityReport.metadata
          }),
          
          supabase.from('code_review_reports').insert({
            id: codeReport.id,
            session_id: sessionId,
            workspace_id: workspaceId,
            review_type: codeReport.review_type,
            status: codeReport.status,
            start_time: codeReport.start_time,
            end_time: codeReport.end_time,
            duration_ms: codeReport.duration_ms,
            scope: codeReport.scope,
            summary: codeReport.summary,
            overall_quality: codeReport.overall_quality,
            metrics: codeReport.metrics,
            issues: codeReport.issues,
            recommendations: codeReport.recommendations,
            pria_compliance: codeReport.pria_compliance,
            metadata: codeReport.metadata
          }),
          
          supabase.from('deployment_readiness_reports').insert({
            id: deploymentReport.id,
            session_id: sessionId,
            workspace_id: workspaceId,
            target_environment: deploymentReport.target_environment,
            status: deploymentReport.status,
            start_time: deploymentReport.start_time,
            end_time: deploymentReport.end_time,
            duration_ms: deploymentReport.duration_ms,
            overall_readiness: deploymentReport.overall_readiness,
            checks: deploymentReport.checks,
            environment_validation: deploymentReport.environment_validation,
            dependency_audit: deploymentReport.dependency_audit,
            performance_metrics: deploymentReport.performance_metrics,
            compliance_validation: deploymentReport.compliance_validation,
            security_summary: deploymentReport.security_summary,
            code_quality_summary: deploymentReport.code_quality_summary,
            deployment_checklist: deploymentReport.deployment_checklist,
            recommendations: deploymentReport.recommendations,
            metadata: deploymentReport.metadata
          })
        ])
        
        // Return the deployment report as the primary result
        report = deploymentReport
        break
        
      default:
        return NextResponse.json({ error: 'Invalid validation type' }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        session_id: report.session_id,
        type: validation_type,
        status: report.status,
        start_time: report.start_time,
        end_time: report.end_time,
        duration_ms: report.duration_ms,
        overall_score: validation_type === 'security_audit' 
          ? report.compliance_status?.compliance_score 
          : validation_type === 'code_review'
          ? report.metrics?.maintainability_index
          : report.overall_readiness?.readiness_score,
        ready_for_deployment: validation_type === 'security_audit'
          ? report.deployment_readiness?.ready_for_deployment
          : validation_type === 'code_review'
          ? (report.summary?.blocker_issues || 0) === 0
          : report.overall_readiness?.ready_for_deployment,
        summary: {
          total_issues: report.summary?.total_issues || (report.checks?.length || 0),
          critical_issues: report.summary?.critical_issues || 0,
          high_issues: report.summary?.high_issues || 0,
          medium_issues: report.summary?.medium_issues || 0,
          low_issues: report.summary?.low_issues || 0,
          blocking_issues: validation_type === 'deployment_readiness'
            ? report.checks?.filter((c: any) => c.blocking && c.status === 'fail').length || 0
            : report.deployment_readiness?.blocking_issues?.length || 0
        }
      }
    })
    
  } catch (error) {
    console.error('Error running validation:', error)
    return NextResponse.json(
      { error: 'Failed to run validation' },
      { status: 500 }
    )
  }
}