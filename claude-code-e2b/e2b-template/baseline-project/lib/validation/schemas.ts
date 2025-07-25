import { z } from 'zod'

// Common schemas
export const UUIDSchema = z.string().uuid()
export const EmailSchema = z.string().email()
export const URLSchema = z.string().url()

// Workspace schemas
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional()
})

// Session schemas
export const CreateSessionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workspace_id: UUIDSchema
})

export const UpdateSessionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  github_repo_url: URLSchema.optional(),
  github_branch: z.string().max(100).optional()
})

// Requirement schemas
export const CreateRequirementSchema = z.object({
  session_id: UUIDSchema,
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  category: z.string().max(100).optional(),
  acceptance_criteria: z.array(z.string()).default([])
})

export const UpdateRequirementSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
  category: z.string().max(100).optional(),
  acceptance_criteria: z.array(z.string()).optional()
})

// Technical specification schemas
export const CreateTechnicalSpecSchema = z.object({
  session_id: UUIDSchema,
  requirement_id: UUIDSchema.optional(),
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  implementation_details: z.string().optional(),
  code_examples: z.array(z.object({
    language: z.string(),
    code: z.string(),
    description: z.string()
  })).default([]),
  dependencies: z.array(z.string()).default([])
})

// Workflow schemas
export const CreateWorkflowStepSchema = z.object({
  session_id: UUIDSchema,
  step_type: z.enum(['start', 'action', 'decision', 'end']),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  position_x: z.number().int().default(0),
  position_y: z.number().int().default(0),
  configuration: z.record(z.any()).default({})
})

export const CreateWorkflowConnectionSchema = z.object({
  session_id: UUIDSchema,
  from_step_id: UUIDSchema,
  to_step_id: UUIDSchema,
  label: z.string().max(100).optional(),
  condition_expression: z.string().optional()
})

export const UpdateWorkflowStepSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  position_x: z.number().int().optional(),
  position_y: z.number().int().optional(),
  configuration: z.record(z.any()).optional()
})

// Generated file schemas
export const CreateGeneratedFileSchema = z.object({
  session_id: UUIDSchema,
  file_path: z.string().min(1),
  file_type: z.string().max(50).optional(),
  content: z.string(),
  generated_from_requirement_id: UUIDSchema.optional()
})

export const UpdateGeneratedFileSchema = z.object({
  content: z.string().optional(),
  file_type: z.string().max(50).optional(),
  github_commit_sha: z.string().max(40).optional()
})

// Claude operation schemas
export const CreateClaudeOperationSchema = z.object({
  session_id: UUIDSchema,
  operation_type: z.string().min(1).max(100),
  input_data: z.record(z.any()),
  output_data: z.record(z.any()).optional(),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed']).default('pending')
})

// Code generation schemas
export const CodeGenerationRequestSchema = z.object({
  session_id: UUIDSchema,
  requirements: z.array(UUIDSchema).min(1),
  tech_specs: z.array(UUIDSchema).optional(),
  target_files: z.array(z.string()).optional(),
  generate_tests: z.boolean().default(false)
})

export const CodeExecutionRequestSchema = z.object({
  session_id: UUIDSchema,
  entry_point: z.string().min(1),
  files: z.array(z.object({
    file_path: z.string(),
    content: z.string()
  })).optional()
})

// E2B schemas
export const CreateSandboxSchema = z.object({
  session_id: UUIDSchema,
  template: z.string().optional(),
  timeout_ms: z.number().int().min(1000).max(600000).optional(),
  environment: z.record(z.string()).optional()
})

export const ExecuteCommandSchema = z.object({
  session_id: UUIDSchema,
  command: z.string().min(1),
  working_dir: z.string().optional(),
  timeout: z.number().int().min(1000).max(300000).optional()
})

export const DeployFilesSchema = z.object({
  session_id: UUIDSchema,
  files: z.array(z.object({
    file_path: z.string(),
    content: z.string(),
    file_type: z.string().optional()
  })).min(1),
  target_directory: z.string().optional()
})

export const FileOperationSchema = z.object({
  session_id: UUIDSchema,
  operation: z.object({
    type: z.enum(['create', 'update', 'delete', 'read', 'list']),
    path: z.string().min(1),
    content: z.string().optional(),
    recursive: z.boolean().optional()
  })
})

// GitHub schemas
export const GitHubConnectSchema = z.object({
  action: z.literal('connect'),
  token: z.string().min(1),
  repository_url: URLSchema,
  branch: z.string().max(100).default('main')
})

export const GitHubDisconnectSchema = z.object({
  action: z.literal('disconnect')
})

export const GitHubActionSchema = z.union([GitHubConnectSchema, GitHubDisconnectSchema])

export const CreateRepositorySchema = z.object({
  session_id: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  private: z.boolean().default(true),
  auto_init: z.boolean().default(true)
})

export const SyncFilesSchema = z.object({
  session_id: UUIDSchema,
  commit_message: z.string().min(1).max(500),
  branch: z.string().max(100).default('main'),
  files: z.array(z.object({
    path: z.string(),
    content: z.string()
  })).optional()
})

// Vercel deployment schemas
export const VercelSetupSchema = z.object({
  operation: z.literal('setup_vercel_project'),
  session_id: UUIDSchema,
  vercel_project_id: z.string().min(1),
  vercel_org_id: z.string().optional(),
  domain_name: z.string().optional()
})

export const VercelDeployPreviewSchema = z.object({
  operation: z.literal('deploy_preview'),
  session_id: UUIDSchema,
  branch_name: z.string().max(100).default('develop'),
  commit_message: z.string().max(500).optional()
})

export const VercelDeployProductionSchema = z.object({
  operation: z.literal('deploy_production'),
  session_id: UUIDSchema,
  commit_message: z.string().max(500).optional()
})

export const VercelGetDeploymentsSchema = z.object({
  operation: z.literal('get_deployments'),
  session_id: UUIDSchema
})

export const VercelOperationSchema = z.union([
  VercelSetupSchema,
  VercelDeployPreviewSchema,
  VercelDeployProductionSchema,
  VercelGetDeploymentsSchema
])

// Database schema schemas
export const CreateDatabaseSchemaSchema = z.object({
  session_id: UUIDSchema,
  table_name: z.string().min(1).max(100),
  table_description: z.string().optional(),
  columns_definition: z.array(z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean().default(true),
    primary_key: z.boolean().default(false),
    unique: z.boolean().default(false),
    default_value: z.string().optional()
  })).min(1),
  relationships: z.array(z.object({
    type: z.enum(['belongs_to', 'has_many', 'has_one']),
    target_table: z.string(),
    foreign_key: z.string(),
    target_key: z.string().default('id')
  })).default([]),
  indexes: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    unique: z.boolean().default(false)
  })).default([])
})

// API endpoint schemas
export const CreateAPIEndpointSchema = z.object({
  session_id: UUIDSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1),
  summary: z.string().max(255).optional(),
  description: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
    description: z.string().optional()
  })).default([]),
  responses: z.array(z.object({
    status_code: z.number().int(),
    description: z.string(),
    schema: z.record(z.any()).optional()
  })).default([]),
  authentication_required: z.boolean().default(false)
})

// Test case schemas
export const CreateTestCaseSchema = z.object({
  session_id: UUIDSchema,
  test_name: z.string().min(1).max(255),
  test_type: z.enum(['unit', 'integration', 'e2e']),
  file_path: z.string().optional(),
  test_code: z.string().min(1)
})

export const RunTestSchema = z.object({
  session_id: UUIDSchema,
  test_ids: z.array(UUIDSchema).optional() // If empty, run all tests
})

// Query parameters schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc')
})

export const SessionFilterSchema = PaginationSchema.extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
  search: z.string().optional()
})

export const RequirementFilterSchema = PaginationSchema.extend({
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
  category: z.string().optional(),
  search: z.string().optional()
})

// Validation helper function
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean
  data?: T
  error?: string
} {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0]
      const path = firstError.path.join('.')
      return {
        success: false,
        error: `Validation error${path ? ` at ${path}` : ''}: ${firstError.message}`
      }
    }
    return {
      success: false,
      error: 'Invalid request data'
    }
  }
}

// Export all schemas as a collection for easy access
export const ValidationSchemas = {
  // Workspace
  CreateWorkspace: CreateWorkspaceSchema,
  
  // Session
  CreateSession: CreateSessionSchema,
  UpdateSession: UpdateSessionSchema,
  SessionFilter: SessionFilterSchema,
  
  // Requirements
  CreateRequirement: CreateRequirementSchema,
  UpdateRequirement: UpdateRequirementSchema,
  RequirementFilter: RequirementFilterSchema,
  
  // Technical specs
  CreateTechnicalSpec: CreateTechnicalSpecSchema,
  
  // Workflow
  CreateWorkflowStep: CreateWorkflowStepSchema,
  CreateWorkflowConnection: CreateWorkflowConnectionSchema,
  UpdateWorkflowStep: UpdateWorkflowStepSchema,
  
  // Generated files
  CreateGeneratedFile: CreateGeneratedFileSchema,
  UpdateGeneratedFile: UpdateGeneratedFileSchema,
  
  // Claude operations
  CreateClaudeOperation: CreateClaudeOperationSchema,
  CodeGenerationRequest: CodeGenerationRequestSchema,
  CodeExecutionRequest: CodeExecutionRequestSchema,
  
  // E2B
  CreateSandbox: CreateSandboxSchema,
  ExecuteCommand: ExecuteCommandSchema,
  DeployFiles: DeployFilesSchema,
  FileOperation: FileOperationSchema,
  
  // GitHub
  GitHubAction: GitHubActionSchema,
  CreateRepository: CreateRepositorySchema,
  SyncFiles: SyncFilesSchema,
  
  // Vercel
  VercelOperation: VercelOperationSchema,
  
  // Database
  CreateDatabaseSchema: CreateDatabaseSchemaSchema,
  
  // API endpoints
  CreateAPIEndpoint: CreateAPIEndpointSchema,
  
  // Tests
  CreateTestCase: CreateTestCaseSchema,
  RunTest: RunTestSchema,
  
  // Common
  Pagination: PaginationSchema,
  UUID: UUIDSchema,
  Email: EmailSchema,
  URL: URLSchema
}