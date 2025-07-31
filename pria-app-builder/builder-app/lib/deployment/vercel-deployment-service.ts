/**
 * Vercel Deployment Service - Handles Next.js app deployment to Vercel
 * Integrates with Vercel API for production deployments
 */

export interface VercelProject {
  id: string
  name: string
  account_id: string
  created_at: string
  updated_at: string
  framework: string
  git_repository?: {
    type: 'github' | 'gitlab' | 'bitbucket'
    repo: string
    branch: string
  }
  environment_variables: {
    target: 'production' | 'preview' | 'development'
    type: 'encrypted' | 'plain'
    key: string
    value: string
  }[]
  domains: {
    name: string
    verified: boolean
    primary: boolean
  }[]
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string
  created_at: string
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED'
  type: 'LAMBDAS'
  meta: {
    githubCommitSha?: string
    githubCommitRef?: string
    githubCommitMessage?: string
    githubCommitAuthorName?: string
  }
  target: 'production' | 'staging'
  alias_assigned: boolean
  alias_error?: string
  build_logs: {
    timestamp: string
    message: string
    level: 'info' | 'warn' | 'error'
  }[]
}

export interface VercelDeploymentConfig {
  project_name: string
  target_environment: 'production' | 'preview' | 'development'
  git_branch: string
  environment_variables: Record<string, string>
  build_config: {
    build_command: string
    output_directory: string
    install_command: string
    node_version: string
  }
  domain_config?: {
    custom_domain?: string
    subdomain?: string
  }
}

export interface VercelDeploymentResult {
  success: boolean
  deployment_id: string
  deployment_url: string
  preview_url?: string
  build_logs: string[]
  deployment_state: VercelDeployment['state']
  duration_ms: number
  error_message?: string
}

export class VercelDeploymentService {
  private apiToken: string
  private teamId?: string

  constructor() {
    this.apiToken = process.env.VERCEL_TOKEN || ''
    this.teamId = process.env.VERCEL_TEAM_ID
    
    if (!this.apiToken) {
      throw new Error('VERCEL_TOKEN environment variable is required')
    }
  }

  /**
   * Create or update Vercel project
   */
  async createProject(config: VercelDeploymentConfig): Promise<VercelProject> {
    console.log(`[VERCEL] Creating project: ${config.project_name}`)

    const projectData = {
      name: config.project_name,
      framework: 'nextjs',
      buildCommand: config.build_config.build_command,
      outputDirectory: config.build_config.output_directory,
      installCommand: config.build_config.install_command,
      nodeVersion: config.build_config.node_version,
      environmentVariables: Object.entries(config.environment_variables).map(([key, value]) => ({
        key,
        value,
        target: [config.target_environment],
        type: key.includes('SECRET') || key.includes('KEY') ? 'encrypted' : 'plain'
      }))
    }

    try {
      const response = await this.makeVercelRequest('POST', '/v9/projects', projectData)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to create Vercel project: ${error.error?.message || response.statusText}`)
      }

      const project: VercelProject = await response.json()
      console.log(`[VERCEL] Project created successfully: ${project.id}`)
      
      return project
    } catch (error) {
      console.error('[VERCEL] Project creation failed:', error)
      throw error
    }
  }

  /**
   * Deploy application to Vercel
   */
  async deployApplication(
    projectId: string,
    config: VercelDeploymentConfig,
    sourceFiles: { path: string; content: string }[]
  ): Promise<VercelDeploymentResult> {
    
    const startTime = Date.now()
    console.log(`[VERCEL] Starting deployment for project: ${projectId}`)

    try {
      // Create deployment
      const deploymentData = {
        name: config.project_name,
        files: sourceFiles.map(file => ({
          file: file.path,
          data: Buffer.from(file.content).toString('base64')
        })),
        projectSettings: {
          buildCommand: config.build_config.build_command,
          outputDirectory: config.build_config.output_directory,
          installCommand: config.build_config.install_command,
          nodeVersion: config.build_config.node_version
        },
        target: config.target_environment,
        env: Object.entries(config.environment_variables).reduce((acc, [key, value]) => {
          acc[key] = value
          return acc
        }, {} as Record<string, string>)
      }

      const response = await this.makeVercelRequest('POST', '/v13/deployments', deploymentData)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Deployment failed: ${error.error?.message || response.statusText}`)
      }

      const deployment: VercelDeployment = await response.json()
      console.log(`[VERCEL] Deployment created: ${deployment.uid}`)

      // Wait for deployment to complete
      const finalDeployment = await this.waitForDeploymentCompletion(deployment.uid)
      
      const duration = Date.now() - startTime
      
      const result: VercelDeploymentResult = {
        success: finalDeployment.state === 'READY',
        deployment_id: finalDeployment.uid,
        deployment_url: `https://${finalDeployment.url}`,
        preview_url: config.target_environment === 'preview' ? `https://${finalDeployment.url}` : undefined,
        build_logs: finalDeployment.build_logs.map(log => `[${log.level}] ${log.message}`),
        deployment_state: finalDeployment.state,
        duration_ms: duration,
        error_message: finalDeployment.state === 'ERROR' ? 'Deployment failed' : undefined
      }

      console.log(`[VERCEL] Deployment completed: ${result.success ? 'SUCCESS' : 'FAILED'}`)
      return result

    } catch (error) {
      console.error('[VERCEL] Deployment failed:', error)
      
      return {
        success: false,
        deployment_id: '',
        deployment_url: '',
        build_logs: [],
        deployment_state: 'ERROR',
        duration_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : 'Unknown deployment error'
      }
    }
  }

  /**
   * Get deployment status and logs
   */
  async getDeploymentStatus(deploymentId: string): Promise<VercelDeployment> {
    console.log(`[VERCEL] Getting deployment status: ${deploymentId}`)

    try {
      const response = await this.makeVercelRequest('GET', `/v13/deployments/${deploymentId}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to get deployment status: ${error.error?.message || response.statusText}`)
      }

      const deployment: VercelDeployment = await response.json()
      return deployment

    } catch (error) {
      console.error('[VERCEL] Failed to get deployment status:', error)
      throw error
    }
  }

  /**
   * Get deployment build logs
   */
  async getDeploymentLogs(deploymentId: string): Promise<string[]> {
    console.log(`[VERCEL] Getting deployment logs: ${deploymentId}`)

    try {
      const response = await this.makeVercelRequest('GET', `/v2/deployments/${deploymentId}/events`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to get deployment logs: ${error.error?.message || response.statusText}`)
      }

      const events = await response.json()
      
      return events.map((event: any) => 
        `[${new Date(event.created).toISOString()}] ${event.type}: ${event.payload?.text || event.payload?.info || ''}`
      )

    } catch (error) {
      console.error('[VERCEL] Failed to get deployment logs:', error)
      throw error
    }
  }

  /**
   * Configure custom domain
   */
  async configureDomain(
    projectId: string, 
    domain: string, 
    redirect?: boolean
  ): Promise<{ success: boolean; verification_record?: string }> {
    
    console.log(`[VERCEL] Configuring domain: ${domain} for project: ${projectId}`)

    try {
      const domainData = {
        name: domain,
        projectId,
        redirect: redirect || false
      }

      const response = await this.makeVercelRequest('POST', '/v9/projects/domains', domainData)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Domain configuration failed: ${error.error?.message || response.statusText}`)
      }

      const result = await response.json()
      console.log(`[VERCEL] Domain configured successfully: ${domain}`)
      
      return {
        success: true,
        verification_record: result.verification?.value
      }

    } catch (error) {
      console.error('[VERCEL] Domain configuration failed:', error)
      return {
        success: false
      }
    }
  }

  /**
   * Set environment variables
   */
  async setEnvironmentVariables(
    projectId: string,
    variables: Record<string, string>,
    target: 'production' | 'preview' | 'development' = 'production'
  ): Promise<boolean> {
    
    console.log(`[VERCEL] Setting environment variables for project: ${projectId}`)

    try {
      const promises = Object.entries(variables).map(async ([key, value]) => {
        const envData = {
          key,
          value,
          target: [target],
          type: key.includes('SECRET') || key.includes('KEY') ? 'encrypted' : 'plain'
        }

        const response = await this.makeVercelRequest(
          'POST', 
          `/v9/projects/${projectId}/env`, 
          envData
        )
        
        if (!response.ok) {
          const error = await response.json()
          console.error(`[VERCEL] Failed to set ${key}:`, error.error?.message)
          return false
        }
        
        return true
      })

      const results = await Promise.all(promises)
      const allSuccessful = results.every(result => result)
      
      console.log(`[VERCEL] Environment variables set: ${allSuccessful ? 'SUCCESS' : 'PARTIAL'}`)
      return allSuccessful

    } catch (error) {
      console.error('[VERCEL] Failed to set environment variables:', error)
      return false
    }
  }

  /**
   * Trigger redeploy
   */
  async triggerRedeploy(
    projectId: string,
    gitBranch: string = 'main'
  ): Promise<VercelDeploymentResult> {
    
    console.log(`[VERCEL] Triggering redeploy for project: ${projectId}`)

    try {
      const redeployData = {
        name: projectId,
        gitSource: {
          type: 'github',
          ref: gitBranch
        }
      }

      const response = await this.makeVercelRequest('POST', '/v13/deployments', redeployData)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Redeploy failed: ${error.error?.message || response.statusText}`)
      }

      const deployment: VercelDeployment = await response.json()
      console.log(`[VERCEL] Redeploy triggered: ${deployment.uid}`)

      // Wait for completion
      const finalDeployment = await this.waitForDeploymentCompletion(deployment.uid)
      
      return {
        success: finalDeployment.state === 'READY',
        deployment_id: finalDeployment.uid,
        deployment_url: `https://${finalDeployment.url}`,
        build_logs: [],
        deployment_state: finalDeployment.state,
        duration_ms: 0 // Would be calculated
      }

    } catch (error) {
      console.error('[VERCEL] Redeploy failed:', error)
      throw error
    }
  }

  // Private helper methods

  private async makeVercelRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<Response> {
    
    const url = `https://api.vercel.com${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    }

    if (this.teamId) {
      headers['X-Vercel-Team-Id'] = this.teamId
    }

    const options: RequestInit = {
      method,
      headers
    }

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data)
    }

    return fetch(url, options)
  }

  private async waitForDeploymentCompletion(
    deploymentId: string,
    timeoutMs: number = 10 * 60 * 1000 // 10 minutes
  ): Promise<VercelDeployment> {
    
    const startTime = Date.now()
    const checkInterval = 5000 // 5 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const deployment = await this.getDeploymentStatus(deploymentId)
        
        if (deployment.state === 'READY' || deployment.state === 'ERROR' || deployment.state === 'CANCELED') {
          return deployment
        }
        
        console.log(`[VERCEL] Deployment ${deploymentId} state: ${deployment.state}`)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
        
      } catch (error) {
        console.error('[VERCEL] Error checking deployment status:', error)
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }
    }
    
    throw new Error(`Deployment ${deploymentId} timed out after ${timeoutMs}ms`)
  }

  /**
   * Get project information
   */
  async getProject(projectId: string): Promise<VercelProject | null> {
    try {
      const response = await this.makeVercelRequest('GET', `/v9/projects/${projectId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        const error = await response.json()
        throw new Error(`Failed to get project: ${error.error?.message || response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[VERCEL] Failed to get project:', error)
      return null
    }
  }

  /**
   * Delete deployment (for rollback)
   */
  async deleteDeployment(deploymentId: string): Promise<boolean> {
    try {
      const response = await this.makeVercelRequest('DELETE', `/v13/deployments/${deploymentId}`)
      return response.ok
    } catch (error) {
      console.error('[VERCEL] Failed to delete deployment:', error)
      return false
    }
  }
}