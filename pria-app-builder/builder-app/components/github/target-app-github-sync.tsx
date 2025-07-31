'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Github, 
  GitBranch, 
  Upload,
  Download,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Loader2,
  Link,
  Settings,
  FolderGit,
  Clock,
  GitPullRequest,
  GitCommit
} from 'lucide-react'

interface TargetAppGitHubSyncProps {
  sessionId: string
  workspaceName: string
  projectName: string
  sandboxId?: string
  className?: string
}

interface GitHubRepository {
  name: string
  full_name: string
  html_url: string
  clone_url: string
  default_branch: string
  private: boolean
  created_at: string
  updated_at: string
}

interface SyncStatus {
  lastSync?: string
  syncType?: 'push' | 'pull'
  filesAdded?: number
  filesModified?: number
  filesDeleted?: number
  status?: 'success' | 'failed' | 'conflict'
}

interface SyncOperation {
  id: string
  type: 'push' | 'pull'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'conflict'
  startTime: string
  endTime?: string
  commit?: {
    sha: string
    message: string
    author: string
  }
  summary?: {
    filesAdded: number
    filesModified: number
    filesDeleted: number
    conflicts: number
  }
  nextActions?: string[]
  errors?: string[]
}

interface GitHubSetupStatus {
  configured: boolean
  status: 'completed' | 'partial' | 'failed' | 'not_configured'
  lastSetup?: string
  errors: string[]
}

interface SandboxGitConfig {
  version?: string
  userName?: string
  userEmail?: string
}

export function TargetAppGitHubSync({ 
  sessionId, 
  workspaceName,
  projectName,
  sandboxId,
  className 
}: TargetAppGitHubSyncProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [githubUser, setGithubUser] = useState<string | null>(null)
  const [repository, setRepository] = useState<GitHubRepository | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({})
  const [setupStatus, setSetupStatus] = useState<GitHubSetupStatus>({ configured: false, status: 'not_configured', errors: [] })
  const [gitConfig, setGitConfig] = useState<SandboxGitConfig>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [syncOperations, setSyncOperations] = useState<any[]>([])
  const [currentOperation, setCurrentOperation] = useState<any | null>(null)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  useEffect(() => {
    checkGitHubAuth()
    checkRepository()
    checkSetupStatus()
  }, [sessionId])

  useEffect(() => {
    if (sandboxId && isAuthenticated) {
      checkSandboxSetup()
    }
  }, [sandboxId, isAuthenticated])

  const checkGitHubAuth = async () => {
    try {
      const response = await fetch('/api/github/auth')
      const data = await response.json()
      
      setIsAuthenticated(data.authenticated)
      if (data.github_username) {
        setGithubUser(data.github_username)
      }
    } catch (err) {
      console.error('Failed to check GitHub auth:', err)
    }
  }

  const checkRepository = async () => {
    try {
      const response = await fetch(`/api/github/sync?action=repository&sessionId=${sessionId}`)
      const data = await response.json()
      
      if (data.exists && data.repository) {
        setRepository(data.repository)
        await getSyncHistory()
      }
    } catch (err) {
      console.error('Failed to check repository:', err)
    }
  }

  const getSyncHistory = async () => {
    try {
      const response = await fetch(`/api/github/sync?action=sync_history&sessionId=${sessionId}`)
      const data = await response.json()
      
      if (data.history && data.history.length > 0) {
        const lastSync = data.history[0]
        setSyncStatus({
          lastSync: lastSync.synced_at,
          syncType: lastSync.sync_type,
          filesAdded: lastSync.files_added,
          filesModified: lastSync.files_modified,
          filesDeleted: lastSync.files_deleted,
          status: lastSync.sync_status
        })
      }
    } catch (err) {
      console.error('Failed to get sync history:', err)
    }
  }

  const authenticateWithGitHub = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // For demo purposes, using a personal access token flow
      // In production, implement OAuth device flow or GitHub App
      const token = prompt('Enter your GitHub Personal Access Token:')
      
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/github/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'authenticate',
          accessToken: token
        })
      })

      const data = await response.json()

      if (data.success) {
        setIsAuthenticated(true)
        setGithubUser(data.user.login)
      } else {
        setError(data.error || 'Authentication failed')
      }
    } catch (err) {
      setError('Failed to authenticate with GitHub')
    } finally {
      setIsLoading(false)
    }
  }

  const createRepository = async () => {
    if (!sandboxId) {
      setError('No sandbox available. Start development first.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_repository',
          sessionId,
          sandboxId,
          workspaceName,
          projectName,
          description: `Target app generated by PRIA App Builder for ${projectName}`
        })
      })

      const data = await response.json()

      if (data.success) {
        setRepository(data.repository)
      } else {
        setError(data.error || 'Failed to create repository')
      }
    } catch (err) {
      setError('Failed to create repository')
    } finally {
      setIsLoading(false)
    }
  }

  const pushToGitHub = async (options: {
    createPullRequest?: boolean
    targetBranch?: string
    skipEmptyCommit?: boolean
    includePatterns?: string[]
    excludePatterns?: string[]
  } = {}) => {
    if (!sandboxId || !repository) {
      setError('Repository or sandbox not available')
      return
    }

    setIsLoading(true)
    setError(null)
    setConflicts([])

    try {
      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'push_to_github',
          sessionId,
          sandboxId,
          commitMessage: commitMessage || `Update target app - ${new Date().toLocaleString()}`,
          branch: repository.default_branch,
          ...options
        })
      })

      const data = await response.json()

      if (data.success) {
        setCurrentOperation(data.operation)
        setSyncStatus({
          lastSync: new Date().toISOString(),
          syncType: 'push',
          filesAdded: data.summary.filesAdded,
          filesModified: data.summary.filesModified,
          filesDeleted: data.summary.filesDeleted,
          status: data.operation.status === 'completed' ? 'success' : 'failed'
        })
        setCommitMessage('')
        
        // Show next actions if available
        if (data.nextActions && data.nextActions.length > 0) {
          console.log('Next actions:', data.nextActions)
        }
      } else {
        setError(data.error || 'Push failed')
        setSyncStatus({ ...syncStatus, status: 'failed' })
      }
    } catch (err) {
      setError('Failed to push to GitHub')
      setSyncStatus({ ...syncStatus, status: 'failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const pullFromGitHub = async (options: {
    strategy?: 'merge' | 'rebase' | 'reset'
    resolveConflicts?: boolean
    backupLocal?: boolean
  } = {}) => {
    if (!sandboxId || !repository) {
      setError('Repository or sandbox not available')
      return
    }

    setIsLoading(true)
    setError(null)
    setConflicts([])

    try {
      const response = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pull_from_github',
          sessionId,
          sandboxId,
          branch: repository.default_branch,
          ...options
        })
      })

      const data = await response.json()

      if (data.success) {
        setCurrentOperation(data.operation)
        setSyncStatus({
          lastSync: new Date().toISOString(),
          syncType: 'pull',
          filesAdded: data.summary.filesAdded,
          filesModified: data.summary.filesModified,
          filesDeleted: data.summary.filesDeleted,
          status: data.operation.status === 'completed' ? 'success' : 
                  data.operation.status === 'conflict' ? 'conflict' : 'failed'
        })
        
        // Handle conflicts
        if (data.conflicts && data.conflicts.length > 0) {
          setConflicts(data.conflicts)
          setSyncStatus(prev => ({ ...prev, status: 'conflict' }))
        }
        
        // Show next actions if available
        if (data.nextActions && data.nextActions.length > 0) {
          console.log('Next actions:', data.nextActions)
        }
      } else {
        setError(data.error || 'Pull failed')
        setSyncStatus({ ...syncStatus, status: 'failed' })
      }
    } catch (err) {
      setError('Failed to pull from GitHub')
      setSyncStatus({ ...syncStatus, status: 'failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const checkSetupStatus = async () => {
    try {
      const response = await fetch(`/api/github/setup?sessionId=${sessionId}&action=status`)
      const data = await response.json()
      
      if (data.success && data.setup) {
        setSetupStatus(data.setup)
      }
    } catch (err) {
      console.error('Failed to check setup status:', err)
    }
  }

  const checkSandboxSetup = async () => {
    if (!sandboxId) return

    try {
      const response = await fetch(`/api/github/setup?sessionId=${sessionId}&sandboxId=${sandboxId}&action=sandbox_info`)
      const data = await response.json()
      
      if (data.success && data.sandbox) {
        setGitConfig(data.sandbox.gitConfig)
        setSetupStatus(prev => ({
          ...prev,
          configured: data.sandbox.githubSetup
        }))
      }
    } catch (err) {
      console.error('Failed to check sandbox setup:', err)
    }
  }

  const setupGitHubInSandbox = async () => {
    if (!sandboxId) {
      setError('No sandbox available. Start development first.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/github/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup',
          sessionId,
          sandboxId,
          repositoryUrl: repository?.clone_url,
          branch: repository?.default_branch
        })
      })

      const data = await response.json()

      if (data.success) {
        setSetupStatus({
          configured: true,
          status: 'completed',
          lastSetup: new Date().toISOString(),
          errors: []
        })
        await checkSandboxSetup()
      } else {
        setSetupStatus({
          configured: false,
          status: 'failed',
          errors: data.errors || [data.error || 'Setup failed']
        })
        setError(data.error || 'GitHub setup failed')
      }
    } catch (err) {
      setError('Failed to setup GitHub in sandbox')
      setSetupStatus({
        configured: false,
        status: 'failed',
        errors: ['Network error during setup']
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createProjectStructure = async () => {
    if (!sandboxId) {
      setError('No sandbox available.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/github/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_project_structure',
          sessionId,
          sandboxId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Refresh setup status
        await checkSandboxSetup()
      } else {
        setError(data.error || 'Failed to create project structure')
      }
    } catch (err) {
      setError('Failed to create project structure')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Target App GitHub Integration
          </CardTitle>
          <CardDescription>
            Connect your GitHub account to sync the generated target app code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>GitHub Authentication Required</AlertTitle>
            <AlertDescription>
              Connect your GitHub account to enable version control for your target app.
              The generated application code will be synced to a private repository.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={authenticateWithGitHub}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Github className="h-4 w-4 mr-2" />
            )}
            Connect GitHub Account
          </Button>

          {error && (
            <Alert variant="destructive">
              <X className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Target App Repository
            </CardTitle>
            <CardDescription>
              Sync your generated application code with GitHub
            </CardDescription>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Check className="h-3 w-3" />
            {githubUser}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!repository ? (
          <>
            <Alert>
              <FolderGit className="h-4 w-4" />
              <AlertTitle>No Repository Created</AlertTitle>
              <AlertDescription>
                Create a GitHub repository to sync your target app code.
              </AlertDescription>
            </Alert>

            <Button 
              onClick={createRepository}
              disabled={isLoading || !sandboxId}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderGit className="h-4 w-4 mr-2" />
              )}
              Create Repository
            </Button>

            {!sandboxId && (
              <p className="text-sm text-muted-foreground text-center">
                Start development first to enable repository creation
              </p>
            )}
          </>
        ) : (
          <>
            {/* Repository Info */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Repository</span>
                <a 
                  href={repository.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {repository.name}
                  <Link className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Branch</span>
                <span className="text-sm flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {repository.default_branch}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Visibility</span>
                <Badge variant={repository.private ? "secondary" : "default"}>
                  {repository.private ? 'Private' : 'Public'}
                </Badge>
              </div>
            </div>

            {/* Sandbox Setup Status */}
            {sandboxId && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sandbox Setup</span>
                  <Badge 
                    variant={setupStatus.configured ? 'default' : 'secondary'}
                    className="flex items-center gap-1"
                  >
                    {setupStatus.configured ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Settings className="h-3 w-3" />
                    )}
                    {setupStatus.configured ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
                
                {gitConfig.version && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Git: {gitConfig.version}</div>
                    {gitConfig.userName && <div>User: {gitConfig.userName}</div>}
                    {gitConfig.userEmail && <div>Email: {gitConfig.userEmail}</div>}
                  </div>
                )}

                {!setupStatus.configured && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Setup GitHub access in the sandbox to enable code synchronization.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={setupGitHubInSandbox}
                        disabled={isLoading}
                        size="sm"
                        className="flex-1"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Settings className="h-4 w-4 mr-2" />
                        )}
                        Setup GitHub
                      </Button>
                      <Button 
                        onClick={createProjectStructure}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Create Structure
                      </Button>
                    </div>
                  </div>
                )}

                {setupStatus.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Setup issues: {setupStatus.errors.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Sync Status */}
            {syncStatus.lastSync && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Sync</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(syncStatus.lastSync).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {syncStatus.filesAdded! > 0 && (
                    <span className="text-green-600">+{syncStatus.filesAdded} added</span>
                  )}
                  {syncStatus.filesModified! > 0 && (
                    <span className="text-yellow-600">~{syncStatus.filesModified} modified</span>
                  )}
                  {syncStatus.filesDeleted! > 0 && (
                    <span className="text-red-600">-{syncStatus.filesDeleted} deleted</span>
                  )}
                </div>
                <Badge 
                  variant={syncStatus.status === 'success' ? 'default' : 'destructive'}
                  className="w-fit"
                >
                  {syncStatus.status === 'success' ? 'Sync Successful' : 'Sync Failed'}
                </Badge>
              </div>
            )}

            {/* Commit Message Input */}
            <div className="space-y-2">
              <Label htmlFor="commit-message">Commit Message</Label>
              <Input
                id="commit-message"
                placeholder="Describe your changes..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Sync Actions */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button 
                  onClick={() => pushToGitHub()}
                  disabled={isLoading || !sandboxId || !setupStatus.configured}
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Push to GitHub
                </Button>
                <Button 
                  onClick={() => pullFromGitHub()}
                  disabled={isLoading || !sandboxId || !setupStatus.configured}
                  variant="outline"
                  className="flex-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Pull from GitHub
                </Button>
              </div>
              
              {/* Advanced Options Toggle */}
              <div className="text-center">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-xs text-muted-foreground"
                >
                  {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                  <Settings className="h-3 w-3 ml-1" />
                </Button>
              </div>
              
              {/* Advanced Options */}
              {showAdvancedOptions && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                  <div className="text-sm font-medium">Push Options</div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => pushToGitHub({ 
                        createPullRequest: true,
                        targetBranch: 'main'
                      })}
                      disabled={isLoading || !sandboxId || !setupStatus.configured}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <GitPullRequest className="h-3 w-3 mr-1" />
                      Push + PR
                    </Button>
                    <Button 
                      onClick={() => pushToGitHub({ 
                        skipEmptyCommit: false
                      })}
                      disabled={isLoading || !sandboxId || !setupStatus.configured}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <GitCommit className="h-3 w-3 mr-1" />
                      Force Push
                    </Button>
                  </div>
                  
                  <div className="text-sm font-medium mt-4">Pull Strategies</div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => pullFromGitHub({ strategy: 'merge' })}
                      disabled={isLoading || !sandboxId || !setupStatus.configured}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Merge
                    </Button>
                    <Button 
                      onClick={() => pullFromGitHub({ strategy: 'rebase' })}
                      disabled={isLoading || !sandboxId || !setupStatus.configured}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Rebase
                    </Button>
                    <Button 
                      onClick={() => pullFromGitHub({ strategy: 'reset' })}
                      disabled={isLoading || !sandboxId || !setupStatus.configured}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Conflicts Display */}
            {conflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Merge Conflicts Detected</AlertTitle>
                <AlertDescription>
                  {conflicts.length} file(s) have conflicts that need to be resolved:
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {conflicts.slice(0, 3).map((conflict, index) => (
                      <li key={index}>{conflict.path}</li>
                    ))}
                    {conflicts.length > 3 && (
                      <li>...and {conflicts.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Current Operation Status */}
            {currentOperation && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Operation</span>
                  <Badge 
                    variant={currentOperation.status === 'completed' ? 'default' : 
                            currentOperation.status === 'failed' ? 'destructive' : 'secondary'}
                  >
                    {currentOperation.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentOperation.type} • {currentOperation.id}
                </div>
                {currentOperation.commit && (
                  <div className="text-xs">
                    <div className="font-mono">{currentOperation.commit.sha.substring(0, 8)}</div>
                    <div className="text-muted-foreground">{currentOperation.commit.message}</div>
                  </div>
                )}
              </div>
            )}

            {!sandboxId && (
              <p className="text-sm text-muted-foreground text-center">
                Sandbox not available. Start development to enable sync.
              </p>
            )}

            {sandboxId && !setupStatus.configured && (
              <p className="text-sm text-muted-foreground text-center">
                Setup GitHub in sandbox to enable push/pull operations.
              </p>
            )}
          </>
        )}

        {error && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export default TargetAppGitHubSync