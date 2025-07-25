'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Hammer, FolderPlus, GitFork, ExternalLink, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface ProjectStatus {
  name: string
  path: string
  type: string
  hasGit: boolean
  gitBranch?: string
  packageManager: 'npm' | 'yarn' | 'pnpm'
  scripts: string[]
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  buildStatus?: 'building' | 'success' | 'error'
  previewStatus?: 'starting' | 'running' | 'stopped' | 'error'
  previewUrl?: string
}

interface BuildResult {
  success: boolean
  duration: number
  output: string
  errors?: string[]
}

export function ProjectManager() {
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [buildOutput, setBuildOutput] = useState<string>('')
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCloneProject, setShowCloneProject] = useState(false)

  useEffect(() => {
    loadProjectStatus()
  }, [])

  const loadProjectStatus = async () => {
    try {
      const response = await fetch('/api/project/status')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const status = await response.json()
      setProjectStatus(status)
    } catch (error) {
      console.error('Error loading project status:', error)
      setError('Failed to load project status')
    }
  }

  const startPreview = async () => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/project/preview', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start preview')
      }

      const result = await response.json()
      setSuccessMessage('Preview server started successfully')
      await loadProjectStatus()
    } catch (error) {
      console.error('Error starting preview:', error)
      setError(error instanceof Error ? error.message : 'Failed to start preview')
    } finally {
      setIsLoading(false)
    }
  }

  const buildProject = async () => {
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    setBuildOutput('')

    try {
      const response = await fetch('/api/project/build', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Build failed')
      }

      const result: BuildResult = await response.json()
      setBuildOutput(result.output)
      
      if (result.success) {
        setSuccessMessage(`Build completed successfully in ${result.duration}ms`)
      } else {
        setError('Build failed')
      }
      
      await loadProjectStatus()
    } catch (error) {
      console.error('Error building project:', error)
      setError(error instanceof Error ? error.message : 'Failed to build project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Project Manager</h2>
            <p className="text-muted-foreground">Manage your development project</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateProject(true)}
              className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <FolderPlus size={16} />
              New Project
            </button>
            <button
              onClick={() => setShowCloneProject(true)}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              <GitFork size={16} />
              Clone Repository
            </button>
          </div>
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

        {/* Project Status */}
        {projectStatus && (
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold">{projectStatus.name}</h3>
                <p className="text-muted-foreground text-sm">{projectStatus.path}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="bg-secondary px-2 py-1 rounded">{projectStatus.type}</span>
                  <span className="bg-secondary px-2 py-1 rounded">{projectStatus.packageManager}</span>
                  {projectStatus.hasGit && (
                    <span className="bg-secondary px-2 py-1 rounded">
                      Git: {projectStatus.gitBranch}
                    </span>
                  )}
                </div>
              </div>
              
              {projectStatus.previewUrl && (
                <a
                  href={projectStatus.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  <ExternalLink size={16} />
                  Open Preview
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className={`text-2xl mb-2 ${
                  projectStatus.previewStatus === 'running' ? 'text-green-600' :
                  projectStatus.previewStatus === 'error' ? 'text-red-600' :
                  'text-muted-foreground'
                }`}>
                  {projectStatus.previewStatus === 'running' ? '🟢' :
                   projectStatus.previewStatus === 'starting' ? '🟡' :
                   projectStatus.previewStatus === 'error' ? '🔴' : '⚪'}
                </div>
                <div className="text-sm font-medium capitalize">{projectStatus.previewStatus || 'stopped'}</div>
                <button
                  onClick={startPreview}
                  disabled={isLoading || projectStatus.previewStatus === 'running'}
                  className="mt-2 flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                >
                  <Play size={14} />
                  Start Dev Server
                </button>
              </div>

              <div className="text-center">
                <div className={`text-2xl mb-2 ${
                  projectStatus.buildStatus === 'success' ? 'text-green-600' :
                  projectStatus.buildStatus === 'error' ? 'text-red-600' :
                  projectStatus.buildStatus === 'building' ? 'text-yellow-600' :
                  'text-muted-foreground'
                }`}>
                  {projectStatus.buildStatus === 'success' ? '✅' :
                   projectStatus.buildStatus === 'building' ? '🔄' :
                   projectStatus.buildStatus === 'error' ? '❌' : '⚪'}
                </div>
                <div className="text-sm font-medium capitalize">{projectStatus.buildStatus || 'not built'}</div>
                <button
                  onClick={buildProject}
                  disabled={isLoading}
                  className="mt-2 flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
                  Build Project
                </button>
              </div>

              <div className="text-center">
                <div className="text-2xl mb-2">📦</div>
                <div className="text-sm font-medium">Dependencies</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Object.keys(projectStatus.dependencies).length} prod,{' '}
                  {Object.keys(projectStatus.devDependencies).length} dev
                </div>
              </div>
            </div>

            {/* Scripts */}
            {projectStatus.scripts.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Available Scripts</h4>
                <div className="flex flex-wrap gap-2">
                  {projectStatus.scripts.map((script) => (
                    <span
                      key={script}
                      className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm font-mono"
                    >
                      npm run {script}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Dependencies</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(projectStatus.dependencies).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No dependencies</p>
                  ) : (
                    Object.entries(projectStatus.dependencies).map(([name, version]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="font-mono">{name}</span>
                        <span className="text-muted-foreground">{version}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Dev Dependencies</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(projectStatus.devDependencies).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No dev dependencies</p>
                  ) : (
                    Object.entries(projectStatus.devDependencies).map(([name, version]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="font-mono">{name}</span>
                        <span className="text-muted-foreground">{version}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Build Output */}
        {buildOutput && (
          <div className="bg-card p-4 rounded-lg border border-border">
            <h3 className="font-semibold mb-3">Build Output</h3>
            <pre className="bg-secondary p-3 rounded text-sm overflow-x-auto max-h-60 overflow-y-auto">
              <code>{buildOutput}</code>
            </pre>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateProject && (
          <CreateProjectModal
            onClose={() => setShowCreateProject(false)}
            onSuccess={() => {
              setShowCreateProject(false)
              loadProjectStatus()
            }}
          />
        )}

        {/* Clone Project Modal */}
        {showCloneProject && (
          <CloneProjectModal
            onClose={() => setShowCloneProject(false)}
            onSuccess={() => {
              setShowCloneProject(false)
              loadProjectStatus()
            }}
          />
        )}
      </div>
    </div>
  )
}

function CreateProjectModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState<'nextjs' | 'react' | 'vue' | 'custom'>('nextjs')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/project/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          template,
          description: description.trim() || undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      onSuccess()
    } catch (error) {
      console.error('Error creating project:', error)
      setError(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
        
        {error && (
          <div className="text-destructive text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium mb-1">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="my-awesome-project"
              required
            />
          </div>

          <div>
            <label htmlFor="template" className="block text-sm font-medium mb-1">
              Template
            </label>
            <select
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="nextjs">Next.js</option>
              <option value="react">React</option>
              <option value="vue">Vue.js</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Project description..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CloneProjectModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gitUrl.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/project/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitUrl: gitUrl.trim(),
          branch: branch.trim() || undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clone repository')
      }

      onSuccess()
    } catch (error) {
      console.error('Error cloning repository:', error)
      setError(error instanceof Error ? error.message : 'Failed to clone repository')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Clone Repository</h3>
        
        {error && (
          <div className="text-destructive text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="git-url" className="block text-sm font-medium mb-1">
              Git URL
            </label>
            <input
              id="git-url"
              type="url"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://github.com/user/repo.git"
              required
            />
          </div>

          <div>
            <label htmlFor="branch" className="block text-sm font-medium mb-1">
              Branch (Optional)
            </label>
            <input
              id="branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="main"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={!gitUrl.trim() || isLoading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? 'Cloning...' : 'Clone Repository'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}