'use client'

import { useState, useEffect } from 'react'
import { GitBranch, GitCommit, Upload, Download, Plus, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicts: string[]
}

interface CommitInfo {
  hash: string
  message: string
  author: string
  date: string
}

export function GitIntegration() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [commitHistory, setCommitHistory] = useState<CommitInfo[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadGitStatus()
    loadCommitHistory()
  }, [])

  const loadGitStatus = async () => {
    try {
      const response = await fetch('/api/git/status')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const status = await response.json()
      setGitStatus(status)
    } catch (error) {
      console.error('Error loading git status:', error)
      setError('Failed to load git status')
    }
  }

  const loadCommitHistory = async () => {
    try {
      const response = await fetch('/api/git/history?limit=10')
      if (!response.ok) {
        // Git history might not be available, that's ok
        return
      }
      const history = await response.json()
      setCommitHistory(history)
    } catch (error) {
      console.error('Error loading commit history:', error)
    }
  }

  const commitChanges = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/git/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Commit failed')
      }

      const result = await response.json()
      setSuccessMessage(`Committed ${result.filesCommitted} files`)
      setCommitMessage('')
      await loadGitStatus()
      await loadCommitHistory()
    } catch (error) {
      console.error('Error committing changes:', error)
      setError(error instanceof Error ? error.message : 'Failed to commit changes')
    } finally {
      setIsLoading(false)
    }
  }

  const pushChanges = async () => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/git/push', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Push failed')
      }

      setSuccessMessage('Successfully pushed changes')
      await loadGitStatus()
    } catch (error) {
      console.error('Error pushing changes:', error)
      setError(error instanceof Error ? error.message : 'Failed to push changes')
    } finally {
      setIsLoading(false)
    }
  }

  const pullChanges = async () => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/git/pull', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Pull failed')
      }

      const result = await response.json()
      setSuccessMessage(`Pulled ${result.changes} changes`)
      await loadGitStatus()
      await loadCommitHistory()
    } catch (error) {
      console.error('Error pulling changes:', error)
      setError(error instanceof Error ? error.message : 'Failed to pull changes')
    } finally {
      setIsLoading(false)
    }
  }

  const createBranch = async () => {
    const branchName = prompt('Enter new branch name:')
    if (!branchName) return

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/git/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: branchName,
          action: 'create_and_switch'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Branch creation failed')
      }

      setSuccessMessage(`Created and switched to branch: ${branchName}`)
      await loadGitStatus()
    } catch (error) {
      console.error('Error creating branch:', error)
      setError(error instanceof Error ? error.message : 'Failed to create branch')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (type: 'staged' | 'modified' | 'untracked' | 'conflicts') => {
    switch (type) {
      case 'staged':
        return 'text-green-600'
      case 'modified':
        return 'text-yellow-600'
      case 'untracked':
        return 'text-blue-600'
      case 'conflicts':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Git Integration</h2>
            <p className="text-muted-foreground">Version control for your project</p>
          </div>
          <button
            onClick={() => {
              loadGitStatus()
              loadCommitHistory()
            }}
            className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-100 text-green-800 rounded-lg">
            <CheckCircle size={16} />
            {successMessage}
          </div>
        )}

        {/* Repository Status */}
        {gitStatus && (
          <div className="bg-card p-4 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Repository Status</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <GitBranch size={14} />
                  <span>{gitStatus.branch}</span>
                </div>
                {gitStatus.ahead > 0 && (
                  <span className="text-green-600">↑{gitStatus.ahead}</span>
                )}
                {gitStatus.behind > 0 && (
                  <span className="text-red-600">↓{gitStatus.behind}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{gitStatus.staged.length}</div>
                <div className="text-sm text-muted-foreground">Staged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{gitStatus.modified.length}</div>
                <div className="text-sm text-muted-foreground">Modified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{gitStatus.untracked.length}</div>
                <div className="text-sm text-muted-foreground">Untracked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{gitStatus.conflicts.length}</div>
                <div className="text-sm text-muted-foreground">Conflicts</div>
              </div>
            </div>

            {/* File Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {gitStatus.staged.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">Staged Files</h4>
                  <div className="space-y-1 text-sm">
                    {gitStatus.staged.map((file, index) => (
                      <div key={index} className="font-mono bg-secondary/50 px-2 py-1 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gitStatus.modified.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-600 mb-2">Modified Files</h4>
                  <div className="space-y-1 text-sm">
                    {gitStatus.modified.map((file, index) => (
                      <div key={index} className="font-mono bg-secondary/50 px-2 py-1 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gitStatus.untracked.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">Untracked Files</h4>
                  <div className="space-y-1 text-sm">
                    {gitStatus.untracked.map((file, index) => (
                      <div key={index} className="font-mono bg-secondary/50 px-2 py-1 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gitStatus.conflicts.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Conflicts</h4>
                  <div className="space-y-1 text-sm">
                    {gitStatus.conflicts.map((file, index) => (
                      <div key={index} className="font-mono bg-secondary/50 px-2 py-1 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Commit Section */}
        <div className="bg-card p-4 rounded-lg border border-border">
          <h3 className="text-lg font-semibold mb-4">Commit Changes</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="commit-message" className="block text-sm font-medium mb-2">
                Commit Message
              </label>
              <textarea
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Enter commit message..."
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={commitChanges}
                disabled={!commitMessage.trim() || isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GitCommit size={16} />
                Commit
              </button>

              <button
                onClick={pushChanges}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
              >
                <Upload size={16} />
                Push
              </button>

              <button
                onClick={pullChanges}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
              >
                <Download size={16} />
                Pull
              </button>

              <button
                onClick={createBranch}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50"
              >
                <Plus size={16} />
                New Branch
              </button>
            </div>
          </div>
        </div>

        {/* Commit History */}
        {commitHistory.length > 0 && (
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="text-lg font-semibold mb-4">Recent Commits</h3>
            
            <div className="space-y-3">
              {commitHistory.map((commit, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-secondary/50 rounded">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{commit.message}</div>
                    <div className="text-sm text-muted-foreground">
                      <span>{commit.author}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(commit.date)}</span>
                      <span className="mx-2">•</span>
                      <span className="font-mono">{commit.hash.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}