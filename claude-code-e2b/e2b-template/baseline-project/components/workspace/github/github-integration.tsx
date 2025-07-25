"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Github, 
  GitBranch, 
  History, 
  Upload, 
  ExternalLink, 
  Settings, 
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Folder,
  File
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface GitHubIntegrationProps {
  sessionId: string
  workspaceId: string
}

interface GitHubStatus {
  connected: boolean
  repository?: {
    owner: string
    repo: string
    url: string
    branch: string
  }
}

interface RepositoryInfo {
  name: string
  full_name: string
  html_url: string
  clone_url: string
  default_branch: string
}

interface FileItem {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
}

interface CommitHistory {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

export function GitHubIntegration({ sessionId, workspaceId }: GitHubIntegrationProps) {
  const [status, setStatus] = useState<GitHubStatus>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [repoInfo, setRepoInfo] = useState<RepositoryInfo | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [commitHistory, setCommitHistory] = useState<CommitHistory[]>([])
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDescription, setNewRepoDescription] = useState('')
  const [isCreateRepoOpen, setIsCreateRepoOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchGitHubStatus()
  }, [sessionId])

  const fetchGitHubStatus = async () => {
    try {
      const response = await fetch(`/api/github/auth?action=status`)
      if (!response.ok) throw new Error('Failed to fetch GitHub status')
      
      const data = await response.json()
      setStatus(data)
      
      if (data.connected && data.repository) {
        await fetchRepositoryInfo()
        await fetchFiles()
        await fetchCommitHistory()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load GitHub status',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchRepositoryInfo = async () => {
    try {
      const response = await fetch('/api/github/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'get_repository_info',
          session_id: sessionId
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setRepoInfo(data.repository)
      }
    } catch (error) {
      console.error('Failed to fetch repository info:', error)
    }
  }

  const fetchFiles = async (path: string = '') => {
    try {
      const response = await fetch('/api/github/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'list_files',
          session_id: sessionId,
          path
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files)
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    }
  }

  const fetchCommitHistory = async () => {
    try {
      const response = await fetch('/api/github/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'get_file_history',
          session_id: sessionId,
          limit: 5
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCommitHistory(data.history)
      }
    } catch (error) {
      console.error('Failed to fetch commit history:', error)
    }
  }

  const handleConnectGitHub = async () => {
    try {
      const response = await fetch(`/api/github/auth?action=authorize`)
      if (!response.ok) throw new Error('Failed to get authorization URL')
      
      const data = await response.json()
      window.open(data.authorization_url, '_blank', 'width=600,height=700')
      
      // Poll for connection status
      const pollInterval = setInterval(async () => {
        await fetchGitHubStatus()
        if (status.connected) {
          clearInterval(pollInterval)
          toast({
            title: 'Success',
            description: 'GitHub connected successfully'
          })
        }
      }, 2000)
      
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000)
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect to GitHub',
        variant: 'destructive'
      })
    }
  }

  const handleDisconnectGitHub = async () => {
    try {
      const response = await fetch('/api/github/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' })
      })
      
      if (!response.ok) throw new Error('Failed to disconnect')
      
      setStatus({ connected: false })
      setRepoInfo(null)
      setFiles([])
      setCommitHistory([])
      
      toast({
        title: 'Success',
        description: 'GitHub disconnected successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect GitHub',
        variant: 'destructive'
      })
    }
  }

  const handleCreateRepository = async () => {
    if (!newRepoName.trim()) return
    
    setCreating(true)
    try {
      const response = await fetch('/api/github/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_repository',
          session_id: sessionId,
          name: newRepoName,
          description: newRepoDescription,
          private: true
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      
      const data = await response.json()
      setRepoInfo(data.repository)
      setNewRepoName('')
      setNewRepoDescription('')
      setIsCreateRepoOpen(false)
      
      await fetchGitHubStatus()
      
      toast({
        title: 'Success',
        description: 'Repository created successfully'
      })
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create repository',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleSyncFiles = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/github/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'sync_files',
          session_id: sessionId
        })
      })
      
      if (!response.ok) throw new Error('Failed to sync files')
      
      const data = await response.json()
      
      if (data.commit) {
        await fetchFiles()
        await fetchCommitHistory()
        
        toast({
          title: 'Success',
          description: `Synced ${data.files_synced} files to GitHub`
        })
      } else {
        toast({
          title: 'Info',
          description: data.message || 'No files to sync'
        })
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync files to GitHub',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Integration
            {status.connected ? (
              <Badge variant="default" className="ml-auto">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!status.connected ? (
            <div className="text-center py-8">
              <Github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Connect to GitHub</h3>
              <p className="text-muted-foreground mb-4">
                Connect your GitHub account to enable version control and collaboration
              </p>
              <Button onClick={handleConnectGitHub}>
                <Github className="h-4 w-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Repository Info */}
              {repoInfo && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{repoInfo.full_name}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(repoInfo.html_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {status.repository?.branch || repoInfo.default_branch}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                {!repoInfo && (
                  <Dialog open={isCreateRepoOpen} onOpenChange={setIsCreateRepoOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Repository
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Repository</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Repository name"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                        />
                        <Input
                          placeholder="Description (optional)"
                          value={newRepoDescription}
                          onChange={(e) => setNewRepoDescription(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleCreateRepository}
                            disabled={creating || !newRepoName.trim()}
                            className="flex-1"
                          >
                            {creating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create Repository'
                            )}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setIsCreateRepoOpen(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                <Button 
                  onClick={handleSyncFiles}
                  disabled={syncing || !status.repository}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Sync Files
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={fetchGitHubStatus}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleDisconnectGitHub}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repository Files */}
      {status.connected && files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Repository Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                >
                  {file.type === 'dir' ? (
                    <Folder className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="flex-1">{file.name}</span>
                  {file.size && (
                    <span className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit History */}
      {status.connected && commitHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Commits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commitHistory.map((commit) => (
                <div
                  key={commit.sha}
                  className="border-l-2 border-gray-200 dark:border-gray-700 pl-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{commit.message}</p>
                      <p className="text-xs text-muted-foreground">
                        by {commit.author} • {new Date(commit.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(commit.url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}