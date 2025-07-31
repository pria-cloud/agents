// Database types for PRIA App Builder
export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: Workspace
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Workspace, 'id' | 'created_at'>>
      }
      projects: {
        Row: Project
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Project, 'id' | 'created_at' | 'workspace_id'>>
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Session, 'id' | 'created_at' | 'workspace_id'>>
      }
      requirements: {
        Row: Requirement
        Insert: Omit<Requirement, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Requirement, 'id' | 'created_at' | 'workspace_id'>>
      }
      technical_specs: {
        Row: TechnicalSpec
        Insert: Omit<TechnicalSpec, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TechnicalSpec, 'id' | 'created_at' | 'workspace_id'>>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ChatMessage, 'id' | 'created_at' | 'workspace_id'>>
      }
      claude_operations: {
        Row: ClaudeOperation
        Insert: Omit<ClaudeOperation, 'id' | 'started_at'>
        Update: Partial<Omit<ClaudeOperation, 'id' | 'started_at' | 'workspace_id'>>
      }
      generated_files: {
        Row: GeneratedFile
        Insert: Omit<GeneratedFile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<GeneratedFile, 'id' | 'created_at' | 'workspace_id'>>
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Omit<WorkspaceMember, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WorkspaceMember, 'id' | 'created_at' | 'workspace_id' | 'user_id'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_workspace_id: {
        Args: {}
        Returns: string
      }
      create_workspace: {
        Args: { workspace_name: string }
        Returns: string
      }
      add_workspace_member: {
        Args: { workspace_id: string; user_id: string; member_role?: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Core entity types
export interface Workspace {
  id: string
  name: string
  owner_id: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  status: 'active' | 'archived' | 'deleted'
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  workspace_id: string
  project_id: string
  name: string
  description: string | null
  status: 'active' | 'paused' | 'completed' | 'archived'
  github_repo_url: string | null
  github_branch: string | null
  deployment_url: string | null
  e2b_sandbox_id: string | null
  target_directory: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Requirement {
  id: string
  workspace_id: string
  session_id: string
  type: 'functional' | 'non-functional' | 'ui-ux' | 'technical' | 'business'
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  title: string
  description: string
  acceptance_criteria: string[]
  dependencies: string[]
  estimated_effort: 'small' | 'medium' | 'large' | null
  tags: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TechnicalSpec {
  id: string
  workspace_id: string
  session_id: string
  requirement_id: string | null
  type: 'architecture' | 'component' | 'api' | 'database' | 'deployment' | 'testing'
  title: string
  content: Record<string, any>
  status: 'draft' | 'approved' | 'implemented' | 'outdated'
  version: number
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  workspace_id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, any>
  created_at: string
}

export interface ClaudeOperation {
  id: string
  workspace_id: string
  session_id: string
  operation_type: 'requirements_analysis' | 'code_generation' | 'file_modification' | 'build_execution' | 'test_execution' | 'deployment'
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled'
  input_data: Record<string, any> | null
  output_data: Record<string, any> | null
  error_details: Record<string, any> | null
  metadata: Record<string, any>
  started_at: string
  completed_at: string | null
}

export interface GeneratedFile {
  id: string
  workspace_id: string
  session_id: string
  operation_id: string | null
  file_path: string
  file_type: string
  content_hash: string | null
  size_bytes: number | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  permissions: Record<string, any>
  created_at: string
  updated_at: string
}

// Utility types
export type RequirementWithSpecs = Requirement & {
  technical_specs: TechnicalSpec[]
}

export type SessionWithCounts = Session & {
  requirements_count: number
  messages_count: number
  files_count: number
}

export type ProjectWithSessions = Project & {
  sessions: Session[]
}