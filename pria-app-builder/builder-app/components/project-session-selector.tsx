'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronDown, 
  Plus, 
  FolderOpen, 
  MessageSquare, 
  Calendar,
  Clock,
  User,
  Search,
  Filter,
  MoreHorizontal,
  Settings,
  Archive
} from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Workspace, Project, Session } from '@/lib/types/database'
import { cn } from '@/lib/utils'

interface ProjectSessionSelectorProps {
  currentWorkspace: Workspace | null
  currentProject: Project | null  
  currentSession: Session | null
  onWorkspaceChange: (workspace: Workspace) => void
  onProjectChange: (project: Project) => void
  onSessionChange: (session: Session) => void
  onCreateNew: () => void
  className?: string
}

interface SessionWithStats {
  session: Session
  messageCount: number
  lastActivity: string
  claudeSessionStatus: string
}

export function ProjectSessionSelector({
  currentWorkspace,
  currentProject,
  currentSession,
  onWorkspaceChange,
  onProjectChange,
  onSessionChange,
  onCreateNew,
  className
}: ProjectSessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  
  // Data state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<SessionWithStats[]>([])
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createType, setCreateType] = useState<'workspace' | 'project' | 'session'>('session')
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    workspaceId: '',
    projectId: ''
  })

  const supabase = createClient()

  // Simple data loading when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces')
      if (!response.ok) {
        throw new Error('Failed to load workspaces')
      }
      const workspacesResult = await response.json()
      setWorkspaces(workspacesResult.workspaces || [])
      return workspacesResult.workspaces || []
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      throw error
    }
  }

  const loadProjectsForWorkspace = async (workspaceId: string) => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      
      if (projectsError) throw projectsError
      setProjects(projectsData || [])
      return projectsData || []
    } catch (error) {
      console.error('Failed to load projects:', error)
      throw error
    }
  }

  const loadSessionsForProject = async (projectId: string) => {
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
      
      if (sessionsError) throw sessionsError
      
      // Get message counts for each session
      const sessionsWithStats: SessionWithStats[] = []
      
      for (const session of sessionsData || []) {
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
        
        sessionsWithStats.push({
          session,
          messageCount: count || 0,
          lastActivity: session.updated_at,
          claudeSessionStatus: session.claude_session_status || 'inactive'
        })
      }
      
      setSessions(sessionsWithStats)
      return sessionsWithStats
    } catch (error) {
      console.error('Failed to load sessions:', error)
      throw error
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Always load workspaces first
      await loadWorkspaces()
      
      // Load projects if we have a current workspace
      if (currentWorkspace) {
        await loadProjectsForWorkspace(currentWorkspace.id)
        
        // Load sessions if we have a current project
        if (currentProject) {
          await loadSessionsForProject(currentProject.id)
        } else {
          setSessions([])
        }
      } else {
        setProjects([])
        setSessions([])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      setError('Failed to load workspaces and projects')
    } finally {
      setLoading(false)
    }
  }

  // Manual refresh methods
  const refreshProjects = async () => {
    if (currentWorkspace) {
      try {
        await loadProjectsForWorkspace(currentWorkspace.id)
      } catch (error) {
        setError('Failed to refresh projects')
      }
    }
  }

  const refreshSessions = async () => {
    if (currentProject) {
      try {
        await loadSessionsForProject(currentProject.id)
      } catch (error) {
        setError('Failed to refresh sessions')
      }
    }
  }

  const handleCreateNew = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (createType === 'workspace') {
        const response = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: createForm.name,
            description: createForm.description
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create workspace')
        }
        
        const { workspace } = await response.json()
        setWorkspaces(prev => [workspace, ...prev])
        onWorkspaceChange(workspace)
        // Refresh projects for the new workspace
        await refreshProjects()
        
      } else if (createType === 'project') {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: currentWorkspace?.id,
            name: createForm.name,
            description: createForm.description
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create project')
        }
        
        const { project } = await response.json()
        setProjects(prev => [project, ...prev])
        onProjectChange(project)
        // Refresh sessions for the new project
        await refreshSessions()
        
      } else if (createType === 'session') {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: currentProject?.id,
            name: createForm.name,
            description: createForm.description
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create session')
        }
        
        const { session } = await response.json()
        const newSessionWithStats: SessionWithStats = {
          session: session,
          messageCount: 0,
          lastActivity: session.created_at,
          claudeSessionStatus: session.claude_session_status || 'inactive'
        }
        setSessions(prev => [newSessionWithStats, ...prev])
        onSessionChange(session)
      }
      
      // Reset form and close dialog
      setCreateForm({ name: '', description: '', workspaceId: '', projectId: '' })
      setShowCreateDialog(false)
      
    } catch (error) {
      console.error('Failed to create:', error)
      setError(`Failed to create ${createType}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = sessions.filter(({ session }) => {
    const matchesSearch = session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && session.status === 'active') ||
                         (statusFilter === 'completed' && session.status === 'completed') ||
                         (statusFilter === 'paused' && session.status === 'paused')
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getClaudeStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'restored_resume': return 'bg-blue-100 text-blue-800'
      case 'restored_replay': return 'bg-purple-100 text-purple-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn("justify-between min-w-[300px]", className)}>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm">
              {currentSession?.name || 'Select Session'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Project & Session</DialogTitle>
          <DialogDescription>
            Choose your workspace, project, and session to continue development
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Workspace and Project Selection */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="workspace-select">Workspace</Label>
              <Select 
                value={currentWorkspace?.id || ''} 
                onValueChange={async (value) => {
                  const workspace = workspaces.find(w => w.id === value)
                  if (workspace) {
                    onWorkspaceChange(workspace)
                    // Clear projects and sessions, then load projects for new workspace
                    setProjects([])
                    setSessions([])
                    try {
                      await loadProjectsForWorkspace(workspace.id)
                    } catch (error) {
                      console.error('Failed to load projects:', error)
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(workspace => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <Label htmlFor="project-select">Project</Label>
              <Select 
                value={currentProject?.id || ''} 
                onValueChange={async (value) => {
                  const project = projects.find(p => p.id === value)
                  if (project) {
                    onProjectChange(project)
                    // Clear sessions, then load sessions for new project
                    setSessions([])
                    try {
                      await loadSessionsForProject(project.id)
                    } catch (error) {
                      console.error('Failed to load sessions:', error)
                    }
                  }
                }}
                disabled={!currentWorkspace}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Session Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setCreateType('session')
                  setShowCreateDialog(true)
                }}
                disabled={!currentProject || loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onCreateNew}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Quick Setup
              </Button>
            </div>
          </div>
          
          {/* Sessions List */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">Loading sessions...</div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">
                    {!currentProject ? 'Select a project to view sessions' : 'No sessions found'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredSessions.map(({ session, messageCount, lastActivity, claudeSessionStatus }) => (
                  <Card 
                    key={session.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      currentSession?.id === session.id && "ring-2 ring-primary"
                    )}
                    onClick={() => {
                      onSessionChange(session)
                      setIsOpen(false)
                    }}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{session.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(session.status)}>
                            {session.status}
                          </Badge>
                          {claudeSessionStatus !== 'inactive' && (
                            <Badge className={getClaudeStatusColor(claudeSessionStatus)}>
                              Claude: {claudeSessionStatus.replace('restored_', '')}
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Settings className="h-4 w-4 mr-2" />
                                Settings
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {session.description && (
                        <CardDescription className="text-sm">
                          {session.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {messageCount} messages
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(lastActivity).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {new Date(session.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* Create New Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New {createType}</DialogTitle>
            <DialogDescription>
              Add a new {createType} to organize your work
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`Enter ${createType} name`}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={`Describe this ${createType}`}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNew} 
                disabled={!createForm.name || loading}
              >
                Create {createType}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}