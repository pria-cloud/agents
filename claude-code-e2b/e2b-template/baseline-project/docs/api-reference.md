# PRIA Platform API Reference

Complete API documentation for the Platform for Rapid Intelligent Applications (PRIA), including all endpoints, request/response schemas, authentication methods, and usage examples.

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Health & Status APIs](#health--status-apis)
6. [Authentication APIs](#authentication-apis)
7. [Workspace Management APIs](#workspace-management-apis)
8. [Application APIs](#application-apis)
9. [Session Management APIs](#session-management-apis)
10. [AI Integration APIs](#ai-integration-apis)
11. [E2B Sandbox APIs](#e2b-sandbox-apis)
12. [GitHub Integration APIs](#github-integration-apis)
13. [Deployment APIs](#deployment-apis)
14. [Monitoring APIs](#monitoring-apis)
15. [File Management APIs](#file-management-apis)

## 🌐 API Overview

### Base URLs

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://pria-platform.com/api` |
| **Staging** | `https://staging-pria-platform.vercel.app/api` |
| **Development** | `http://localhost:3000/api` |

### API Versioning

Current API version: **v1**

All API endpoints are prefixed with `/api` and follow RESTful conventions.

### Content Types

- **Request Content-Type**: `application/json`
- **Response Content-Type**: `application/json`
- **File Upload Content-Type**: `multipart/form-data`

### Response Format

All API responses follow a consistent structure:

```typescript
interface APIResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    timestamp: string
    version: string
    requestId: string
  }
}
```

## 🔐 Authentication

### JWT Token Authentication

PRIA uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Structure

```typescript
interface JWTPayload {
  sub: string              // User ID
  email: string           // User email
  workspace_id: string    // Current workspace ID
  role: 'owner' | 'admin' | 'developer' | 'viewer'
  iss: string             // Issuer (Supabase)
  exp: number             // Expiration timestamp
  iat: number             // Issued at timestamp
}
```

### Obtaining Tokens

Tokens are obtained through the authentication endpoints and are automatically managed by the client SDK.

## ❌ Error Handling

### HTTP Status Codes

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource conflict (e.g., duplicate name) |
| `422` | Unprocessable Entity | Validation errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### Error Response Format

```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string           // Machine-readable error code
    message: string        // Human-readable error message
    details?: {           // Additional error context
      field?: string      // Field that caused the error
      value?: any         // Invalid value
      expected?: string   // Expected format/value
    }
  }
  metadata: {
    timestamp: string
    requestId: string
  }
}
```

### Common Error Codes

```typescript
const ERROR_CODES = {
  // Authentication errors
  'AUTH_REQUIRED': 'Authentication token required',
  'AUTH_INVALID': 'Invalid authentication token',
  'AUTH_EXPIRED': 'Authentication token expired',
  
  // Authorization errors
  'PERMISSION_DENIED': 'Insufficient permissions',
  'WORKSPACE_ACCESS_DENIED': 'Workspace access denied',
  
  // Validation errors
  'VALIDATION_ERROR': 'Request validation failed',
  'REQUIRED_FIELD': 'Required field missing',
  'INVALID_FORMAT': 'Invalid field format',
  
  // Resource errors
  'RESOURCE_NOT_FOUND': 'Resource not found',
  'RESOURCE_CONFLICT': 'Resource already exists',
  'RESOURCE_LIMIT_EXCEEDED': 'Resource limit exceeded',
  
  // Rate limiting
  'RATE_LIMIT_EXCEEDED': 'Rate limit exceeded',
  
  // External service errors
  'CLAUDE_API_ERROR': 'Claude API error',
  'E2B_SERVICE_ERROR': 'E2B service error',
  'GITHUB_API_ERROR': 'GitHub API error'
} as const
```

## 🚦 Rate Limiting

### Rate Limit Headers

All API responses include rate limiting information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
Retry-After: 60
```

### Rate Limits by Endpoint

| Endpoint Category | Requests per Minute | Burst Allowance |
|------------------|-------------------|-----------------|
| **General API** | 100 | 20 |
| **Claude API** | 10 | 5 |
| **E2B Operations** | 30 | 10 |
| **GitHub API** | 60 | 20 |
| **Authentication** | 5 | 0 |
| **Health Check** | 60 | 0 |
| **Deployments** | 5 per 5 minutes | 2 |

## 🏥 Health & Status APIs

### Get System Health

**GET** `/api/health`

Returns the current health status of all system components.

#### Response

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime?: number
    lastCheck: string
    details?: any
  }>
}
```

#### Example

```bash
curl -X GET https://pria-platform.com/api/health
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "uptime": 86400,
    "services": [
      {
        "name": "Database",
        "status": "healthy",
        "responseTime": 45,
        "lastCheck": "2024-01-15T10:30:00.000Z"
      },
      {
        "name": "Claude API",
        "status": "healthy",
        "responseTime": 120,
        "lastCheck": "2024-01-15T10:29:55.000Z"
      }
    ]
  }
}
```

### Get Detailed System Metrics

**GET** `/api/health/metrics`

Returns detailed system performance metrics.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

#### Response

```typescript
interface MetricsResponse {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
    load: number[]
  }
  database: {
    connections: number
    maxConnections: number
    averageResponseTime: number
  }
  api: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
  }
}
```

## 🔑 Authentication APIs

### Login

**POST** `/api/auth/login`

Authenticate user with email and password.

#### Request Body

```typescript
interface LoginRequest {
  email: string
  password: string
  workspace?: string    // Optional workspace slug
}
```

#### Response

```typescript
interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    avatar_url?: string
  }
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  workspace: {
    id: string
    name: string
    slug: string
    role: 'owner' | 'admin' | 'developer' | 'viewer'
  }
}
```

#### Example

```bash
curl -X POST https://pria-platform.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

### Refresh Token

**POST** `/api/auth/refresh`

Refresh an expired access token.

#### Request Body

```typescript
interface RefreshRequest {
  refresh_token: string
}
```

### Logout

**POST** `/api/auth/logout`

Logout user and invalidate tokens.

#### Headers
- `Authorization: Bearer <token>`

### Get Current User

**GET** `/api/auth/me`

Get current authenticated user information.

#### Headers
- `Authorization: Bearer <token>`

#### Response

```typescript
interface UserResponse {
  id: string
  email: string
  name: string
  avatar_url?: string
  created_at: string
  last_login: string
  workspaces: Array<{
    id: string
    name: string
    slug: string
    role: 'owner' | 'admin' | 'developer' | 'viewer'
    joined_at: string
  }>
}
```

## 🏢 Workspace Management APIs

### List Workspaces

**GET** `/api/workspaces`

Get all workspaces accessible to the current user.

#### Headers
- `Authorization: Bearer <token>`

#### Response

```typescript
interface WorkspacesResponse {
  workspaces: Array<{
    id: string
    name: string
    slug: string
    description?: string
    role: 'owner' | 'admin' | 'developer' | 'viewer'
    member_count: number
    application_count: number
    created_at: string
    subscription_tier: 'free' | 'pro' | 'enterprise'
  }>
}
```

### Get Workspace Details

**GET** `/api/workspaces/{workspace_id}`

Get detailed information about a specific workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Response

```typescript
interface WorkspaceResponse {
  id: string
  name: string
  slug: string
  description?: string
  settings: {
    default_framework: string
    ai_model_preference: string
    deployment_target: string
  }
  subscription: {
    tier: 'free' | 'pro' | 'enterprise'
    status: 'active' | 'canceled' | 'past_due'
    current_period_end: string
  }
  usage: {
    applications: number
    max_applications: number
    ai_requests_this_month: number
    max_ai_requests: number
    storage_used_mb: number
    max_storage_mb: number
  }
  members: Array<{
    id: string
    email: string
    name: string
    role: 'owner' | 'admin' | 'developer' | 'viewer'
    joined_at: string
    last_active: string
  }>
}
```

### Create Workspace

**POST** `/api/workspaces`

Create a new workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateWorkspaceRequest {
  name: string
  slug?: string         // Auto-generated if not provided
  description?: string
  settings?: {
    default_framework?: string
    ai_model_preference?: string
    deployment_target?: string
  }
}
```

### Update Workspace

**PUT** `/api/workspaces/{workspace_id}`

Update workspace information.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

### Invite User to Workspace

**POST** `/api/workspaces/{workspace_id}/invites`

Invite a user to join the workspace.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

#### Request Body

```typescript
interface InviteUserRequest {
  email: string
  role: 'admin' | 'developer' | 'viewer'
  message?: string
}
```

## 📱 Application APIs

### List Applications

**GET** `/api/applications`

Get all applications in the current workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `draft`, `active`, `archived` |
| `type` | string | Filter by type: `web_app`, `api`, `mobile` |
| `framework` | string | Filter by framework: `nextjs`, `react`, `vue` |
| `limit` | number | Number of results (default: 50, max: 100) |
| `offset` | number | Pagination offset (default: 0) |
| `search` | string | Search applications by name or description |

#### Response

```typescript
interface ApplicationsResponse {
  applications: Array<{
    id: string
    name: string
    description?: string
    type: 'web_app' | 'api' | 'mobile'
    framework: string
    status: 'draft' | 'active' | 'archived'
    repository?: {
      url: string
      branch: string
      last_commit: string
    }
    deployment?: {
      url: string
      status: 'pending' | 'building' | 'ready' | 'error'
      last_deployed: string
    }
    created_by: {
      id: string
      name: string
      email: string
    }
    created_at: string
    updated_at: string
  }>
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}
```

### Get Application Details

**GET** `/api/applications/{application_id}`

Get detailed information about a specific application.

#### Headers
- `Authorization: Bearer <token>`

#### Response

```typescript
interface ApplicationResponse {
  id: string
  name: string
  description?: string
  type: 'web_app' | 'api' | 'mobile'
  framework: string
  status: 'draft' | 'active' | 'archived'
  configuration: {
    database_enabled: boolean
    authentication_enabled: boolean
    api_endpoints: string[]
    environment_variables: Record<string, string>
  }
  repository?: {
    url: string
    branch: string
    last_commit: {
      sha: string
      message: string
      author: string
      timestamp: string
    }
  }
  deployments: Array<{
    id: string
    environment: 'preview' | 'production'
    status: 'pending' | 'building' | 'ready' | 'error'
    url?: string
    created_at: string
  }>
  requirements?: {
    functional: string[]
    technical: string[]
    non_functional: string[]
  }
  generated_files_count: number
  last_session: {
    id: string
    name: string
    created_at: string
  }
  created_by: {
    id: string
    name: string
    email: string
  }
  created_at: string
  updated_at: string
}
```

### Create Application

**POST** `/api/applications`

Create a new application.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateApplicationRequest {
  name: string
  description?: string
  type: 'web_app' | 'api' | 'mobile'
  framework?: string        // Default: 'nextjs'
  configuration?: {
    database_enabled?: boolean
    authentication_enabled?: boolean
    template?: string
  }
  requirements?: {
    functional?: string[]
    technical?: string[]
    non_functional?: string[]
  }
}
```

#### Example

```bash
curl -X POST https://pria-platform.com/api/applications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Task Manager Pro",
    "description": "Advanced task management application with team collaboration",
    "type": "web_app",
    "framework": "nextjs",
    "configuration": {
      "database_enabled": true,
      "authentication_enabled": true
    },
    "requirements": {
      "functional": [
        "Users can create and manage tasks",
        "Team collaboration features",
        "Real-time notifications"
      ],
      "technical": [
        "React 18+ with TypeScript",
        "Supabase for backend",
        "Real-time subscriptions"
      ]
    }
  }'
```

### Update Application

**PUT** `/api/applications/{application_id}`

Update application information.

#### Headers
- `Authorization: Bearer <token>`

### Delete Application

**DELETE** `/api/applications/{application_id}`

Delete an application and all associated data.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

## 💬 Session Management APIs

### List Sessions

**GET** `/api/sessions`

Get all development sessions for the current workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `application_id` | string | Filter by application |
| `status` | string | Filter by status: `active`, `completed`, `error` |
| `limit` | number | Number of results (default: 20) |
| `offset` | number | Pagination offset |

#### Response

```typescript
interface SessionsResponse {
  sessions: Array<{
    id: string
    name: string
    description?: string
    application_id: string
    application_name: string
    status: 'active' | 'completed' | 'error'
    progress: {
      total_steps: number
      completed_steps: number
      current_step?: string
    }
    ai_operations: {
      total: number
      successful: number
      failed: number
    }
    created_by: {
      id: string
      name: string
    }
    created_at: string
    updated_at: string
    completed_at?: string
  }>
}
```

### Create Session

**POST** `/api/sessions`

Create a new development session.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateSessionRequest {
  name: string
  description?: string
  application_id: string
  focus_area?: string       // e.g., "authentication", "frontend", "api"
  estimated_duration?: number // in minutes
  requirements?: string[]
}
```

### Get Session Details

**GET** `/api/sessions/{session_id}`

Get detailed information about a session.

#### Response

```typescript
interface SessionResponse {
  id: string
  name: string
  description?: string
  application_id: string
  status: 'active' | 'completed' | 'error'
  focus_area?: string
  estimated_duration?: number
  actual_duration?: number
  conversation_history: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
    metadata?: {
      operation_type?: string
      files_modified?: string[]
      commands_executed?: string[]
    }
  }>
  generated_files: Array<{
    id: string
    file_path: string
    language: string
    size_bytes: number
    created_at: string
    updated_at: string
  }>
  execution_results: Array<{
    id: string
    command: string
    exit_code: number
    stdout?: string
    stderr?: string
    duration: number
    executed_at: string
  }>
  created_at: string
  updated_at: string
}
```

## 🤖 AI Integration APIs

### Execute Claude Operation

**POST** `/api/claude/execute`

Execute a Claude AI operation within a session context.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface ClaudeExecuteRequest {
  session_id: string
  operation_type: 'code_generation' | 'code_review' | 'debugging' | 'optimization'
  prompt: string
  context?: {
    files?: Array<{
      path: string
      content: string
    }>
    previous_conversation?: string[]
    requirements?: string[]
  }
  options?: {
    timeout?: number      // in milliseconds
    model?: string        // AI model preference
    temperature?: number  // Response creativity (0-1)
  }
}
```

#### Response

```typescript
interface ClaudeExecuteResponse {
  operation_id: string
  result: {
    content: string
    files_modified?: Array<{
      path: string
      content: string
      action: 'create' | 'update' | 'delete'
    }>
    commands_to_execute?: string[]
    next_steps?: string[]
  }
  metadata: {
    model_used: string
    tokens_used: number
    duration: number
    confidence_score: number
  }
}
```

#### Example

```bash
curl -X POST https://pria-platform.com/api/claude/execute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "sess_123456",
    "operation_type": "code_generation",
    "prompt": "Create a React component for user authentication with form validation",
    "context": {
      "requirements": [
        "Email and password fields",
        "Client-side validation",
        "Submit to /api/auth/login endpoint",
        "Show loading and error states"
      ]
    }
  }'
```

### Chat with Claude

**POST** `/api/claude/chat`

Have a conversational interaction with Claude AI.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface ClaudeChatRequest {
  session_id: string
  message: string
  context?: {
    application_id?: string
    current_file?: string
    relevant_files?: string[]
  }
}
```

### Get Claude Operation Status

**GET** `/api/claude/operations/{operation_id}`

Get the status and results of a Claude operation.

#### Headers
- `Authorization: Bearer <token>`

## 🐳 E2B Sandbox APIs

### Create Sandbox

**POST** `/api/e2b/sandboxes`

Create a new E2B sandbox for code execution.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateSandboxRequest {
  session_id: string
  template?: string         // Default: 'node'
  timeout?: number          // Sandbox lifetime in milliseconds
  environment?: Record<string, string>
  dependencies?: string[]   // npm packages to install
}
```

#### Response

```typescript
interface SandboxResponse {
  sandbox_id: string
  status: 'creating' | 'ready' | 'error'
  template: string
  url?: string              // Access URL if applicable
  created_at: string
  expires_at: string
}
```

### Execute Code in Sandbox

**POST** `/api/e2b/sandboxes/{sandbox_id}/execute`

Execute code in an existing sandbox.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface ExecuteCodeRequest {
  code: string
  language?: string         // Default: inferred from code
  timeout?: number          // Execution timeout in milliseconds
  files?: Array<{
    path: string
    content: string
  }>
}
```

#### Response

```typescript
interface ExecuteCodeResponse {
  execution_id: string
  result: {
    stdout: string
    stderr: string
    exit_code: number
    duration: number
    files_created?: string[]
    files_modified?: string[]
  }
  status: 'completed' | 'timeout' | 'error'
  executed_at: string
}
```

### Get Sandbox Files

**GET** `/api/e2b/sandboxes/{sandbox_id}/files`

List files in the sandbox.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `path` | string | Directory path (default: '/') |
| `recursive` | boolean | Include subdirectories |

### Upload Files to Sandbox

**POST** `/api/e2b/sandboxes/{sandbox_id}/files`

Upload files to the sandbox.

#### Headers
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

### Delete Sandbox

**DELETE** `/api/e2b/sandboxes/{sandbox_id}`

Delete a sandbox and clean up resources.

#### Headers
- `Authorization: Bearer <token>`

## 🐙 GitHub Integration APIs

### Connect GitHub Account

**POST** `/api/github/connect`

Connect a GitHub account to the workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface GitHubConnectRequest {
  code: string              // OAuth authorization code
  state: string             // OAuth state parameter
}
```

### List Repositories

**GET** `/api/github/repositories`

List GitHub repositories accessible to the connected account.

#### Headers
- `Authorization: Bearer <token>`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Repository type: `all`, `owner`, `member` |
| `sort` | string | Sort by: `created`, `updated`, `pushed`, `full_name` |
| `direction` | string | Sort direction: `asc`, `desc` |
| `limit` | number | Number of results (max: 100) |

#### Response

```typescript
interface GitHubRepositoriesResponse {
  repositories: Array<{
    id: number
    name: string
    full_name: string
    description?: string
    private: boolean
    html_url: string
    clone_url: string
    default_branch: string
    language?: string
    topics: string[]
    created_at: string
    updated_at: string
    pushed_at: string
  }>
}
```

### Create Repository

**POST** `/api/github/repositories`

Create a new GitHub repository for an application.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateRepositoryRequest {
  application_id: string
  name: string
  description?: string
  private?: boolean         // Default: true
  auto_init?: boolean       // Initialize with README
  license_template?: string
  gitignore_template?: string
}
```

### Deploy to GitHub

**POST** `/api/github/deploy`

Deploy application code to a GitHub repository.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface GitHubDeployRequest {
  application_id: string
  repository_id: number
  branch?: string           // Default: 'main'
  commit_message?: string
  files: Array<{
    path: string
    content: string
    encoding?: 'utf-8' | 'base64'
  }>
}
```

### Webhook Handler

**POST** `/api/github/webhook`

Handle GitHub webhook events (internal endpoint).

#### Headers
- `X-GitHub-Event: <event_type>`
- `X-Hub-Signature-256: <signature>`

## 🚀 Deployment APIs

### List Deployments

**GET** `/api/deployments`

List all deployments for the workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `application_id` | string | Filter by application |
| `environment` | string | Filter by environment: `preview`, `production` |
| `status` | string | Filter by status |

#### Response

```typescript
interface DeploymentsResponse {
  deployments: Array<{
    id: string
    application_id: string
    application_name: string
    environment: 'preview' | 'production'
    status: 'pending' | 'building' | 'ready' | 'error'
    url?: string
    commit: {
      sha: string
      message: string
      author: string
    }
    build_logs?: string
    created_at: string
    completed_at?: string
    deployed_by: {
      id: string
      name: string
    }
  }>
}
```

### Create Deployment

**POST** `/api/deployments`

Create a new deployment.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface CreateDeploymentRequest {
  application_id: string
  environment: 'preview' | 'production'
  branch?: string           // Default: main branch
  commit_sha?: string       // Specific commit to deploy
  environment_variables?: Record<string, string>
  auto_promote?: boolean    // Auto-promote to production after preview
}
```

### Get Deployment Details

**GET** `/api/deployments/{deployment_id}`

Get detailed information about a deployment.

#### Response

```typescript
interface DeploymentResponse {
  id: string
  application_id: string
  environment: 'preview' | 'production'
  status: 'pending' | 'building' | 'ready' | 'error'
  url?: string
  commit: {
    sha: string
    message: string
    author: string
    timestamp: string
  }
  build_info: {
    start_time: string
    end_time?: string
    duration?: number
    build_command: string
    node_version: string
    framework: string
  }
  build_logs: string
  environment_variables: Record<string, string>
  performance_metrics?: {
    bundle_size: number
    load_time: number
    lighthouse_score: number
  }
  created_at: string
  deployed_by: {
    id: string
    name: string
    email: string
  }
}
```

### Promote Deployment

**POST** `/api/deployments/{deployment_id}/promote`

Promote a preview deployment to production.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

### Rollback Deployment

**POST** `/api/deployments/{deployment_id}/rollback`

Rollback to a previous deployment.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

## 📊 Monitoring APIs

### Get System Metrics

**GET** `/api/monitoring/metrics`

Get real-time system metrics.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `timeframe` | string | Time range: `1h`, `24h`, `7d`, `30d` |
| `metrics` | string[] | Specific metrics to include |

#### Response

```typescript
interface MetricsResponse {
  timeframe: string
  data_points: number
  metrics: {
    performance: {
      avg_response_time: number
      p95_response_time: number
      requests_per_minute: number
      error_rate: number
    }
    system: {
      memory_usage: number
      cpu_usage: number
      disk_usage: number
      uptime: number
    }
    business: {
      active_users: number
      applications_created: number
      deployments_today: number
      ai_operations_count: number
    }
  }
  time_series: Array<{
    timestamp: string
    values: Record<string, number>
  }>
}
```

### Get Application Analytics

**GET** `/api/monitoring/applications/{application_id}/analytics`

Get analytics for a specific application.

#### Headers
- `Authorization: Bearer <token>`

### Create Alert Rule

**POST** `/api/monitoring/alerts`

Create a new monitoring alert rule.

#### Headers
- `Authorization: Bearer <token>` (Admin role required)

#### Request Body

```typescript
interface CreateAlertRequest {
  name: string
  description?: string
  condition: string         // e.g., "error_rate > 5%"
  severity: 'low' | 'medium' | 'high' | 'critical'
  channels: Array<{
    type: 'email' | 'slack' | 'webhook'
    config: Record<string, any>
  }>
  enabled?: boolean
}
```

## 📁 File Management APIs

### List Generated Files

**GET** `/api/files`

List all generated files for the workspace.

#### Headers
- `Authorization: Bearer <token>`

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `application_id` | string | Filter by application |
| `session_id` | string | Filter by session |
| `language` | string | Filter by programming language |
| `path` | string | Filter by file path pattern |

#### Response

```typescript
interface FilesResponse {
  files: Array<{
    id: string
    application_id: string
    session_id?: string
    file_path: string
    language: string
    size_bytes: number
    checksum: string
    created_at: string
    updated_at: string
    created_by: {
      id: string
      name: string
    }
  }>
}
```

### Get File Content

**GET** `/api/files/{file_id}`

Get the content of a specific file.

#### Headers
- `Authorization: Bearer <token>`

#### Response

```typescript
interface FileContentResponse {
  id: string
  file_path: string
  content: string
  language: string
  size_bytes: number
  encoding: 'utf-8' | 'base64'
  metadata: {
    lines: number
    complexity_score?: number
    dependencies?: string[]
  }
  version_history?: Array<{
    version: number
    created_at: string
    created_by: string
    changes_summary: string
  }>
}
```

### Update File Content

**PUT** `/api/files/{file_id}`

Update the content of a file.

#### Headers
- `Authorization: Bearer <token>`

#### Request Body

```typescript
interface UpdateFileRequest {
  content: string
  commit_message?: string
  auto_format?: boolean     // Auto-format code
  validate_syntax?: boolean // Validate before saving
}
```

### Delete File

**DELETE** `/api/files/{file_id}`

Delete a generated file.

#### Headers
- `Authorization: Bearer <token>`

---

## 📚 SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { PriaSDK } from '@pria/sdk'

const pria = new PriaSDK({
  apiKey: 'your-api-key',
  baseUrl: 'https://pria-platform.com/api'
})

// Create an application
const app = await pria.applications.create({
  name: 'My App',
  type: 'web_app',
  framework: 'nextjs'
})

// Start a session
const session = await pria.sessions.create({
  name: 'Feature Development',
  application_id: app.id
})

// Execute Claude operation
const result = await pria.claude.execute({
  session_id: session.id,
  operation_type: 'code_generation',
  prompt: 'Create a user dashboard component'
})
```

### Python SDK

```python
from pria_sdk import PriaClient

client = PriaClient(
    api_key='your-api-key',
    base_url='https://pria-platform.com/api'
)

# Create application
app = client.applications.create(
    name='My Python App',
    type='api',
    framework='fastapi'
)

# Execute AI operation
result = client.claude.execute(
    session_id=session_id,
    operation_type='code_generation',
    prompt='Create FastAPI endpoints for user management'
)
```

## 🔗 Webhooks

PRIA supports webhooks for real-time notifications of platform events.

### Webhook Events

| Event | Description |
|-------|-------------|
| `application.created` | New application created |
| `application.deployed` | Application deployed |
| `session.completed` | Development session completed |
| `deployment.ready` | Deployment completed successfully |
| `deployment.failed` | Deployment failed |
| `user.invited` | User invited to workspace |

### Webhook Payload Format

```typescript
interface WebhookPayload {
  event: string
  timestamp: string
  data: {
    workspace_id: string
    [key: string]: any
  }
  signature: string
}
```

### Configuring Webhooks

Configure webhooks in your workspace settings or via the API:

```bash
curl -X POST https://pria-platform.com/api/webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["application.created", "deployment.ready"],
    "secret": "your-webhook-secret"
  }'
```

---

This comprehensive API reference provides all the information needed to integrate with the PRIA platform. For additional support, consult the [User Guide](./user-guide.md) or [Architecture Documentation](./architecture.md).