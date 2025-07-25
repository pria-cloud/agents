// Database types generated from Supabase schema
// These types ensure type safety across the application

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          status: 'active' | 'paused' | 'archived'
          github_repo_url: string | null
          github_branch: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          github_repo_url?: string | null
          github_branch?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'paused' | 'archived'
          github_repo_url?: string | null
          github_branch?: string
          created_at?: string
          updated_at?: string
        }
      }
      requirements: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          title: string
          description: string
          priority: 'low' | 'medium' | 'high'
          status: 'pending' | 'in-progress' | 'completed'
          category: string | null
          acceptance_criteria: any[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          title: string
          description: string
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in-progress' | 'completed'
          category?: string | null
          acceptance_criteria?: any[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          title?: string
          description?: string
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in-progress' | 'completed'
          category?: string | null
          acceptance_criteria?: any[]
          created_at?: string
          updated_at?: string
        }
      }
      technical_specs: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          requirement_id: string | null
          category: string
          title: string
          description: string
          implementation_details: string | null
          code_examples: any[]
          dependencies: any[]
          generated_by_claude: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          requirement_id?: string | null
          category: string
          title: string
          description: string
          implementation_details?: string | null
          code_examples?: any[]
          dependencies?: any[]
          generated_by_claude?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          requirement_id?: string | null
          category?: string
          title?: string
          description?: string
          implementation_details?: string | null
          code_examples?: any[]
          dependencies?: any[]
          generated_by_claude?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workflow_steps: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          step_type: 'start' | 'action' | 'decision' | 'end'
          title: string
          description: string | null
          position_x: number
          position_y: number
          configuration: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          step_type: 'start' | 'action' | 'decision' | 'end'
          title: string
          description?: string | null
          position_x?: number
          position_y?: number
          configuration?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          step_type?: 'start' | 'action' | 'decision' | 'end'
          title?: string
          description?: string | null
          position_x?: number
          position_y?: number
          configuration?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      workflow_connections: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          from_step_id: string
          to_step_id: string
          label: string | null
          condition_expression: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          from_step_id: string
          to_step_id: string
          label?: string | null
          condition_expression?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          from_step_id?: string
          to_step_id?: string
          label?: string | null
          condition_expression?: string | null
          created_at?: string
        }
      }
      generated_files: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          file_path: string
          file_type: string | null
          content: string | null
          github_commit_sha: string | null
          generated_from_requirement_id: string | null
          created_by_claude: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          file_path: string
          file_type?: string | null
          content?: string | null
          github_commit_sha?: string | null
          generated_from_requirement_id?: string | null
          created_by_claude?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          file_path?: string
          file_type?: string | null
          content?: string | null
          github_commit_sha?: string | null
          generated_from_requirement_id?: string | null
          created_by_claude?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      claude_operations: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          operation_type: string
          input_data: Record<string, any>
          output_data: Record<string, any> | null
          status: 'pending' | 'in-progress' | 'completed' | 'failed'
          error_message: string | null
          execution_time_ms: number | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          operation_type: string
          input_data: Record<string, any>
          output_data?: Record<string, any> | null
          status?: 'pending' | 'in-progress' | 'completed' | 'failed'
          error_message?: string | null
          execution_time_ms?: number | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          operation_type?: string
          input_data?: Record<string, any>
          output_data?: Record<string, any> | null
          status?: 'pending' | 'in-progress' | 'completed' | 'failed'
          error_message?: string | null
          execution_time_ms?: number | null
          created_at?: string
          completed_at?: string | null
        }
      }
      database_schemas: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          table_name: string
          table_description: string | null
          columns_definition: any[]
          relationships: any[]
          indexes: any[]
          generated_sql: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          table_name: string
          table_description?: string | null
          columns_definition?: any[]
          relationships?: any[]
          indexes?: any[]
          generated_sql?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          table_name?: string
          table_description?: string | null
          columns_definition?: any[]
          relationships?: any[]
          indexes?: any[]
          generated_sql?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      api_endpoints: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
          path: string
          summary: string | null
          description: string | null
          parameters: any[]
          responses: any[]
          authentication_required: boolean
          implementation_status: 'planned' | 'generated' | 'implemented' | 'tested'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
          path: string
          summary?: string | null
          description?: string | null
          parameters?: any[]
          responses?: any[]
          authentication_required?: boolean
          implementation_status?: 'planned' | 'generated' | 'implemented' | 'tested'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
          path?: string
          summary?: string | null
          description?: string | null
          parameters?: any[]
          responses?: any[]
          authentication_required?: boolean
          implementation_status?: 'planned' | 'generated' | 'implemented' | 'tested'
          created_at?: string
          updated_at?: string
        }
      }
      session_history: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          event_type: string
          event_title: string
          event_description: string | null
          event_data: Record<string, any>
          changes_summary: Record<string, any>
          performed_by: string
          status: 'success' | 'failed' | 'pending'
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          event_type: string
          event_title: string
          event_description?: string | null
          event_data?: Record<string, any>
          changes_summary?: Record<string, any>
          performed_by?: string
          status?: 'success' | 'failed' | 'pending'
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          event_type?: string
          event_title?: string
          event_description?: string | null
          event_data?: Record<string, any>
          changes_summary?: Record<string, any>
          performed_by?: string
          status?: 'success' | 'failed' | 'pending'
          created_at?: string
        }
      }
      test_cases: {
        Row: {
          id: string
          session_id: string
          workspace_id: string
          test_name: string
          test_type: string
          file_path: string | null
          test_code: string | null
          status: 'pending' | 'passed' | 'failed' | 'running'
          last_run_at: string | null
          execution_time_ms: number | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          workspace_id: string
          test_name: string
          test_type: string
          file_path?: string | null
          test_code?: string | null
          status?: 'pending' | 'passed' | 'failed' | 'running'
          last_run_at?: string | null
          execution_time_ms?: number | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          workspace_id?: string
          test_name?: string
          test_type?: string
          file_path?: string | null
          test_code?: string | null
          status?: 'pending' | 'passed' | 'failed' | 'running'
          last_run_at?: string | null
          execution_time_ms?: number | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type Requirement = Database['public']['Tables']['requirements']['Row']
export type TechnicalSpec = Database['public']['Tables']['technical_specs']['Row']
export type WorkflowStep = Database['public']['Tables']['workflow_steps']['Row']
export type WorkflowConnection = Database['public']['Tables']['workflow_connections']['Row']
export type GeneratedFile = Database['public']['Tables']['generated_files']['Row']
export type ClaudeOperation = Database['public']['Tables']['claude_operations']['Row']
export type DatabaseSchema = Database['public']['Tables']['database_schemas']['Row']
export type APIEndpoint = Database['public']['Tables']['api_endpoints']['Row']
export type SessionHistory = Database['public']['Tables']['session_history']['Row']
export type TestCase = Database['public']['Tables']['test_cases']['Row']

// Insert types
export type WorkspaceInsert = Database['public']['Tables']['workspaces']['Insert']
export type SessionInsert = Database['public']['Tables']['sessions']['Insert']
export type RequirementInsert = Database['public']['Tables']['requirements']['Insert']
export type TechnicalSpecInsert = Database['public']['Tables']['technical_specs']['Insert']
export type WorkflowStepInsert = Database['public']['Tables']['workflow_steps']['Insert']
export type WorkflowConnectionInsert = Database['public']['Tables']['workflow_connections']['Insert']
export type GeneratedFileInsert = Database['public']['Tables']['generated_files']['Insert']
export type ClaudeOperationInsert = Database['public']['Tables']['claude_operations']['Insert']
export type DatabaseSchemaInsert = Database['public']['Tables']['database_schemas']['Insert']
export type APIEndpointInsert = Database['public']['Tables']['api_endpoints']['Insert']
export type SessionHistoryInsert = Database['public']['Tables']['session_history']['Insert']
export type TestCaseInsert = Database['public']['Tables']['test_cases']['Insert']

// Update types
export type WorkspaceUpdate = Database['public']['Tables']['workspaces']['Update']
export type SessionUpdate = Database['public']['Tables']['sessions']['Update']
export type RequirementUpdate = Database['public']['Tables']['requirements']['Update']
export type TechnicalSpecUpdate = Database['public']['Tables']['technical_specs']['Update']
export type WorkflowStepUpdate = Database['public']['Tables']['workflow_steps']['Update']
export type WorkflowConnectionUpdate = Database['public']['Tables']['workflow_connections']['Update']
export type GeneratedFileUpdate = Database['public']['Tables']['generated_files']['Update']
export type ClaudeOperationUpdate = Database['public']['Tables']['claude_operations']['Update']
export type DatabaseSchemaUpdate = Database['public']['Tables']['database_schemas']['Update']
export type APIEndpointUpdate = Database['public']['Tables']['api_endpoints']['Update']
export type SessionHistoryUpdate = Database['public']['Tables']['session_history']['Update']
export type TestCaseUpdate = Database['public']['Tables']['test_cases']['Update']