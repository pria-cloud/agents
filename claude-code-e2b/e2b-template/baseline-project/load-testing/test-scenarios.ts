import { LoadTestConfig } from './load-test-suite'

/**
 * Predefined load test scenarios for PRIA platform
 */
export class TestScenarios {
  private baseUrl: string
  private authToken?: string

  constructor(baseUrl: string = 'http://localhost:3000', authToken?: string) {
    this.baseUrl = baseUrl
    this.authToken = authToken
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }
    
    return headers
  }

  /**
   * Basic health check scenarios
   */
  getHealthCheckScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Health Check - Light Load',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 10,
        totalRequests: 100,
        timeoutMs: 5000,
        warmupRequests: 5
      },
      {
        name: 'Health Check - Medium Load',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 50,
        totalRequests: 500,
        timeoutMs: 5000,
        warmupRequests: 10
      },
      {
        name: 'Health Check - High Load',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 100,
        totalRequests: 1000,
        timeoutMs: 10000,
        warmupRequests: 20,
        rampUpDurationMs: 10000
      }
    ]
  }

  /**
   * Authentication endpoint scenarios
   */
  getAuthenticationScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Auth Login - Normal Load',
        endpoint: '/api/auth/login',
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'testpassword123'
        },
        concurrency: 20,
        totalRequests: 200,
        timeoutMs: 10000,
        warmupRequests: 5
      },
      {
        name: 'Auth Session Check - High Frequency',
        endpoint: '/api/auth/session',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 100,
        totalRequests: 1000,
        timeoutMs: 5000,
        warmupRequests: 10
      }
    ]
  }

  /**
   * Claude API scenarios
   */
  getClaudeAPIScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Claude Execute - Light Load',
        endpoint: '/api/claude/execute',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          session_id: 'test-session-id',
          entry_point: 'console.log("Hello World")',
          files: []
        },
        concurrency: 5,
        totalRequests: 25,
        timeoutMs: 30000,
        warmupRequests: 2
      },
      {
        name: 'Claude Execute - Medium Load',
        endpoint: '/api/claude/execute',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          session_id: 'test-session-id',
          entry_point: 'for(let i=0; i<1000; i++) { console.log(i); }',
          files: []
        },
        concurrency: 10,
        totalRequests: 50,
        timeoutMs: 45000,
        warmupRequests: 3,
        rampUpDurationMs: 15000
      },
      {
        name: 'Claude Chat - Conversation Load',
        endpoint: '/api/claude/chat',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          session_id: 'test-session-id',
          message: 'Create a simple React component that displays the current time',
          context: {}
        },
        concurrency: 8,
        totalRequests: 40,
        timeoutMs: 60000,
        warmupRequests: 2,
        rampUpDurationMs: 20000
      }
    ]
  }

  /**
   * E2B sandbox scenarios
   */
  getE2BSandboxScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'E2B Create Sandbox - Normal Load',
        endpoint: '/api/e2b/create',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          template: 'node',
          timeout: 300000
        },
        concurrency: 10,
        totalRequests: 50,
        timeoutMs: 30000,
        warmupRequests: 3
      },
      {
        name: 'E2B Execute Code - Medium Load',
        endpoint: '/api/e2b/execute',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          sandbox_id: 'test-sandbox-id',
          code: 'console.log("Load test execution")',
          language: 'javascript'
        },
        concurrency: 15,
        totalRequests: 75,
        timeoutMs: 20000,
        warmupRequests: 5,
        rampUpDurationMs: 10000
      },
      {
        name: 'E2B File Operations - High Frequency',
        endpoint: '/api/e2b/files',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          sandbox_id: 'test-sandbox-id',
          operation: 'write',
          path: '/tmp/test.txt',
          content: 'Load test content'
        },
        concurrency: 25,
        totalRequests: 200,
        timeoutMs: 15000,
        warmupRequests: 8
      }
    ]
  }

  /**
   * GitHub integration scenarios
   */
  getGitHubScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'GitHub Repository List - Normal Load',
        endpoint: '/api/github/repositories',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 20,
        totalRequests: 100,
        timeoutMs: 15000,
        warmupRequests: 5
      },
      {
        name: 'GitHub Create Repository - Low Frequency',
        endpoint: '/api/github/repositories',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          name: 'load-test-repo',
          description: 'Repository created during load testing',
          private: true
        },
        concurrency: 3,
        totalRequests: 15,
        timeoutMs: 20000,
        warmupRequests: 1,
        rampUpDurationMs: 30000
      },
      {
        name: 'GitHub Webhook Handler - High Frequency',
        endpoint: '/api/github/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': 'sha256=test-signature'
        },
        body: {
          ref: 'refs/heads/main',
          repository: {
            id: 123456,
            name: 'test-repo',
            full_name: 'user/test-repo'
          },
          commits: []
        },
        concurrency: 50,
        totalRequests: 500,
        timeoutMs: 10000,
        warmupRequests: 10
      }
    ]
  }

  /**
   * Database operation scenarios
   */
  getDatabaseScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Sessions CRUD - Normal Load',
        endpoint: '/api/sessions',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 30,
        totalRequests: 300,
        timeoutMs: 10000,
        warmupRequests: 10
      },
      {
        name: 'Create Session - Medium Load',
        endpoint: '/api/sessions',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          name: 'Load Test Session',
          description: 'Session created during load testing'
        },
        concurrency: 15,
        totalRequests: 75,
        timeoutMs: 15000,
        warmupRequests: 5
      },
      {
        name: 'Requirements Read - High Frequency',
        endpoint: '/api/requirements',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 40,
        totalRequests: 400,
        timeoutMs: 8000,
        warmupRequests: 15
      },
      {
        name: 'Workflows Operations - Mixed Load',
        endpoint: '/api/workflows',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 25,
        totalRequests: 250,
        timeoutMs: 12000,
        warmupRequests: 10,
        rampUpDurationMs: 15000
      }
    ]
  }

  /**
   * Deploy scenarios
   */
  getDeployScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Deploy Preview - Low Frequency',
        endpoint: '/api/deploy/preview',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          session_id: 'test-session-id',
          branch: 'load-test-branch'
        },
        concurrency: 3,
        totalRequests: 9,
        timeoutMs: 120000,
        warmupRequests: 1,
        rampUpDurationMs: 60000
      },
      {
        name: 'Deploy Status Check - Normal Load',
        endpoint: '/api/deploy/status',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 20,
        totalRequests: 100,
        timeoutMs: 10000,
        warmupRequests: 5
      },
      {
        name: 'Production Deploy - Very Low Frequency',
        endpoint: '/api/deploy/production',
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          session_id: 'test-session-id',
          commit_sha: 'test-commit-sha'
        },
        concurrency: 2,
        totalRequests: 4,
        timeoutMs: 180000,
        warmupRequests: 1,
        rampUpDurationMs: 120000
      }
    ]
  }

  /**
   * Stress test scenarios - Very high load
   */
  getStressTestScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Stress Test - Health Check Saturation',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 200,
        totalRequests: 2000,
        timeoutMs: 5000,
        warmupRequests: 50,
        rampUpDurationMs: 20000
      },
      {
        name: 'Stress Test - Auth Session Flood',
        endpoint: '/api/auth/session',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 150,
        totalRequests: 1500,
        timeoutMs: 8000,
        warmupRequests: 30,
        rampUpDurationMs: 30000
      },
      {
        name: 'Stress Test - Mixed API Load',
        endpoint: '/api/sessions',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 100,
        totalRequests: 1000,
        timeoutMs: 15000,
        warmupRequests: 25,
        rampUpDurationMs: 25000
      }
    ]
  }

  /**
   * Endurance test scenarios - Long duration, moderate load
   */
  getEnduranceTestScenarios(): LoadTestConfig[] {
    return [
      {
        name: 'Endurance Test - Health Check 30min',
        endpoint: '/api/health',
        method: 'GET',
        concurrency: 20,
        totalRequests: 3600, // 30 minutes at 2 req/sec
        timeoutMs: 5000,
        warmupRequests: 10,
        rampUpDurationMs: 60000
      },
      {
        name: 'Endurance Test - Session Operations 20min',
        endpoint: '/api/sessions',
        method: 'GET',
        headers: this.getAuthHeaders(),
        concurrency: 15,
        totalRequests: 1200, // 20 minutes at 1 req/sec
        timeoutMs: 10000,
        warmupRequests: 5,
        rampUpDurationMs: 120000
      }
    ]
  }

  /**
   * Get all scenarios organized by category
   */
  getAllScenarios(): Record<string, LoadTestConfig[]> {
    return {
      healthCheck: this.getHealthCheckScenarios(),
      authentication: this.getAuthenticationScenarios(),
      claudeAPI: this.getClaudeAPIScenarios(),
      e2bSandbox: this.getE2BSandboxScenarios(),
      github: this.getGitHubScenarios(),
      database: this.getDatabaseScenarios(),
      deploy: this.getDeployScenarios(),
      stress: this.getStressTestScenarios(),
      endurance: this.getEnduranceTestScenarios()
    }
  }

  /**
   * Get recommended production readiness test suite
   */
  getProductionReadinessTests(): LoadTestConfig[] {
    return [
      // Core functionality
      ...this.getHealthCheckScenarios().slice(0, 2),
      ...this.getAuthenticationScenarios(),
      
      // Main features under normal load
      ...this.getClaudeAPIScenarios().slice(0, 2),
      ...this.getE2BSandboxScenarios().slice(0, 2),
      ...this.getDatabaseScenarios().slice(0, 3),
      
      // Integration points
      ...this.getGitHubScenarios().slice(0, 2),
      ...this.getDeployScenarios().slice(0, 2),
      
      // Stress testing
      ...this.getStressTestScenarios().slice(0, 2)
    ]
  }

  /**
   * Get basic smoke test suite
   */
  getSmokeTests(): LoadTestConfig[] {
    return [
      this.getHealthCheckScenarios()[0],
      this.getAuthenticationScenarios()[1],
      this.getDatabaseScenarios()[0],
      this.getClaudeAPIScenarios()[0]
    ]
  }
}