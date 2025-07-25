// Requirements service for API operations
import type { Requirement, RequirementInsert, RequirementUpdate } from '@/lib/supabase/types'

export interface RequirementsResponse {
  requirements: Requirement[]
}

export interface RequirementResponse {
  requirement: Requirement
}

export interface ClaudeAnalysisRequest {
  operation: 'analyze_requirements'
  sessionId: string
  workspaceId: string
  requirement_ids: string[]
}

export interface ClaudeCodeGenerationRequest {
  operation: 'generate_code'
  sessionId: string
  workspaceId: string
  requirement_ids: string[]
  generate_tests?: boolean
}

export class RequirementsService {
  private static async apiCall<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Fetch requirements for a session
   */
  static async getRequirements(sessionId: string): Promise<Requirement[]> {
    const response = await this.apiCall<RequirementsResponse>(
      `/api/requirements?sessionId=${sessionId}`
    )
    return response.requirements
  }

  /**
   * Create a new requirement
   */
  static async createRequirement(data: {
    sessionId: string
    workspaceId: string
    title: string
    description: string
    priority?: 'low' | 'medium' | 'high'
    category?: string
    acceptanceCriteria?: string[]
  }): Promise<Requirement> {
    const response = await this.apiCall<RequirementResponse>('/api/requirements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.requirement
  }

  /**
   * Update an existing requirement
   */
  static async updateRequirement(
    id: string, 
    updates: Partial<RequirementUpdate>
  ): Promise<Requirement> {
    const response = await this.apiCall<RequirementResponse>(`/api/requirements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return response.requirement
  }

  /**
   * Delete a requirement
   */
  static async deleteRequirement(id: string): Promise<void> {
    await this.apiCall(`/api/requirements/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * Get a specific requirement
   */
  static async getRequirement(id: string): Promise<Requirement> {
    const response = await this.apiCall<RequirementResponse>(`/api/requirements/${id}`)
    return response.requirement
  }

  /**
   * Trigger Claude analysis of requirements
   */
  static async analyzeRequirements(data: ClaudeAnalysisRequest): Promise<any> {
    const response = await this.apiCall('/api/claude', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response
  }

  /**
   * Trigger Claude code generation
   */
  static async generateCode(data: ClaudeCodeGenerationRequest): Promise<any> {
    const response = await this.apiCall('/api/claude', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response
  }

  /**
   * Batch operations for multiple requirements
   */
  static async batchUpdateRequirements(
    updates: Array<{ id: string; data: Partial<RequirementUpdate> }>
  ): Promise<Requirement[]> {
    const promises = updates.map(({ id, data }) => 
      this.updateRequirement(id, data)
    )
    return Promise.all(promises)
  }

  /**
   * Get requirements by status
   */
  static async getRequirementsByStatus(
    sessionId: string, 
    status: 'pending' | 'in-progress' | 'completed'
  ): Promise<Requirement[]> {
    const requirements = await this.getRequirements(sessionId)
    return requirements.filter(req => req.status === status)
  }

  /**
   * Get requirements by priority
   */
  static async getRequirementsByPriority(
    sessionId: string, 
    priority: 'low' | 'medium' | 'high'
  ): Promise<Requirement[]> {
    const requirements = await this.getRequirements(sessionId)
    return requirements.filter(req => req.priority === priority)
  }

  /**
   * Search requirements
   */
  static async searchRequirements(
    sessionId: string, 
    searchTerm: string
  ): Promise<Requirement[]> {
    const requirements = await this.getRequirements(sessionId)
    const term = searchTerm.toLowerCase()
    return requirements.filter(req => 
      req.title.toLowerCase().includes(term) ||
      req.description.toLowerCase().includes(term) ||
      req.category?.toLowerCase().includes(term)
    )
  }
}