-- =============================================================================
-- PRIA App Builder - Complete Consolidated Database Schema
-- =============================================================================
-- This is the single authoritative source for all database schema definitions
-- Consolidates and fixes all SQL files from across the project
-- Created: 2024-01-28
-- Version: 1.0.0
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SCHEMA SETUP
-- =============================================================================

-- Create dedicated schema for app_builder
DROP SCHEMA IF EXISTS app_builder CASCADE;
CREATE SCHEMA app_builder;

-- Set search path to use app_builder schema
SET search_path = app_builder, public;

-- Note: Since we're using DROP SCHEMA CASCADE above, 
-- individual drops are not needed - the schema drop handles everything

-- =============================================================================
-- CORE TABLES - Base Foundation
-- =============================================================================

-- Workspaces (tenant isolation)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace Members (for collaboration)
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Projects (logical groupings)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions (individual app development sessions)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    github_repo_url TEXT,
    github_branch TEXT DEFAULT 'main',
    github_last_sync TIMESTAMPTZ,
    github_sync_enabled BOOLEAN DEFAULT false,
    deployment_url TEXT,
    e2b_sandbox_id TEXT,
    target_directory TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Workflow Sessions (7-phase development workflow management)
CREATE TABLE workflow_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    current_phase INTEGER NOT NULL DEFAULT 1 CHECK (current_phase >= 1 AND current_phase <= 7),
    phase_status TEXT NOT NULL DEFAULT 'not_started' CHECK (phase_status IN ('not_started', 'in_progress', 'completed', 'blocked')),
    phase_progress JSONB DEFAULT '{}',
    workflow_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id)
);

-- Workflow Artifacts (cross-phase reference tracking)
CREATE TABLE workflow_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    phase_number INTEGER NOT NULL CHECK (phase_number >= 1 AND phase_number <= 7),
    artifact_type TEXT NOT NULL CHECK (artifact_type IN (
        'requirement', 'architecture', 'specification', 'implementation_plan', 
        'code', 'test', 'deployment_plan', 'documentation'
    )),
    artifact_name TEXT NOT NULL,
    artifact_data JSONB NOT NULL,
    dependencies JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- COMPREHENSIVE REQUIREMENTS MANAGEMENT SYSTEM
-- =============================================================================

-- Requirements table with full lifecycle support
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Requirement identification
    requirement_number VARCHAR(20) NOT NULL, -- REQ-001, REQ-002, etc.
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Requirement classification
    requirement_type VARCHAR(50) NOT NULL CHECK (
        requirement_type IN (
            'functional', 
            'non-functional', 
            'business-rule', 
            'user-interface', 
            'integration', 
            'performance', 
            'security', 
            'accessibility',
            'compliance',
            -- Backward compatibility
            'ui-ux', 'technical', 'business'
        )
    ),
    category VARCHAR(100), -- e.g., "User Management", "Payment Processing"
    
    -- Priority and effort
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (
        priority IN ('critical', 'high', 'medium', 'low', 'nice-to-have')
    ),
    business_value INTEGER CHECK (business_value >= 1 AND business_value <= 10),
    effort_estimate INTEGER, -- story points or hours
    complexity VARCHAR(20) CHECK (complexity IN ('simple', 'medium', 'complex', 'unknown')),
    
    -- Lifecycle status tracking
    status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (
        status IN (
            'new',           -- Just created/discovered
            'draft',         -- Being written/refined
            'review',        -- Under review by stakeholders
            'approved',      -- Approved for development
            'in-design',     -- Being designed/architected
            'ready-dev',     -- Ready for development
            'in-progress',   -- Currently being implemented
            'implemented',   -- Implementation complete
            'testing',       -- Under testing
            'tested',        -- Testing complete
            'deployed',      -- Deployed to production
            'verified',      -- Verified in production
            'rejected',      -- Rejected/not needed
            'deferred',      -- Deferred to later release
            'obsolete',      -- No longer relevant
            -- Backward compatibility
            'pending', 'completed', 'blocked'
        )
    ),
    
    -- Acceptance criteria and user stories
    acceptance_criteria TEXT[], -- Array of acceptance criteria
    user_story TEXT, -- As a [user], I want [goal] so that [benefit]
    scenarios JSONB, -- Test scenarios and edge cases
    
    -- Dependencies and relationships
    depends_on UUID[], -- Array of requirement IDs this depends on
    blocks UUID[], -- Array of requirement IDs this blocks
    related_to UUID[], -- Array of related requirement IDs
    
    -- Traceability
    source VARCHAR(100), -- Where this requirement came from
    rationale TEXT, -- Why this requirement exists
    assumptions TEXT[], -- Assumptions made
    constraints TEXT[], -- Known constraints
    
    -- Implementation tracking
    implemented_in_files TEXT[], -- File paths where implemented
    test_cases TEXT[], -- Associated test case IDs
    documentation_links TEXT[], -- Links to documentation
    
    -- Stakeholder information
    stakeholder VARCHAR(100), -- Primary stakeholder
    business_owner VARCHAR(100), -- Business owner
    technical_owner VARCHAR(100), -- Technical owner
    
    -- Workflow integration
    workflow_phase INTEGER, -- Which workflow phase this was created in
    discovered_by VARCHAR(50), -- 'user' or 'claude' or 'system'
    last_updated_by VARCHAR(50), -- 'user' or 'claude' or 'system'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ,
    tested_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    
    -- Metadata for extensibility
    metadata JSONB DEFAULT '{}',
    
    -- Backward compatibility
    tags JSONB DEFAULT '[]',
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(session_id, requirement_number)
);

-- Requirement change history for audit trail
CREATE TABLE requirement_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Change details
    change_type VARCHAR(50) NOT NULL CHECK (
        change_type IN (
            'created', 'updated', 'status_changed', 'approved', 
            'rejected', 'implemented', 'tested', 'deployed'
        )
    ),
    field_changed VARCHAR(100), -- Which field was changed
    old_value TEXT, -- Previous value
    new_value TEXT, -- New value
    change_reason TEXT, -- Why the change was made
    
    -- Change metadata
    changed_by VARCHAR(50) NOT NULL, -- 'user', 'claude', 'system'
    changed_by_user_id UUID, -- References auth.users(id)
    change_context VARCHAR(100), -- 'chat', 'ui', 'workflow', 'import'
    
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Requirements comments and discussions
CREATE TABLE requirement_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Comment details
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(50) DEFAULT 'general' CHECK (
        comment_type IN (
            'general', 'question', 'concern', 'suggestion', 
            'clarification', 'approval', 'rejection'
        )
    ),
    
    -- Author information
    author_type VARCHAR(50) NOT NULL CHECK (author_type IN ('user', 'claude', 'system')),
    author_user_id UUID, -- References auth.users(id)
    author_name VARCHAR(100),
    
    -- Threading support
    parent_comment_id UUID REFERENCES requirement_comments(id),
    thread_depth INTEGER DEFAULT 0,
    
    -- Status and resolution
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Requirement attachments and supporting documents
CREATE TABLE requirement_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Attachment details
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100), -- 'mockup', 'diagram', 'document', 'screenshot'
    file_size INTEGER,
    file_url TEXT, -- URL to stored file
    file_content TEXT, -- For text-based attachments
    
    -- Attachment metadata
    description TEXT,
    uploaded_by VARCHAR(50) NOT NULL,
    uploaded_by_user_id UUID, -- References auth.users(id)
    
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Requirements templates for common patterns
CREATE TABLE requirement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Template details
    template_name VARCHAR(200) NOT NULL,
    template_description TEXT,
    requirement_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    
    -- Template content
    title_template VARCHAR(200),
    description_template TEXT,
    acceptance_criteria_template TEXT[],
    user_story_template TEXT,
    
    -- Template metadata
    is_system_template BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_by_user_id UUID, -- References auth.users(id)
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    UNIQUE(workspace_id, template_name)
);

-- Requirements metrics and analytics
CREATE TABLE requirement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Metrics snapshot
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requirements INTEGER NOT NULL DEFAULT 0,
    
    -- Status breakdown
    status_new INTEGER DEFAULT 0,
    status_draft INTEGER DEFAULT 0,
    status_approved INTEGER DEFAULT 0,
    status_in_design INTEGER DEFAULT 0,
    status_in_progress INTEGER DEFAULT 0,
    status_implemented INTEGER DEFAULT 0,
    status_testing INTEGER DEFAULT 0,
    status_tested INTEGER DEFAULT 0,
    status_deployed INTEGER DEFAULT 0,
    status_verified INTEGER DEFAULT 0,
    
    -- Type breakdown
    functional_count INTEGER DEFAULT 0,
    non_functional_count INTEGER DEFAULT 0,
    business_rule_count INTEGER DEFAULT 0,
    
    -- Priority breakdown
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    
    -- Quality metrics
    avg_completion_time_days DECIMAL(10,2),
    requirements_with_tests_percent DECIMAL(5,2),
    requirements_with_documentation_percent DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- TECHNICAL SPECIFICATIONS AND ARCHITECTURE
-- =============================================================================

-- Technical Specs (primary table name used by most application code)
CREATE TABLE technical_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('architecture', 'component', 'api', 'database', 'deployment', 'testing')),
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'implemented', 'outdated')),
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Technical Specifications (alias table for backward compatibility)
CREATE TABLE technical_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('architecture', 'component', 'api', 'database', 'deployment', 'testing')),
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'implemented', 'outdated')),
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Implementation Tasks
CREATE TABLE implementation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    specification_id UUID REFERENCES technical_specifications(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT CHECK (task_type IN ('component', 'api', 'database', 'ui', 'test', 'deployment', 'documentation')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'code_review', 'compliance_check', 
        'testing', 'completed', 'blocked', 'skipped'
    )),
    estimated_effort INTEGER, -- hours or story points
    actual_effort INTEGER,
    dependencies JSONB DEFAULT '[]',
    acceptance_criteria TEXT[],
    assigned_to VARCHAR(100),
    compliance_score INTEGER,
    last_compliance_check TIMESTAMPTZ,
    generated_files_count INTEGER DEFAULT 0,
    iterations_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Development Tasks (alias for backward compatibility)
CREATE VIEW development_tasks AS 
SELECT * FROM implementation_tasks;

-- =============================================================================
-- CLAUDE SDK INTEGRATION AND SUBAGENT MANAGEMENT
-- =============================================================================

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Claude Operations (primary table name used by most application code)
CREATE TABLE claude_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (operation_type IN (
        'requirements_analysis', 'code_generation', 'file_modification', 
        'build_execution', 'test_execution', 'deployment', 'subagent_execution'
    )),
    subagent_name TEXT, -- Which subagent was used
    status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled')),
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Claude Interactions (alias table for backward compatibility)
CREATE TABLE claude_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL CHECK (operation_type IN (
        'requirements_analysis', 'code_generation', 'file_modification', 
        'build_execution', 'test_execution', 'deployment', 'subagent_execution'
    )),
    subagent_name TEXT, -- Which subagent was used
    status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled')),
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Subagent contexts table for preserving conversation context
CREATE TABLE subagent_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    phase_number INTEGER,
    context_data JSONB NOT NULL DEFAULT '{}',
    artifacts JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subagent artifacts table for cross-phase references
CREATE TABLE subagent_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    source_agent TEXT NOT NULL,
    target_agent TEXT,
    artifact_type TEXT NOT NULL CHECK (artifact_type IN (
        'requirement', 'specification', 'task', 'code', 'documentation', 'test', 'deployment'
    )),
    artifact_data JSONB NOT NULL,
    reference_key TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- DEVELOPMENT AND FILE MANAGEMENT
-- =============================================================================

-- Generated Files (tracking what Claude creates)
CREATE TABLE generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    task_id UUID REFERENCES implementation_tasks(id) ON DELETE SET NULL,
    operation_id UUID REFERENCES claude_interactions(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    file_content TEXT,
    file_type TEXT NOT NULL DEFAULT 'component' CHECK (file_type IN (
        'component', 'api', 'type', 'util', 'test', 'documentation'
    )),
    content_hash TEXT,
    size_bytes INTEGER,
    compliance_issues INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- File Events (tracking real-time file changes in E2B sandbox)
CREATE TABLE file_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('create', 'modify', 'delete')),
    file_path TEXT NOT NULL,
    file_content TEXT,
    file_size INTEGER,
    checksum TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Development sessions table for tracking overall development progress
CREATE TABLE development_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    current_task_id UUID,
    overall_compliance_score INTEGER DEFAULT 100,
    total_files_generated INTEGER DEFAULT 0,
    development_phase TEXT DEFAULT 'planning' CHECK (development_phase IN (
        'planning', 'implementation', 'refinement', 'validation', 'completed'
    )),
    quality_gates_passed TEXT[] DEFAULT '{}',
    quality_gates_pending TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Development iterations table for tracking iterative development cycles
CREATE TABLE development_iterations (
    id TEXT PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES implementation_tasks(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    files_changed TEXT[] DEFAULT '{}',
    compliance_report JSONB DEFAULT '{}',
    feedback TEXT[] DEFAULT '{}',
    improvements TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'failed'
    )),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Compliance reports table for detailed compliance tracking
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    iteration_id TEXT REFERENCES development_iterations(id) ON DELETE CASCADE,
    task_id UUID REFERENCES implementation_tasks(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    total_issues INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    high_issues INTEGER DEFAULT 0,
    medium_issues INTEGER DEFAULT 0,
    low_issues INTEGER DEFAULT 0,
    issues JSONB DEFAULT '[]',
    summary TEXT,
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- GITHUB INTEGRATION TABLES
-- =============================================================================

-- GitHub repositories table
CREATE TABLE github_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    repository_id BIGINT NOT NULL,
    repository_name TEXT NOT NULL,
    repository_owner TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    clone_url TEXT NOT NULL,
    ssh_url TEXT NOT NULL,
    default_branch TEXT NOT NULL DEFAULT 'main',
    is_private BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint to prevent duplicate repositories per session
    UNIQUE(session_id, repository_id)
);

-- GitHub sync status table
CREATE TABLE github_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    repository_owner TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('push', 'pull', 'clone', 'manual')),
    sync_status TEXT NOT NULL CHECK (sync_status IN ('success', 'failed', 'partial')),
    files_added INTEGER DEFAULT 0,
    files_modified INTEGER DEFAULT 0,
    files_deleted INTEGER DEFAULT 0,
    commit_shas TEXT[],
    error_messages TEXT[],
    synced_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- GitHub authentication table
CREATE TABLE github_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id)
    github_user_id BIGINT,
    github_username TEXT,
    github_email TEXT,
    access_token TEXT, -- Encrypted
    token_type TEXT DEFAULT 'oauth',
    expires_at TIMESTAMPTZ,
    refresh_token TEXT, -- Encrypted
    scopes TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint per workspace and user
    UNIQUE(workspace_id, user_id)
);

-- =============================================================================
-- DEPLOYMENT PIPELINE TABLES
-- =============================================================================

-- Deployment environments configuration
CREATE TABLE deployment_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('development', 'staging', 'production')),
    url TEXT NOT NULL,
    branch TEXT NOT NULL,
    auto_deploy BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    environment_variables JSONB DEFAULT '{}',
    deployment_config JSONB NOT NULL DEFAULT '{
        "build_command": "npm run build",
        "output_directory": ".next", 
        "node_version": "18.x",
        "install_command": "npm ci"
    }',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    UNIQUE(workspace_id, name)
);

-- Deployment plans
CREATE TABLE deployment_plans (
    id TEXT PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    target_environment TEXT NOT NULL CHECK (target_environment IN ('development', 'staging', 'production')),
    deployment_strategy JSONB NOT NULL DEFAULT '{
        "type": "recreate",
        "smoke_tests": ["health_check", "authentication_test"]
    }',
    monitoring_config JSONB NOT NULL DEFAULT '{
        "performance_monitoring": {"enabled": true},
        "error_tracking": {"enabled": true},
        "uptime_monitoring": {"enabled": true},
        "security_monitoring": {"enabled": false}
    }',
    pre_deployment_checks TEXT[] DEFAULT ARRAY[
        'deployment_readiness_validation',
        'environment_variables_check',
        'security_audit_verification'
    ],
    post_deployment_validations TEXT[] DEFAULT ARRAY[
        'health_check_validation',
        'smoke_test_execution',
        'performance_verification'
    ],
    rollback_plan JSONB NOT NULL DEFAULT '{
        "trigger_conditions": ["health_check_failure", "error_rate_threshold_exceeded"],
        "rollback_steps": ["stop_traffic_to_new_version", "restore_previous_deployment"],
        "recovery_time_objective": "15 minutes"
    }',
    feature_flags JSONB DEFAULT '{"enabled": false, "flags": []}',
    database_migrations JSONB DEFAULT '{
        "required": false,
        "migration_files": [],
        "rollback_scripts": []
    }',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'executed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by TEXT
);

-- Deployment executions
CREATE TABLE deployment_executions (
    id TEXT PRIMARY KEY,
    deployment_plan_id TEXT NOT NULL REFERENCES deployment_plans(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'rolled_back', 'cancelled')),
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    duration_ms INTEGER,
    current_step TEXT,
    completed_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
    failed_step TEXT,
    error_message TEXT,
    deployment_url TEXT,
    vercel_deployment_id TEXT,
    performance_metrics JSONB DEFAULT '{
        "build_time_ms": 0,
        "deployment_time_ms": 0
    }',
    rollback_execution JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Deployment logs
CREATE TABLE deployment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id TEXT NOT NULL REFERENCES deployment_executions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    step TEXT
);

-- Deployment approvals (for environments requiring approval)
CREATE TABLE deployment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_plan_id TEXT NOT NULL REFERENCES deployment_plans(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejected_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    approval_notes TEXT
);

-- Deployment metrics (for monitoring deployment health)
CREATE TABLE deployment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id TEXT NOT NULL REFERENCES deployment_executions(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deployment_url TEXT,
    tags JSONB DEFAULT '{}'
);

-- Environment monitoring alerts
CREATE TABLE deployment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    environment_name TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('health_check_failure', 'error_rate_high', 'performance_degraded', 'deployment_failed', 'rollback_triggered')),
    alert_level TEXT NOT NULL CHECK (alert_level IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    deployment_execution_id TEXT REFERENCES deployment_executions(id) ON DELETE SET NULL,
    deployment_url TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    alert_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- ERROR RECOVERY AND MONITORING TABLES
-- =============================================================================

-- Sandbox health monitoring table
CREATE TABLE sandbox_health_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sandbox_id TEXT NOT NULL,
    health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unresponsive')),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    response_time_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    recovery_attempts INTEGER DEFAULT 0,
    last_error TEXT,
    last_recovery_attempt TIMESTAMPTZ,
    monitoring_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    UNIQUE(session_id, sandbox_id)
);

-- Sandbox error incidents table
CREATE TABLE sandbox_error_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sandbox_id TEXT NOT NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('connection_timeout', 'command_failure', 'resource_exhaustion', 'sandbox_terminated', 'unknown')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    error_message TEXT NOT NULL,
    error_context JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolution_method TEXT,
    impact_duration_ms INTEGER,
    user_affected BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

-- Recovery executions table
CREATE TABLE sandbox_recovery_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES sandbox_error_incidents(id) ON DELETE SET NULL,
    old_sandbox_id TEXT,
    new_sandbox_id TEXT,
    recovery_strategy TEXT NOT NULL,
    recovery_trigger TEXT NOT NULL CHECK (recovery_trigger IN ('automatic', 'manual', 'scheduled', 'circuit_breaker')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    context_restored BOOLEAN NOT NULL DEFAULT false,
    files_recovered INTEGER DEFAULT 0,
    commands_replayed INTEGER DEFAULT 0,
    context_integrity TEXT CHECK (context_integrity IN ('full', 'partial', 'lost')),
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
    recovery_metadata JSONB DEFAULT '{}'
);

-- Circuit breaker states table
CREATE TABLE sandbox_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sandbox_id TEXT NOT NULL,
    breaker_state TEXT NOT NULL CHECK (breaker_state IN ('closed', 'open', 'half_open')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count_in_half_open INTEGER DEFAULT 0,
    last_failure_time TIMESTAMPTZ,
    next_attempt_time TIMESTAMPTZ,
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    configuration JSONB DEFAULT '{
        "failure_threshold": 5,
        "timeout_ms": 60000,
        "half_open_success_threshold": 3
    }',
    
    -- Constraints
    UNIQUE(session_id, sandbox_id)
);

-- Recovery strategy configurations table
CREATE TABLE recovery_strategy_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    strategy_name TEXT NOT NULL,
    priority INTEGER NOT NULL,
    applicable_failure_types TEXT[] NOT NULL,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    requires_new_sandbox BOOLEAN NOT NULL DEFAULT false,
    preserves_context BOOLEAN NOT NULL DEFAULT true,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    UNIQUE(workspace_id, strategy_name)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Core tables indexes
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_github_repo_url ON sessions(github_repo_url) WHERE github_repo_url IS NOT NULL;

-- Workflow tables indexes
CREATE INDEX idx_workflow_sessions_session_id ON workflow_sessions(session_id);
CREATE INDEX idx_workflow_sessions_workspace_id ON workflow_sessions(workspace_id);
CREATE INDEX idx_workflow_artifacts_session_id ON workflow_artifacts(session_id);
CREATE INDEX idx_workflow_artifacts_workspace_id ON workflow_artifacts(workspace_id);
CREATE INDEX idx_workflow_artifacts_phase ON workflow_artifacts(phase_number);

-- Requirements table indexes
CREATE INDEX idx_requirements_session_id ON requirements(session_id);
CREATE INDEX idx_requirements_workspace_id ON requirements(workspace_id);
CREATE INDEX idx_requirements_status ON requirements(status);
CREATE INDEX idx_requirements_priority ON requirements(priority);
CREATE INDEX idx_requirements_type ON requirements(requirement_type);
CREATE INDEX idx_requirements_created_at ON requirements(created_at);
CREATE INDEX idx_requirements_updated_at ON requirements(updated_at);
CREATE INDEX idx_requirements_number ON requirements(session_id, requirement_number);
CREATE INDEX idx_requirements_status_priority ON requirements(status, priority);
CREATE INDEX idx_requirements_workflow_phase ON requirements(workflow_phase);
CREATE INDEX idx_requirements_business_value ON requirements(business_value);
CREATE INDEX idx_requirements_discovered_by ON requirements(discovered_by);

-- Requirement change history indexes
CREATE INDEX idx_requirement_changes_requirement_id ON requirement_changes(requirement_id);
CREATE INDEX idx_requirement_changes_created_at ON requirement_changes(created_at);
CREATE INDEX idx_requirement_changes_change_type ON requirement_changes(change_type);
CREATE INDEX idx_requirement_changes_workspace_id ON requirement_changes(workspace_id);

-- Requirement comments indexes
CREATE INDEX idx_requirement_comments_requirement_id ON requirement_comments(requirement_id);
CREATE INDEX idx_requirement_comments_created_at ON requirement_comments(created_at);
CREATE INDEX idx_requirement_comments_thread ON requirement_comments(parent_comment_id);
CREATE INDEX idx_requirement_comments_workspace_id ON requirement_comments(workspace_id);

-- Requirement attachments indexes
CREATE INDEX idx_requirement_attachments_requirement_id ON requirement_attachments(requirement_id);
CREATE INDEX idx_requirement_attachments_workspace_id ON requirement_attachments(workspace_id);

-- Requirement templates indexes
CREATE INDEX idx_requirement_templates_workspace_id ON requirement_templates(workspace_id);
CREATE INDEX idx_requirement_templates_type ON requirement_templates(requirement_type);

-- Technical specifications indexes
CREATE INDEX idx_technical_specifications_workspace_id ON technical_specifications(workspace_id);
CREATE INDEX idx_technical_specifications_session_id ON technical_specifications(session_id);

-- Implementation tasks indexes
CREATE INDEX idx_implementation_tasks_workspace_id ON implementation_tasks(workspace_id);
CREATE INDEX idx_implementation_tasks_session_id ON implementation_tasks(session_id);
CREATE INDEX idx_implementation_tasks_status ON implementation_tasks(status);
CREATE INDEX idx_implementation_tasks_priority ON implementation_tasks(priority);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_workspace_id ON chat_messages(workspace_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);

-- Claude interactions indexes
CREATE INDEX idx_claude_interactions_workspace_id ON claude_interactions(workspace_id);
CREATE INDEX idx_claude_interactions_session_id ON claude_interactions(session_id);
CREATE INDEX idx_claude_interactions_operation_type ON claude_interactions(operation_type);

-- Subagent contexts indexes
CREATE INDEX idx_subagent_contexts_session_agent ON subagent_contexts(session_id, agent_name);
CREATE INDEX idx_subagent_contexts_workspace_phase ON subagent_contexts(workspace_id, phase_number);
CREATE INDEX idx_subagent_contexts_version ON subagent_contexts(session_id, agent_name, version DESC);

-- Subagent artifacts indexes
CREATE INDEX idx_subagent_artifacts_session ON subagent_artifacts(session_id);
CREATE INDEX idx_subagent_artifacts_source_agent ON subagent_artifacts(source_agent);
CREATE INDEX idx_subagent_artifacts_reference_key ON subagent_artifacts(reference_key);
CREATE INDEX idx_subagent_artifacts_type ON subagent_artifacts(artifact_type);
CREATE INDEX idx_subagent_artifacts_created_at ON subagent_artifacts(created_at DESC);

-- Generated files indexes
CREATE INDEX idx_generated_files_workspace_id ON generated_files(workspace_id);
CREATE INDEX idx_generated_files_session_id ON generated_files(session_id);
CREATE INDEX idx_generated_files_session_task ON generated_files(session_id, task_id);
CREATE INDEX idx_generated_files_path ON generated_files(file_path);
CREATE INDEX idx_generated_files_type ON generated_files(file_type);
CREATE INDEX idx_generated_files_updated_at ON generated_files(updated_at DESC);

-- File events indexes
CREATE INDEX idx_file_events_workspace_id ON file_events(workspace_id);
CREATE INDEX idx_file_events_session_id ON file_events(session_id);
CREATE INDEX idx_file_events_created_at ON file_events(created_at);

-- Development sessions indexes
CREATE INDEX idx_development_sessions_session ON development_sessions(session_id);
CREATE INDEX idx_development_sessions_workspace ON development_sessions(workspace_id);

-- Development iterations indexes
CREATE INDEX idx_development_iterations_session_task ON development_iterations(session_id, task_id);
CREATE INDEX idx_development_iterations_status ON development_iterations(status);
CREATE INDEX idx_development_iterations_created_at ON development_iterations(created_at DESC);

-- Compliance reports indexes
CREATE INDEX idx_compliance_reports_session ON compliance_reports(session_id);
CREATE INDEX idx_compliance_reports_score ON compliance_reports(score);
CREATE INDEX idx_compliance_reports_created_at ON compliance_reports(created_at DESC);

-- GitHub repositories indexes
CREATE INDEX idx_github_repositories_workspace_id ON github_repositories(workspace_id);
CREATE INDEX idx_github_repositories_session_id ON github_repositories(session_id);
CREATE INDEX idx_github_repositories_owner_name ON github_repositories(repository_owner, repository_name);

-- GitHub sync status indexes
CREATE INDEX idx_github_sync_status_workspace_id ON github_sync_status(workspace_id);
CREATE INDEX idx_github_sync_status_session_id ON github_sync_status(session_id);
CREATE INDEX idx_github_sync_status_synced_at ON github_sync_status(synced_at DESC);

-- GitHub auth indexes
CREATE INDEX idx_github_auth_workspace_id ON github_auth(workspace_id);
CREATE INDEX idx_github_auth_user_id ON github_auth(user_id);

-- Deployment tables indexes
CREATE INDEX idx_deployment_environments_workspace ON deployment_environments(workspace_id);
CREATE INDEX idx_deployment_environments_name ON deployment_environments(name);
CREATE INDEX idx_deployment_environments_active ON deployment_environments(is_active);

CREATE INDEX idx_deployment_plans_session ON deployment_plans(session_id);
CREATE INDEX idx_deployment_plans_workspace ON deployment_plans(workspace_id);
CREATE INDEX idx_deployment_plans_environment ON deployment_plans(target_environment);
CREATE INDEX idx_deployment_plans_status ON deployment_plans(status);
CREATE INDEX idx_deployment_plans_created ON deployment_plans(created_at DESC);

CREATE INDEX idx_deployment_executions_plan ON deployment_executions(deployment_plan_id);
CREATE INDEX idx_deployment_executions_workspace ON deployment_executions(workspace_id);
CREATE INDEX idx_deployment_executions_status ON deployment_executions(status);
CREATE INDEX idx_deployment_executions_start_time ON deployment_executions(start_time DESC);
CREATE INDEX idx_deployment_executions_vercel ON deployment_executions(vercel_deployment_id);

CREATE INDEX idx_deployment_logs_execution ON deployment_logs(execution_id);
CREATE INDEX idx_deployment_logs_workspace ON deployment_logs(workspace_id);
CREATE INDEX idx_deployment_logs_timestamp ON deployment_logs(timestamp DESC);
CREATE INDEX idx_deployment_logs_level ON deployment_logs(level);

CREATE INDEX idx_deployment_approvals_plan ON deployment_approvals(deployment_plan_id);
CREATE INDEX idx_deployment_approvals_workspace ON deployment_approvals(workspace_id);
CREATE INDEX idx_deployment_approvals_status ON deployment_approvals(status);
CREATE INDEX idx_deployment_approvals_requested ON deployment_approvals(requested_at DESC);
CREATE INDEX idx_deployment_approvals_expires ON deployment_approvals(expires_at);

CREATE INDEX idx_deployment_metrics_execution ON deployment_metrics(execution_id);
CREATE INDEX idx_deployment_metrics_workspace ON deployment_metrics(workspace_id);
CREATE INDEX idx_deployment_metrics_name ON deployment_metrics(metric_name);
CREATE INDEX idx_deployment_metrics_recorded ON deployment_metrics(recorded_at DESC);

CREATE INDEX idx_deployment_alerts_workspace ON deployment_alerts(workspace_id);
CREATE INDEX idx_deployment_alerts_environment ON deployment_alerts(environment_name);
CREATE INDEX idx_deployment_alerts_type ON deployment_alerts(alert_type);
CREATE INDEX idx_deployment_alerts_level ON deployment_alerts(alert_level);
CREATE INDEX idx_deployment_alerts_resolved ON deployment_alerts(resolved);
CREATE INDEX idx_deployment_alerts_created ON deployment_alerts(created_at DESC);

-- Error recovery indexes
CREATE INDEX idx_sandbox_health_workspace ON sandbox_health_monitoring(workspace_id);
CREATE INDEX idx_sandbox_health_session ON sandbox_health_monitoring(session_id);
CREATE INDEX idx_sandbox_health_status ON sandbox_health_monitoring(health_status);
CREATE INDEX idx_sandbox_health_heartbeat ON sandbox_health_monitoring(last_heartbeat DESC);
CREATE INDEX idx_sandbox_health_active ON sandbox_health_monitoring(monitoring_active);

CREATE INDEX idx_sandbox_errors_workspace ON sandbox_error_incidents(workspace_id);
CREATE INDEX idx_sandbox_errors_session ON sandbox_error_incidents(session_id);
CREATE INDEX idx_sandbox_errors_type ON sandbox_error_incidents(incident_type);
CREATE INDEX idx_sandbox_errors_severity ON sandbox_error_incidents(severity);
CREATE INDEX idx_sandbox_errors_occurred ON sandbox_error_incidents(occurred_at DESC);
CREATE INDEX idx_sandbox_errors_resolved ON sandbox_error_incidents(resolved_at);

CREATE INDEX idx_recovery_executions_workspace ON sandbox_recovery_executions(workspace_id);
CREATE INDEX idx_recovery_executions_session ON sandbox_recovery_executions(session_id);
CREATE INDEX idx_recovery_executions_incident ON sandbox_recovery_executions(incident_id);
CREATE INDEX idx_recovery_executions_strategy ON sandbox_recovery_executions(recovery_strategy);
CREATE INDEX idx_recovery_executions_started ON sandbox_recovery_executions(started_at DESC);
CREATE INDEX idx_recovery_executions_success ON sandbox_recovery_executions(success);

CREATE INDEX idx_circuit_breakers_workspace ON sandbox_circuit_breakers(workspace_id);
CREATE INDEX idx_circuit_breakers_session ON sandbox_circuit_breakers(session_id);
CREATE INDEX idx_circuit_breakers_state ON sandbox_circuit_breakers(breaker_state);
CREATE INDEX idx_circuit_breakers_next_attempt ON sandbox_circuit_breakers(next_attempt_time);

CREATE INDEX idx_recovery_strategies_workspace ON recovery_strategy_configs(workspace_id);
CREATE INDEX idx_recovery_strategies_priority ON recovery_strategy_configs(priority);
CREATE INDEX idx_recovery_strategies_enabled ON recovery_strategy_configs(is_enabled);

-- Special unique constraint indexes
CREATE UNIQUE INDEX idx_subagent_artifacts_unique_reference 
    ON subagent_artifacts(session_id, reference_key) 
    WHERE reference_key IS NOT NULL;

CREATE UNIQUE INDEX idx_development_sessions_unique 
    ON development_sessions(session_id, workspace_id);

CREATE UNIQUE INDEX idx_development_iterations_unique 
    ON development_iterations(task_id, iteration_number);

CREATE UNIQUE INDEX idx_generated_files_unique 
    ON generated_files(session_id, task_id, file_path);

-- Composite indexes for performance
CREATE INDEX idx_deployment_executions_composite 
ON deployment_executions (workspace_id, status, start_time DESC);

CREATE INDEX idx_deployment_logs_composite
ON deployment_logs (execution_id, level, timestamp DESC);

CREATE INDEX idx_deployment_metrics_composite
ON deployment_metrics (workspace_id, metric_name, recorded_at DESC);

-- Partial indexes for active/pending records
CREATE INDEX idx_deployment_executions_active
ON deployment_executions (workspace_id, start_time DESC) 
WHERE status IN ('pending', 'running');

CREATE INDEX idx_deployment_approvals_pending
ON deployment_approvals (workspace_id, requested_at DESC)
WHERE status = 'pending';

CREATE INDEX idx_deployment_alerts_unresolved
ON deployment_alerts (workspace_id, alert_level, created_at DESC)
WHERE resolved = false;

CREATE INDEX idx_sandbox_health_composite 
ON sandbox_health_monitoring (workspace_id, health_status, last_heartbeat DESC, consecutive_failures);

CREATE INDEX idx_error_incidents_composite
ON sandbox_error_incidents (workspace_id, incident_type, severity, occurred_at DESC);

CREATE INDEX idx_recovery_executions_composite
ON sandbox_recovery_executions (workspace_id, success, started_at DESC, recovery_strategy);

-- Partial indexes for active monitoring
CREATE INDEX idx_sandbox_health_active_monitoring
ON sandbox_health_monitoring (workspace_id, last_heartbeat DESC) 
WHERE monitoring_active = true AND health_status IN ('degraded', 'unhealthy', 'unresponsive');

CREATE INDEX idx_unresolved_incidents
ON sandbox_error_incidents (workspace_id, occurred_at DESC)
WHERE resolved_at IS NULL;

CREATE INDEX idx_circuit_breakers_open
ON sandbox_circuit_breakers (workspace_id, next_attempt_time)
WHERE breaker_state = 'open';

-- JSONB GIN indexes for better performance
CREATE INDEX idx_requirements_metadata_gin ON requirements USING GIN(metadata);
CREATE INDEX idx_requirement_changes_metadata_gin ON requirement_changes USING GIN(metadata);
CREATE INDEX idx_requirement_comments_metadata_gin ON requirement_comments USING GIN(metadata);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subagent_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subagent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_health_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_error_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_recovery_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_strategy_configs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Helper function to get user's workspace_id from JWT
CREATE OR REPLACE FUNCTION get_user_workspace_id() 
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative workspace ID function using new auth pattern
CREATE OR REPLACE FUNCTION get_workspace_id_from_jwt()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt()->>'workspace_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a new workspace with the user as owner
CREATE OR REPLACE FUNCTION create_workspace(workspace_name TEXT)
RETURNS UUID AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  -- Insert workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES (workspace_name, auth.uid())
  RETURNING id INTO new_workspace_id;
  
  -- Add user as owner member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, auth.uid(), 'owner');
  
  RETURN new_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add user to workspace
CREATE OR REPLACE FUNCTION add_workspace_member(
  p_workspace_id UUID,
  p_user_id UUID,
  member_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user is admin or owner
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = p_workspace_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to add members';
  END IF;
  
  -- Add member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, p_user_id, member_role)
  ON CONFLICT (workspace_id, user_id) 
  DO UPDATE SET role = member_role, updated_at = now();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update user's app_metadata with workspace_id
CREATE OR REPLACE FUNCTION update_user_workspace_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user's app_metadata to include workspace_id for RLS
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.workspace_id != OLD.workspace_id) THEN
    -- Set workspace_id in user's app_metadata for RLS policies
    UPDATE auth.users 
    SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
        jsonb_build_object('workspace_id', NEW.workspace_id::text)
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-generate requirement numbers
CREATE OR REPLACE FUNCTION generate_requirement_number()
RETURNS TRIGGER AS $$
DECLARE
    next_number INTEGER;
    new_req_number VARCHAR(20);
BEGIN
    IF NEW.requirement_number IS NULL OR NEW.requirement_number = '' THEN
        -- Get the next number for this session
        SELECT COALESCE(MAX(
            CAST(SUBSTRING(requirement_number FROM 'REQ-([0-9]+)') AS INTEGER)
        ), 0) + 1
        INTO next_number
        FROM requirements 
        WHERE session_id = NEW.session_id
        AND requirement_number ~ '^REQ-[0-9]+$';
        
        -- Format as REQ-001, REQ-002, etc.
        new_req_number := 'REQ-' || LPAD(next_number::TEXT, 3, '0');
        NEW.requirement_number := new_req_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update requirement timestamps based on status
CREATE OR REPLACE FUNCTION update_requirement_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    
    -- Auto-update status-specific timestamps when status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'approved' THEN NEW.approved_at = now();
            WHEN 'implemented' THEN NEW.implemented_at = now();
            WHEN 'tested' THEN NEW.tested_at = now();
            WHEN 'deployed' THEN NEW.deployed_at = now();
            ELSE NULL;
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log requirement changes
CREATE OR REPLACE FUNCTION log_requirement_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the change in requirement_changes table
    IF TG_OP = 'INSERT' THEN
        INSERT INTO requirement_changes (
            requirement_id, workspace_id, change_type, new_value, 
            changed_by, change_context
        ) VALUES (
            NEW.id, NEW.workspace_id, 'created', 
            NEW.title, COALESCE(NEW.last_updated_by, 'system'), 'system'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO requirement_changes (
                requirement_id, workspace_id, change_type, field_changed,
                old_value, new_value, changed_by, change_context
            ) VALUES (
                NEW.id, NEW.workspace_id, 'status_changed', 'status',
                OLD.status, NEW.status, 
                COALESCE(NEW.last_updated_by, 'system'), 'system'
            );
        END IF;
        
        -- Log title changes
        IF OLD.title IS DISTINCT FROM NEW.title THEN
            INSERT INTO requirement_changes (
                requirement_id, workspace_id, change_type, field_changed,
                old_value, new_value, changed_by, change_context
            ) VALUES (
                NEW.id, NEW.workspace_id, 'updated', 'title',
                OLD.title, NEW.title,
                COALESCE(NEW.last_updated_by, 'system'), 'system'
            );
        END IF;
        
        -- Log priority changes
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            INSERT INTO requirement_changes (
                requirement_id, workspace_id, change_type, field_changed,
                old_value, new_value, changed_by, change_context
            ) VALUES (
                NEW.id, NEW.workspace_id, 'updated', 'priority',
                OLD.priority, NEW.priority,
                COALESCE(NEW.last_updated_by, 'system'), 'system'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Workspace validation functions for subagents
CREATE OR REPLACE FUNCTION validate_subagent_workspace()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure session belongs to the same workspace
    IF NOT EXISTS (
        SELECT 1 FROM sessions s 
        WHERE s.id = NEW.session_id 
        AND s.workspace_id = NEW.workspace_id
    ) THEN
        RAISE EXCEPTION 'Session does not belong to the specified workspace';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Development workspace validation
CREATE OR REPLACE FUNCTION validate_development_workspace()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure session belongs to the same workspace
    IF NOT EXISTS (
        SELECT 1 FROM sessions s 
        WHERE s.id = NEW.session_id 
        AND s.workspace_id = NEW.workspace_id
    ) THEN
        RAISE EXCEPTION 'Session does not belong to the specified workspace';
    END IF;
    
    -- For iterations, ensure task belongs to the same workspace
    IF TG_TABLE_NAME = 'development_iterations' THEN
        IF NOT EXISTS (
            SELECT 1 FROM implementation_tasks t 
            WHERE t.id = NEW.task_id 
            AND t.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Task does not belong to the specified workspace';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- GitHub token validation function
CREATE OR REPLACE FUNCTION validate_github_token_format(token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate GitHub token patterns (encrypted tokens won't match, but useful for debugging)
    RETURN token ~ '^(ghp_|gho_|ghu_|ghs_)[a-zA-Z0-9]{36,}$' OR 
           -- Allow encrypted format (JSON with data, iv, tag, type, version)
           token ~ '^\\{.*\"type\":\"github_token\".*\\}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ERROR RECOVERY FUNCTIONS
-- =============================================================================

-- Function to update sandbox health status
CREATE OR REPLACE FUNCTION update_sandbox_health(
    p_workspace_id UUID,
    p_session_id UUID,
    p_sandbox_id TEXT,
    p_health_status TEXT,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO sandbox_health_monitoring (
        workspace_id,
        session_id,
        sandbox_id,
        health_status,
        last_heartbeat,
        response_time_ms,
        error_count,
        consecutive_failures,
        last_error
    )
    VALUES (
        p_workspace_id,
        p_session_id,
        p_sandbox_id,
        p_health_status,
        now(),
        COALESCE(p_response_time_ms, 0),
        CASE WHEN p_error_message IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN p_health_status IN ('unhealthy', 'unresponsive') THEN 1 ELSE 0 END,
        p_error_message
    )
    ON CONFLICT (session_id, sandbox_id) DO UPDATE SET
        health_status = p_health_status,
        last_heartbeat = now(),
        response_time_ms = COALESCE(p_response_time_ms, sandbox_health_monitoring.response_time_ms),
        error_count = CASE 
            WHEN p_error_message IS NOT NULL THEN sandbox_health_monitoring.error_count + 1
            ELSE sandbox_health_monitoring.error_count
        END,
        consecutive_failures = CASE
            WHEN p_health_status IN ('unhealthy', 'unresponsive') THEN sandbox_health_monitoring.consecutive_failures + 1
            WHEN p_health_status = 'healthy' THEN 0
            ELSE sandbox_health_monitoring.consecutive_failures
        END,
        last_error = COALESCE(p_error_message, sandbox_health_monitoring.last_error),
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to record error incident
CREATE OR REPLACE FUNCTION record_error_incident(
    p_workspace_id UUID,
    p_session_id UUID,
    p_sandbox_id TEXT,
    p_incident_type TEXT,
    p_severity TEXT,
    p_error_message TEXT,
    p_error_context JSONB DEFAULT '{}',
    p_user_affected BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    incident_id UUID;
BEGIN
    INSERT INTO sandbox_error_incidents (
        workspace_id,
        session_id,
        sandbox_id,
        incident_type,
        severity,
        error_message,
        error_context,
        user_affected
    )
    VALUES (
        p_workspace_id,
        p_session_id,
        p_sandbox_id,
        p_incident_type,
        p_severity,
        p_error_message,
        p_error_context,
        p_user_affected
    )
    RETURNING id INTO incident_id;
    
    RETURN incident_id;
END;
$$ LANGUAGE plpgsql;

-- Function to start recovery execution
CREATE OR REPLACE FUNCTION start_recovery_execution(
    p_workspace_id UUID,
    p_session_id UUID,
    p_incident_id UUID,
    p_old_sandbox_id TEXT,
    p_recovery_strategy TEXT,
    p_recovery_trigger TEXT
)
RETURNS UUID AS $$
DECLARE
    execution_id UUID;
BEGIN
    INSERT INTO sandbox_recovery_executions (
        workspace_id,
        session_id,
        incident_id,
        old_sandbox_id,
        recovery_strategy,
        recovery_trigger,
        started_at
    )
    VALUES (
        p_workspace_id,
        p_session_id,
        p_incident_id,
        p_old_sandbox_id,
        p_recovery_strategy,
        p_recovery_trigger,
        now()
    )
    RETURNING id INTO execution_id;
    
    RETURN execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete recovery execution
CREATE OR REPLACE FUNCTION complete_recovery_execution(
    p_execution_id UUID,
    p_new_sandbox_id TEXT,
    p_success BOOLEAN,
    p_context_restored BOOLEAN,
    p_files_recovered INTEGER DEFAULT 0,
    p_commands_replayed INTEGER DEFAULT 0,
    p_context_integrity TEXT DEFAULT 'unknown',
    p_errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_recovery_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    UPDATE sandbox_recovery_executions
    SET
        new_sandbox_id = p_new_sandbox_id,
        completed_at = now(),
        duration_ms = EXTRACT(epoch FROM (now() - started_at)) * 1000,
        success = p_success,
        context_restored = p_context_restored,
        files_recovered = p_files_recovered,
        commands_replayed = p_commands_replayed,
        context_integrity = p_context_integrity,
        errors = p_errors,
        warnings = p_warnings,
        recovery_metadata = p_recovery_metadata
    WHERE id = p_execution_id;
    
    -- Update recovery attempt count in health monitoring
    UPDATE sandbox_health_monitoring
    SET 
        recovery_attempts = recovery_attempts + 1,
        last_recovery_attempt = now()
    WHERE session_id = (
        SELECT session_id FROM sandbox_recovery_executions WHERE id = p_execution_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker(
    p_workspace_id UUID,
    p_session_id UUID,
    p_sandbox_id TEXT,
    p_breaker_state TEXT,
    p_failure_count INTEGER DEFAULT NULL,
    p_success_count_in_half_open INTEGER DEFAULT NULL,
    p_next_attempt_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO sandbox_circuit_breakers (
        workspace_id,
        session_id,
        sandbox_id,
        breaker_state,
        failure_count,
        success_count_in_half_open,
        next_attempt_time,
        last_failure_time
    )
    VALUES (
        p_workspace_id,
        p_session_id,
        p_sandbox_id,
        p_breaker_state,
        COALESCE(p_failure_count, 0),
        COALESCE(p_success_count_in_half_open, 0),
        p_next_attempt_time,
        CASE WHEN p_breaker_state = 'open' THEN now() ELSE NULL END
    )
    ON CONFLICT (session_id, sandbox_id) DO UPDATE SET
        breaker_state = p_breaker_state,
        failure_count = COALESCE(p_failure_count, sandbox_circuit_breakers.failure_count),
        success_count_in_half_open = COALESCE(p_success_count_in_half_open, sandbox_circuit_breakers.success_count_in_half_open),
        next_attempt_time = COALESCE(p_next_attempt_time, sandbox_circuit_breakers.next_attempt_time),
        last_failure_time = CASE WHEN p_breaker_state = 'open' THEN now() ELSE sandbox_circuit_breakers.last_failure_time END,
        state_changed_at = now();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES - COMPREHENSIVE WORKSPACE ISOLATION
-- =============================================================================

-- Workspaces: Users can only see workspaces they are members of
CREATE POLICY "workspace_member_access" ON workspaces
FOR ALL USING (
  id IN (
    SELECT workspace_id 
    FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Workspace Members: Users can only see their own memberships
CREATE POLICY "user_own_memberships" ON workspace_members
FOR ALL USING (user_id = auth.uid());

-- Standard workspace isolation policy for most tables
CREATE POLICY "workspace_isolation_projects" ON projects
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_sessions" ON sessions
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_workflow_sessions" ON workflow_sessions
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_workflow_artifacts" ON workflow_artifacts
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirements" ON requirements
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirement_changes" ON requirement_changes
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirement_comments" ON requirement_comments
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirement_attachments" ON requirement_attachments
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirement_templates" ON requirement_templates
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_requirement_metrics" ON requirement_metrics
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_technical_specs" ON technical_specs
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_technical_specifications" ON technical_specifications
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_implementation_tasks" ON implementation_tasks
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_chat_messages" ON chat_messages
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_claude_operations" ON claude_operations
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_claude_interactions" ON claude_interactions
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_subagent_contexts" ON subagent_contexts
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_subagent_artifacts" ON subagent_artifacts
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_generated_files" ON generated_files
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_file_events" ON file_events
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_development_sessions" ON development_sessions
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_development_iterations" ON development_iterations
FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_compliance_reports" ON compliance_reports
FOR ALL USING (workspace_id = get_user_workspace_id());

-- GitHub integration policies with workspace access validation
CREATE POLICY "Users can view repositories in their workspace" ON github_repositories
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create repositories in their workspace" ON github_repositories
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update repositories in their workspace" ON github_repositories
    FOR UPDATE USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete repositories in their workspace" ON github_repositories
    FOR DELETE USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view sync status in their workspace" ON github_sync_status
    FOR SELECT USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can create sync status in their workspace" ON github_sync_status
    FOR INSERT WITH CHECK (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
    ));

-- GitHub auth policies (user-specific)
CREATE POLICY "Users can view their own GitHub auth" ON github_auth
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own GitHub auth" ON github_auth
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own GitHub auth" ON github_auth
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own GitHub auth" ON github_auth
    FOR DELETE USING (user_id = auth.uid());

-- Deployment pipeline policies with JWT-based workspace isolation
CREATE POLICY "workspace_isolation_deployment_environments" ON deployment_environments
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_plans" ON deployment_plans
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_executions" ON deployment_executions
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_logs" ON deployment_logs
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_approvals" ON deployment_approvals
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_metrics" ON deployment_metrics
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_deployment_alerts" ON deployment_alerts
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

-- Error recovery policies
CREATE POLICY "workspace_isolation_sandbox_health_monitoring" ON sandbox_health_monitoring
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_sandbox_error_incidents" ON sandbox_error_incidents
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_sandbox_recovery_executions" ON sandbox_recovery_executions
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_sandbox_circuit_breakers" ON sandbox_circuit_breakers
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

CREATE POLICY "workspace_isolation_recovery_strategy_configs" ON recovery_strategy_configs
FOR ALL USING (workspace_id = get_workspace_id_from_jwt());

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at triggers
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_sessions_updated_at BEFORE UPDATE ON workflow_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_artifacts_updated_at BEFORE UPDATE ON workflow_artifacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirements_updated_at 
    BEFORE UPDATE ON requirements
    FOR EACH ROW 
    EXECUTE FUNCTION update_requirement_status_timestamps();

CREATE TRIGGER update_requirement_comments_updated_at 
    BEFORE UPDATE ON requirement_comments
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requirement_templates_updated_at 
    BEFORE UPDATE ON requirement_templates
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technical_specifications_updated_at BEFORE UPDATE ON technical_specifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implementation_tasks_updated_at BEFORE UPDATE ON implementation_tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subagent_contexts_updated_at 
    BEFORE UPDATE ON subagent_contexts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_files_updated_at BEFORE UPDATE ON generated_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_development_sessions_updated_at 
    BEFORE UPDATE ON development_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_repositories_updated_at BEFORE UPDATE ON github_repositories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_auth_updated_at BEFORE UPDATE ON github_auth
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_environments_updated_at 
    BEFORE UPDATE ON deployment_environments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployment_executions_updated_at 
    BEFORE UPDATE ON deployment_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sandbox_health_monitoring_updated_at 
    BEFORE UPDATE ON sandbox_health_monitoring
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recovery_strategy_configs_updated_at 
    BEFORE UPDATE ON recovery_strategy_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User workspace metadata trigger
CREATE TRIGGER update_user_workspace_metadata_trigger
AFTER INSERT OR UPDATE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION update_user_workspace_metadata();

-- Requirement-specific triggers
CREATE TRIGGER trigger_generate_requirement_number
    BEFORE INSERT ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION generate_requirement_number();

CREATE TRIGGER trigger_log_requirement_change
    AFTER INSERT OR UPDATE ON requirements
    FOR EACH ROW
    EXECUTE FUNCTION log_requirement_change();

-- Workspace validation triggers
CREATE TRIGGER validate_subagent_contexts_workspace 
    BEFORE INSERT OR UPDATE ON subagent_contexts 
    FOR EACH ROW EXECUTE FUNCTION validate_subagent_workspace();

CREATE TRIGGER validate_subagent_artifacts_workspace 
    BEFORE INSERT OR UPDATE ON subagent_artifacts 
    FOR EACH ROW EXECUTE FUNCTION validate_subagent_workspace();

CREATE TRIGGER validate_development_sessions_workspace 
    BEFORE INSERT OR UPDATE ON development_sessions 
    FOR EACH ROW EXECUTE FUNCTION validate_development_workspace();

CREATE TRIGGER validate_development_iterations_workspace 
    BEFORE INSERT OR UPDATE ON development_iterations 
    FOR EACH ROW EXECUTE FUNCTION validate_development_workspace();

CREATE TRIGGER validate_generated_files_workspace 
    BEFORE INSERT OR UPDATE ON generated_files 
    FOR EACH ROW EXECUTE FUNCTION validate_development_workspace();

-- =============================================================================
-- VIEWS FOR ENHANCED FUNCTIONALITY
-- =============================================================================

-- Latest subagent contexts (useful for queries)
CREATE OR REPLACE VIEW latest_subagent_contexts AS
SELECT DISTINCT ON (session_id, agent_name) 
    id,
    workspace_id,
    session_id,
    agent_name,
    phase_number,
    context_data,
    artifacts,
    version,
    created_at,
    updated_at
FROM subagent_contexts
ORDER BY session_id, agent_name, version DESC;

-- Subagent artifact summary statistics
CREATE OR REPLACE VIEW subagent_artifact_summary AS
SELECT 
    workspace_id,
    session_id,
    source_agent,
    artifact_type,
    COUNT(*) as artifact_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM subagent_artifacts
GROUP BY workspace_id, session_id, source_agent, artifact_type;

-- Development progress view
CREATE OR REPLACE VIEW development_progress AS
SELECT 
    ds.workspace_id,
    ds.session_id,
    ds.development_phase,
    ds.overall_compliance_score,
    ds.total_files_generated,
    COUNT(dt.id) as total_tasks,
    COUNT(CASE WHEN dt.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN dt.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN dt.status = 'blocked' THEN 1 END) as blocked_tasks,
    COALESCE(AVG(dt.compliance_score), 100) as avg_compliance_score,
    COUNT(di.id) as total_iterations,
    COUNT(gf.id) as current_files_count,
    COALESCE(AVG(cr.score), 100) as latest_compliance_score
FROM development_sessions ds
LEFT JOIN implementation_tasks dt ON dt.session_id = ds.session_id AND dt.workspace_id = ds.workspace_id
LEFT JOIN development_iterations di ON di.session_id = ds.session_id AND di.workspace_id = ds.workspace_id
LEFT JOIN generated_files gf ON gf.session_id = ds.session_id AND gf.workspace_id = ds.workspace_id
LEFT JOIN compliance_reports cr ON cr.session_id = ds.session_id AND cr.workspace_id = ds.workspace_id
GROUP BY ds.workspace_id, ds.session_id, ds.development_phase, ds.overall_compliance_score, ds.total_files_generated;

-- Compliance trends view
CREATE OR REPLACE VIEW compliance_trends AS
SELECT 
    workspace_id,
    session_id,
    task_id,
    DATE_TRUNC('day', created_at) as report_date,
    AVG(score) as avg_score,
    SUM(critical_issues) as total_critical_issues,
    SUM(high_issues) as total_high_issues,
    COUNT(*) as reports_count
FROM compliance_reports
GROUP BY workspace_id, session_id, task_id, DATE_TRUNC('day', created_at)
ORDER BY report_date DESC;

-- =============================================================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- =============================================================================

-- Function to get requirement statistics for a session
CREATE OR REPLACE FUNCTION get_requirement_stats(session_uuid UUID)
RETURNS TABLE (
    total_requirements INTEGER,
    by_status JSONB,
    by_priority JSONB,
    by_type JSONB,
    completion_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_requirements,
        jsonb_object_agg(status, status_count) as by_status,
        jsonb_object_agg(priority, priority_count) as by_priority,
        jsonb_object_agg(requirement_type, type_count) as by_type,
        ROUND(
            (COUNT(*) FILTER (WHERE status IN ('implemented', 'tested', 'deployed', 'verified'))::DECIMAL / 
             NULLIF(COUNT(*), 0) * 100), 2
        ) as completion_percentage
    FROM (
        SELECT 
            status,
            priority,
            requirement_type,
            COUNT(*) OVER (PARTITION BY status) as status_count,
            COUNT(*) OVER (PARTITION BY priority) as priority_count,
            COUNT(*) OVER (PARTITION BY requirement_type) as type_count
        FROM requirements 
        WHERE session_id = session_uuid
    ) stats;
END;
$$ LANGUAGE plpgsql;

-- Function to get deployment statistics
CREATE OR REPLACE FUNCTION get_deployment_stats(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_deployments BIGINT,
    successful_deployments BIGINT,
    failed_deployments BIGINT,
    avg_deployment_duration_ms NUMERIC,
    deployments_by_environment JSONB,
    success_rate NUMERIC,
    avg_build_time_ms NUMERIC,
    most_deployed_environment TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH deployment_stats AS (
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN de.status = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN de.status = 'failed' THEN 1 ELSE 0 END) as failed,
            AVG(de.duration_ms) as avg_duration,
            AVG((de.performance_metrics->>'build_time_ms')::numeric) as avg_build_time
        FROM deployment_executions de
        WHERE de.workspace_id = p_workspace_id
        AND de.created_at >= now() - (p_days || ' days')::interval
    ),
    env_stats AS (
        SELECT 
            dp.target_environment,
            COUNT(*) as deployment_count
        FROM deployment_executions de
        JOIN deployment_plans dp ON de.deployment_plan_id = dp.id
        WHERE de.workspace_id = p_workspace_id
        AND de.created_at >= now() - (p_days || ' days')::interval
        GROUP BY dp.target_environment
    )
    SELECT 
        ds.total,
        ds.successful,
        ds.failed,
        ds.avg_duration,
        (SELECT jsonb_object_agg(target_environment, deployment_count) FROM env_stats) as env_breakdown,
        CASE 
            WHEN ds.total > 0 THEN (ds.successful::numeric / ds.total::numeric * 100)
            ELSE 0
        END as success_rate,
        ds.avg_build_time,
        (SELECT target_environment FROM env_stats ORDER BY deployment_count DESC LIMIT 1) as most_deployed
    FROM deployment_stats ds;
END;
$$ LANGUAGE plpgsql;

-- Function to get active deployments
CREATE OR REPLACE FUNCTION get_active_deployments(p_workspace_id UUID)
RETURNS TABLE (
    execution_id TEXT,
    deployment_plan_id TEXT,
    target_environment TEXT,
    status TEXT,
    current_step TEXT,
    start_time TIMESTAMPTZ,
    duration_minutes NUMERIC,
    deployment_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.deployment_plan_id,
        dp.target_environment,
        de.status,
        de.current_step,
        de.start_time,
        EXTRACT(EPOCH FROM (now() - de.start_time)) / 60 as duration_minutes,
        de.deployment_url
    FROM deployment_executions de
    JOIN deployment_plans dp ON de.deployment_plan_id = dp.id
    WHERE de.workspace_id = p_workspace_id
    AND de.status IN ('pending', 'running')
    ORDER BY de.start_time DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get error recovery statistics
CREATE OR REPLACE FUNCTION get_error_recovery_stats(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_incidents BIGINT,
    resolved_incidents BIGINT,
    recovery_attempts BIGINT,
    successful_recoveries BIGINT,
    avg_recovery_duration_ms NUMERIC,
    most_common_incident_type TEXT,
    recovery_success_rate NUMERIC,
    avg_downtime_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH incident_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(resolved_at) as resolved,
            AVG(EXTRACT(epoch FROM (COALESCE(resolved_at, now()) - occurred_at)) / 60) as avg_downtime
        FROM sandbox_error_incidents
        WHERE workspace_id = p_workspace_id
        AND occurred_at >= now() - (p_days || ' days')::interval
    ),
    recovery_stats AS (
        SELECT 
            COUNT(*) as attempts,
            COUNT(CASE WHEN success THEN 1 END) as successful,
            AVG(duration_ms) as avg_duration
        FROM sandbox_recovery_executions
        WHERE workspace_id = p_workspace_id
        AND started_at >= now() - (p_days || ' days')::interval
    ),
    common_incident AS (
        SELECT 
            incident_type,
            COUNT(*) as count
        FROM sandbox_error_incidents
        WHERE workspace_id = p_workspace_id
        AND occurred_at >= now() - (p_days || ' days')::interval
        GROUP BY incident_type
        ORDER BY count DESC
        LIMIT 1
    )
    SELECT 
        i.total,
        i.resolved,
        r.attempts,
        r.successful,
        r.avg_duration,
        c.incident_type,
        CASE 
            WHEN r.attempts > 0 THEN (r.successful::numeric / r.attempts::numeric * 100)
            ELSE NULL
        END as success_rate,
        i.avg_downtime
    FROM incident_stats i
    CROSS JOIN recovery_stats r
    LEFT JOIN common_incident c ON true;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Function to cleanup old deployment data
CREATE OR REPLACE FUNCTION cleanup_old_deployment_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old deployment logs
    DELETE FROM deployment_logs 
    WHERE timestamp < now() - (days_to_keep || ' days')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old deployment metrics
    DELETE FROM deployment_metrics
    WHERE recorded_at < now() - (days_to_keep || ' days')::interval;
    
    -- Delete old resolved alerts  
    DELETE FROM deployment_alerts
    WHERE resolved = true 
    AND resolved_at < now() - (days_to_keep || ' days')::interval;
    
    -- Delete old deployment executions (keep successful ones longer)
    DELETE FROM deployment_executions
    WHERE created_at < now() - (days_to_keep || ' days')::interval
    AND status IN ('failed', 'cancelled');
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old error recovery data
CREATE OR REPLACE FUNCTION cleanup_old_error_recovery_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete old resolved incidents
    DELETE FROM sandbox_error_incidents 
    WHERE resolved_at IS NOT NULL 
    AND resolved_at < now() - (days_to_keep || ' days')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old successful recovery executions
    DELETE FROM sandbox_recovery_executions
    WHERE success = true 
    AND completed_at < now() - (days_to_keep || ' days')::interval;
    
    -- Delete old health monitoring records for inactive sessions
    DELETE FROM sandbox_health_monitoring
    WHERE monitoring_active = false
    AND updated_at < now() - (days_to_keep || ' days')::interval;
    
    -- Reset circuit breakers that have been inactive
    UPDATE sandbox_circuit_breakers
    SET breaker_state = 'closed', failure_count = 0
    WHERE state_changed_at < now() - (days_to_keep || ' days')::interval
    AND breaker_state = 'open';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger deployment alert
CREATE OR REPLACE FUNCTION trigger_deployment_alert(
    p_workspace_id UUID,
    p_environment_name TEXT,
    p_alert_type TEXT,
    p_alert_level TEXT,
    p_message TEXT,
    p_execution_id TEXT DEFAULT NULL,
    p_deployment_url TEXT DEFAULT NULL,
    p_alert_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    alert_id UUID;
BEGIN
    INSERT INTO deployment_alerts (
        workspace_id,
        environment_name,
        alert_type,
        alert_level,
        message,
        deployment_execution_id,
        deployment_url,
        alert_data
    )
    VALUES (
        p_workspace_id,
        p_environment_name,
        p_alert_type,
        p_alert_level,
        p_message,
        p_execution_id,
        p_deployment_url,
        p_alert_data
    )
    RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to migrate existing requirements to new structure
CREATE OR REPLACE FUNCTION migrate_existing_requirements()
RETURNS INTEGER AS $$
DECLARE
    req_count INTEGER := 0;
BEGIN
    -- Update existing requirements with default values for new columns
    UPDATE requirements 
    SET 
        discovered_by = 'user',
        last_updated_by = 'user',
        workflow_phase = 1,
        source = 'manual_entry'
    WHERE discovered_by IS NULL;
    
    GET DIAGNOSTICS req_count = ROW_COUNT;
    RETURN req_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INITIAL DATA SETUP
-- =============================================================================

-- Insert default recovery strategies for all existing workspaces
INSERT INTO recovery_strategy_configs (
    workspace_id, strategy_name, priority, applicable_failure_types, 
    max_attempts, timeout_ms, requires_new_sandbox, preserves_context
)
SELECT 
    w.id,
    strategy.name,
    strategy.priority,
    strategy.failure_types,
    strategy.max_attempts,
    strategy.timeout_ms,
    strategy.requires_new,
    strategy.preserves_context
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('sandbox_restart', 1, ARRAY['connection_timeout', 'command_failure'], 3, 30000, false, true),
        ('context_preserving_recreation', 2, ARRAY['sandbox_terminated', 'resource_exhaustion'], 2, 60000, true, true),
        ('clean_slate_recovery', 3, ARRAY['unknown', 'resource_exhaustion'], 1, 90000, true, false),
        ('backup_failover', 4, ARRAY['sandbox_terminated', 'connection_timeout'], 1, 45000, true, true)
) AS strategy(name, priority, failure_types, max_attempts, timeout_ms, requires_new, preserves_context)
ON CONFLICT (workspace_id, strategy_name) DO NOTHING;

-- Insert default requirement templates for system use
INSERT INTO requirement_templates (
    workspace_id, template_name, template_description, requirement_type,
    title_template, description_template, acceptance_criteria_template,
    user_story_template, is_system_template
) 
SELECT 
    w.id,
    template.name,
    template.description,
    template.req_type,
    template.title_tmpl,
    template.desc_tmpl,
    template.criteria_tmpl,
    template.story_tmpl,
    true
FROM workspaces w
CROSS JOIN (
    VALUES 
    (
        'User Authentication',
        'Template for user authentication requirements',
        'functional',
        'User {action} - {specific_requirement}',
        'As a user, I need to be able to {action} so that {benefit}. This requirement covers {scope} and must ensure {security_considerations}.',
        ARRAY[
            'User can successfully {action} with valid credentials',
            'System displays appropriate error messages for invalid attempts',
            'Security measures are in place to prevent unauthorized access',
            'User session is properly managed'
        ],
        'As a {user_type}, I want to {action} so that {benefit}'
    ),
    (
        'Data Management',
        'Template for data CRUD operations',
        'functional',
        'Data {operation} - {entity}',
        'The system must allow users to {operation} {entity} data. This includes {specific_actions} with proper validation and error handling.',
        ARRAY[
            'User can {operation} {entity} with valid data',
            'System validates all input data',
            'Appropriate error messages are displayed for invalid data',
            'Data is properly stored/retrieved/updated/deleted',
            'Operation is logged for audit purposes'
        ],
        'As a {user_type}, I want to {operation} {entity} so that {benefit}'
    ),
    (
        'Performance Requirement',
        'Template for performance and scalability requirements',
        'non-functional',
        'Performance - {specific_area}',
        'The {component/feature} must meet the following performance criteria: {specific_requirements}. This ensures optimal user experience and system scalability.',
        ARRAY[
            'Response time is under {time_limit} for {percentage}% of requests',
            'System can handle {concurrent_users} concurrent users',
            'Database queries complete within {time_limit}',
            'Page load times are under {time_limit}',
            'API endpoints respond within {time_limit}'
        ],
        'As a {user_type}, I need {feature} to perform {performance_criteria} so that {user_experience_benefit}'
    )
) AS template(name, description, req_type, title_tmpl, desc_tmpl, criteria_tmpl, story_tmpl)
ON CONFLICT (workspace_id, template_name) DO NOTHING;

-- =============================================================================
-- DOCUMENTATION AND COMMENTS
-- =============================================================================

-- Table documentation
COMMENT ON TABLE workspaces IS 'Multi-tenant workspace isolation - the root of all tenant data';
COMMENT ON TABLE workspace_members IS 'User membership and roles within workspaces';
COMMENT ON TABLE projects IS 'Logical groupings of development sessions within workspaces';
COMMENT ON TABLE sessions IS 'Individual app development sessions with E2B sandbox integration';
COMMENT ON TABLE workflow_sessions IS 'Tracks the 7-phase development workflow progress for each session';
COMMENT ON TABLE workflow_artifacts IS 'Cross-phase artifacts and dependencies for workflow coordination';
COMMENT ON TABLE requirements IS 'Comprehensive requirements management with full lifecycle tracking';
COMMENT ON TABLE requirement_changes IS 'Audit trail for all requirement modifications';
COMMENT ON TABLE requirement_comments IS 'Collaborative discussion and feedback on requirements';
COMMENT ON TABLE requirement_attachments IS 'Supporting documents and files for requirements';
COMMENT ON TABLE requirement_templates IS 'Reusable templates for common requirement patterns';
COMMENT ON TABLE requirement_metrics IS 'Analytics and metrics tracking for requirements';
COMMENT ON TABLE technical_specifications IS 'Technical architecture and design specifications';
COMMENT ON TABLE implementation_tasks IS 'Development tasks with compliance tracking and iteration support';
COMMENT ON TABLE chat_messages IS 'Chat conversation history between user and Claude';
COMMENT ON TABLE claude_interactions IS 'Enhanced tracking of Claude Code SDK operations and subagent executions';
COMMENT ON TABLE subagent_contexts IS 'Stores conversation context for Claude Code subagents to enable context preservation across invocations';
COMMENT ON TABLE subagent_artifacts IS 'Stores artifacts generated by subagents for cross-phase reference and coordination';
COMMENT ON TABLE generated_files IS 'Tracks all files generated by Claude with compliance scoring';
COMMENT ON TABLE file_events IS 'Real-time tracking of file changes in E2B sandbox environments';
COMMENT ON TABLE development_sessions IS 'Tracks overall development progress for Phase 4 with compliance monitoring';
COMMENT ON TABLE development_iterations IS 'Records individual development iterations with compliance feedback';
COMMENT ON TABLE compliance_reports IS 'Detailed PRIA compliance reports for development iterations';
COMMENT ON TABLE github_repositories IS 'GitHub repository integration and synchronization tracking';
COMMENT ON TABLE github_sync_status IS 'GitHub code synchronization status and history';
COMMENT ON TABLE github_auth IS 'Encrypted GitHub authentication tokens and user information';
COMMENT ON TABLE deployment_environments IS 'Deployment environment configurations (dev, staging, production)';
COMMENT ON TABLE deployment_plans IS 'Phase 7 deployment plans with rollback strategies and monitoring';
COMMENT ON TABLE deployment_executions IS 'Live deployment execution tracking with performance metrics';
COMMENT ON TABLE deployment_logs IS 'Detailed deployment execution logs and step-by-step progress';
COMMENT ON TABLE deployment_approvals IS 'Approval workflow for production deployments';
COMMENT ON TABLE deployment_metrics IS 'Performance and health metrics from live deployments';
COMMENT ON TABLE deployment_alerts IS 'Monitoring alerts and incident management for deployments';
COMMENT ON TABLE sandbox_health_monitoring IS 'E2B sandbox health monitoring and heartbeat tracking';
COMMENT ON TABLE sandbox_error_incidents IS 'Error incident tracking and categorization';
COMMENT ON TABLE sandbox_recovery_executions IS 'Sandbox recovery execution tracking with context preservation';
COMMENT ON TABLE sandbox_circuit_breakers IS 'Circuit breaker pattern implementation for sandbox stability';
COMMENT ON TABLE recovery_strategy_configs IS 'Configurable recovery strategies for different failure types';

-- Key column documentation
COMMENT ON COLUMN requirements.requirement_number IS 'Auto-generated unique identifier (REQ-001, REQ-002, etc.)';
COMMENT ON COLUMN requirements.workflow_phase IS 'Which workflow phase (1-7) this requirement was discovered in';
COMMENT ON COLUMN requirements.discovered_by IS 'Who discovered this requirement: user, claude, or system';
COMMENT ON COLUMN subagent_contexts.agent_name IS 'Name of the subagent (e.g., requirements-analyst, system-architect, code-generator)';
COMMENT ON COLUMN subagent_contexts.phase_number IS 'Workflow phase number (1-7) when context was saved';
COMMENT ON COLUMN subagent_contexts.context_data IS 'Preserved conversation context and state for the subagent';
COMMENT ON COLUMN subagent_artifacts.source_agent IS 'Name of the subagent that generated this artifact';
COMMENT ON COLUMN subagent_artifacts.target_agent IS 'Optional: Specific subagent this artifact is intended for';
COMMENT ON COLUMN subagent_artifacts.reference_key IS 'Unique key for @agent-name referencing in prompts';
COMMENT ON COLUMN implementation_tasks.compliance_score IS 'PRIA compliance score (0-100) for this task';
COMMENT ON COLUMN generated_files.compliance_issues IS 'Number of compliance issues found in this file';
COMMENT ON COLUMN github_auth.access_token IS 'Encrypted GitHub access token using AES-256-GCM';
COMMENT ON COLUMN github_auth.refresh_token IS 'Encrypted GitHub refresh token using AES-256-GCM';
COMMENT ON COLUMN deployment_plans.rollback_plan IS 'Automated rollback strategy and trigger conditions';
COMMENT ON COLUMN deployment_executions.vercel_deployment_id IS 'Vercel deployment ID for tracking live deployments';
COMMENT ON COLUMN sandbox_circuit_breakers.breaker_state IS 'Circuit breaker state: closed (normal), open (failing), half_open (testing)';
COMMENT ON COLUMN recovery_strategy_configs.preserves_context IS 'Whether this recovery strategy maintains session context';

-- =============================================================================
-- ADDITIONAL MISSING TABLES FOR APPLICATION COMPATIBILITY
-- =============================================================================

-- Webhook Events (for GitHub webhook processing)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    source TEXT NOT NULL DEFAULT 'github',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Notifications (for user notifications)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    action_label TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- GitHub Events (for GitHub integration)
CREATE TABLE github_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    repository_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Performance Metrics (for monitoring)
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT,
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Performance Alerts (for monitoring alerts)
CREATE TABLE performance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    alert_name TEXT NOT NULL,
    alert_condition TEXT NOT NULL,
    alert_threshold NUMERIC NOT NULL,
    current_value NUMERIC,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'suppressed')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    triggered_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- System Metrics (for overall system monitoring)
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit TEXT,
    component TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'production',
    recorded_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Claude Execution Contexts (for Claude SDK execution tracking)
CREATE TABLE claude_execution_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    execution_id TEXT NOT NULL,
    context_type TEXT NOT NULL CHECK (context_type IN ('query', 'stream', 'tool_use', 'function_call')),
    input_data JSONB NOT NULL,
    output_data JSONB,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    error_details JSONB,
    metadata JSONB DEFAULT '{}'
);

-- Security Audit Reports (for validation)
CREATE TABLE security_audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    audit_type TEXT NOT NULL CHECK (audit_type IN ('automated', 'manual', 'compliance', 'vulnerability')),
    scan_results JSONB NOT NULL,
    vulnerabilities_found INTEGER DEFAULT 0,
    compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    recommendations TEXT[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
    scanned_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Code Review Reports (for code validation)
CREATE TABLE code_review_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    review_type TEXT NOT NULL CHECK (review_type IN ('automated', 'manual', 'ai-assisted')),
    files_reviewed TEXT[] NOT NULL,
    issues_found INTEGER DEFAULT 0,
    code_quality_score INTEGER CHECK (code_quality_score >= 0 AND code_quality_score <= 100),
    review_findings JSONB NOT NULL,
    suggestions TEXT[],
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'rejected')),
    reviewed_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Deployment Readiness Reports (for deployment validation)
CREATE TABLE deployment_readiness_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    readiness_checks JSONB NOT NULL,
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    blocking_issues TEXT[],
    warnings TEXT[],
    ready_for_deployment BOOLEAN NOT NULL DEFAULT false,
    deployment_recommendations TEXT[],
    checked_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Test Execution Sessions (for testing)
CREATE TABLE test_execution_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'e2e', 'performance', 'security')),
    test_environment TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    skipped_tests INTEGER DEFAULT 0,
    coverage_percentage DECIMAL(5,2),
    metadata JSONB DEFAULT '{}'
);

-- Test Suites (for test organization)
CREATE TABLE test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    suite_name TEXT NOT NULL,
    suite_description TEXT,
    test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'e2e', 'performance', 'security')),
    test_files TEXT[],
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Test Cases (for individual test tracking)
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_description TEXT,
    test_file_path TEXT,
    test_function_name TEXT,
    expected_result TEXT,
    actual_result TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'skipped', 'error')),
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_run_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Test Execution Results (for test results)
CREATE TABLE test_execution_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    execution_session_id UUID NOT NULL REFERENCES test_execution_sessions(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
    execution_time_ms INTEGER,
    error_message TEXT,
    stack_trace TEXT,
    output_logs TEXT,
    executed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Sprints (for sprint planning)
CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sprint_name TEXT NOT NULL,
    sprint_description TEXT,
    sprint_number INTEGER,
    start_date DATE,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    goals TEXT[],
    capacity_hours INTEGER,
    velocity_points INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Milestones (for milestone tracking)
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    milestone_name TEXT NOT NULL,
    milestone_description TEXT,
    target_date DATE,
    achieved_date DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'achieved', 'missed', 'cancelled')),
    success_criteria TEXT[],
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- Session Snapshots (for session recovery)
CREATE TABLE session_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('manual', 'automatic', 'error_recovery', 'checkpoint')),
    snapshot_data JSONB NOT NULL,
    file_contents JSONB DEFAULT '{}',
    environment_state JSONB DEFAULT '{}',
    requirements_snapshot JSONB DEFAULT '{}',
    workflow_state JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- BACKWARD COMPATIBILITY ALIASES AND VIEWS
-- =============================================================================

-- Alias for github_repositories (some code uses github_repos)
CREATE VIEW github_repos AS 
SELECT * FROM github_repositories;

-- Note: Multiple table pairs exist as separate tables instead of views
-- to handle existing database conflicts where these already exist as tables:
-- - technical_specs & technical_specifications 
-- - claude_operations & claude_interactions

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR NEW TABLES
-- =============================================================================

-- Enable RLS for all new tables
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_execution_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_readiness_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_execution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_execution_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_snapshots ENABLE ROW LEVEL SECURITY;

-- Create workspace isolation policies for all new tables
CREATE POLICY "workspace_isolation_webhook_events" ON webhook_events
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_notifications" ON notifications
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_github_events" ON github_events
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_performance_metrics" ON performance_metrics
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_performance_alerts" ON performance_alerts
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_claude_execution_contexts" ON claude_execution_contexts  
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_security_audit_reports" ON security_audit_reports
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_code_review_reports" ON code_review_reports
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_deployment_readiness_reports" ON deployment_readiness_reports
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_test_execution_sessions" ON test_execution_sessions
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_test_suites" ON test_suites
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_test_cases" ON test_cases
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_test_execution_results" ON test_execution_results
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_sprints" ON sprints
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_milestones" ON milestones
    FOR ALL USING (workspace_id = get_user_workspace_id());

CREATE POLICY "workspace_isolation_session_snapshots" ON session_snapshots
    FOR ALL USING (workspace_id = get_user_workspace_id());

-- System metrics doesn't need workspace isolation (global system metrics)
-- But we still enable RLS for potential future filtering
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_metrics_access" ON system_metrics
    FOR ALL USING (true); -- Global access for now

-- =============================================================================
-- INDEXES FOR NEW TABLES PERFORMANCE
-- =============================================================================

-- Webhook Events indexes
CREATE INDEX idx_webhook_events_workspace_session ON webhook_events(workspace_id, session_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status, created_at);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type, created_at);

-- Notifications indexes  
CREATE INDEX idx_notifications_workspace_user ON notifications(workspace_id, user_id);
CREATE INDEX idx_notifications_unread ON notifications(workspace_id, is_read, created_at);

-- GitHub Events indexes
CREATE INDEX idx_github_events_workspace_session ON github_events(workspace_id, session_id);
CREATE INDEX idx_github_events_processed ON github_events(processed, created_at);

-- Performance Metrics indexes
CREATE INDEX idx_performance_metrics_workspace_session ON performance_metrics(workspace_id, session_id);
CREATE INDEX idx_performance_metrics_name_time ON performance_metrics(metric_name, recorded_at);

-- Performance Alerts indexes
CREATE INDEX idx_performance_alerts_workspace_status ON performance_alerts(workspace_id, status);
CREATE INDEX idx_performance_alerts_severity ON performance_alerts(severity, triggered_at);

-- Claude Execution Contexts indexes
CREATE INDEX idx_claude_execution_contexts_workspace_session ON claude_execution_contexts(workspace_id, session_id);
CREATE INDEX idx_claude_execution_contexts_status ON claude_execution_contexts(status, started_at);

-- Security Audit Reports indexes
CREATE INDEX idx_security_audit_reports_workspace_session ON security_audit_reports(workspace_id, session_id);
CREATE INDEX idx_security_audit_reports_risk_level ON security_audit_reports(risk_level, scanned_at);

-- Code Review Reports indexes
CREATE INDEX idx_code_review_reports_workspace_session ON code_review_reports(workspace_id, session_id);
CREATE INDEX idx_code_review_reports_status ON code_review_reports(status, reviewed_at);

-- Test related indexes
CREATE INDEX idx_test_execution_sessions_workspace_session ON test_execution_sessions(workspace_id, session_id);
CREATE INDEX idx_test_suites_workspace_session ON test_suites(workspace_id, session_id);
CREATE INDEX idx_test_cases_suite ON test_cases(suite_id, status);
CREATE INDEX idx_test_execution_results_session ON test_execution_results(execution_session_id, status);

-- Sprint and Milestone indexes
CREATE INDEX idx_sprints_workspace_session ON sprints(workspace_id, session_id);
CREATE INDEX idx_sprints_status_dates ON sprints(status, start_date, end_date);
CREATE INDEX idx_milestones_workspace_session ON milestones(workspace_id, session_id);
CREATE INDEX idx_milestones_status_date ON milestones(status, target_date);

-- Session Snapshots indexes
CREATE INDEX idx_session_snapshots_workspace_session ON session_snapshots(workspace_id, session_id);
CREATE INDEX idx_session_snapshots_type_time ON session_snapshots(snapshot_type, created_at);

-- =============================================================================
-- GRANTS AND PERMISSIONS
-- =============================================================================

-- Grant schema usage to authenticated users
GRANT USAGE ON SCHEMA app_builder TO authenticated;

-- Grant permissions to authenticated users on app_builder schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app_builder TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app_builder TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_builder TO authenticated;

-- Grant permissions on specific views in app_builder schema
GRANT SELECT ON app_builder.github_repos TO authenticated;
GRANT SELECT ON app_builder.technical_specs TO authenticated;
GRANT SELECT ON app_builder.technical_specifications TO authenticated;
GRANT SELECT ON app_builder.development_tasks TO authenticated;
GRANT SELECT ON app_builder.claude_operations TO authenticated;
GRANT SELECT ON app_builder.claude_interactions TO authenticated;

-- =============================================================================
-- SCHEMA COMPLETE
-- =============================================================================

-- Run any existing data migration
SELECT app_builder.migrate_existing_requirements();

-- Reset search path to default
SET search_path = public;

-- Schema validation and completion message
DO $$
BEGIN
    RAISE NOTICE 'PRIA Complete Database Schema deployed successfully!';
    RAISE NOTICE 'Version: 1.0.0 - APP_BUILDER SCHEMA';
    RAISE NOTICE 'Schema: app_builder (isolated from public schema)';
    RAISE NOTICE 'Consolidated from 4 different locations and fixed all syntax issues';
    RAISE NOTICE 'Features: Full multi-tenant isolation, 7-phase workflow, comprehensive requirements management, Claude SDK integration, deployment pipeline, error recovery';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT: Application code must be updated to use app_builder schema:';
    RAISE NOTICE '   - Change: supabase.from(''table_name'') ';
    RAISE NOTICE '   - To: supabase.from(''app_builder.table_name'')';
    RAISE NOTICE '   - Or configure Supabase client with schema: ''app_builder''';
END
$$;