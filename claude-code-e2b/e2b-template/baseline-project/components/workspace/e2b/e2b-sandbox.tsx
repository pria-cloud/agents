"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Play, 
  Square, 
  Terminal, 
  ExternalLink, 
  Settings, 
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  Package,
  FileText,
  Folder,
  Monitor
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface E2BSandboxProps {
  sessionId: string
  workspaceId: string
}

interface SandboxSession {
  id: string
  url: string
  status: 'creating' | 'ready' | 'error' | 'stopped'
  template?: string
  created_at: Date
}

interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
}

interface FileItem {
  path: string
  fullPath: string
  content: string
  size: number
}

export function E2BSandbox({ sessionId, workspaceId }: E2BSandboxProps) {
  const [sandbox, setSandbox] = useState<SandboxSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [startingServer, setStartingServer] = useState(false)
  const [command, setCommand] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [commandResults, setCommandResults] = useState<CommandResult[]>([])
  const [executing, setExecuting] = useState(false)
  const [fileTree, setFileTree] = useState<FileItem[]>([])
  const [packageName, setPackageName] = useState('')
  const [installing, setInstalling] = useState(false)
  const [devServerUrl, setDevServerUrl] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    checkSandboxStatus()
  }, [sessionId])

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [commandResults])

  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'status',
          session_id: sessionId
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.status === 'ready') {
          // Get sandbox info from session (this would need to be stored)
          setSandbox({
            id: 'existing',
            url: '', // Would need to fetch from session
            status: 'ready',
            created_at: new Date()
          })
        }
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error)
    } finally {
      setLoading(false)
    }
  }

  const createSandbox = async () => {
    setCreating(true)
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create',
          session_id: sessionId,
          template: 'next-js',
          environment: {
            NODE_ENV: 'development'
          }
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create sandbox')
      }
      
      const data = await response.json()
      setSandbox(data.sandbox)
      
      toast({
        title: 'Success',
        description: 'Sandbox created successfully'
      })
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create sandbox',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const stopSandbox = async () => {
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'stop',
          session_id: sessionId
        })
      })
      
      if (response.ok) {
        setSandbox(prev => prev ? { ...prev, status: 'stopped' } : null)
        setDevServerUrl(null)
        
        toast({
          title: 'Success',
          description: 'Sandbox stopped'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to stop sandbox',
        variant: 'destructive'
      })
    }
  }

  const deployFiles = async () => {
    setDeploying(true)
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'deploy_files',
          session_id: sessionId,
          target_directory: '/home/user/project'
        })
      })
      
      if (!response.ok) throw new Error('Failed to deploy files')
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Deployed ${result.deployed} files`
        })
        
        // Refresh file tree
        await getFileTree()
      } else {
        toast({
          title: 'Warning',
          description: `Deployed ${result.deployed} files with ${result.errors.length} errors`,
          variant: 'destructive'
        })
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deploy files',
        variant: 'destructive'
      })
    } finally {
      setDeploying(false)
    }
  }

  const startDevServer = async () => {
    setStartingServer(true)
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'start_dev_server',
          session_id: sessionId,
          command: 'npm run dev',
          port: 3000,
          working_dir: '/home/user/project'
        })
      })
      
      if (!response.ok) throw new Error('Failed to start dev server')
      
      const result = await response.json()
      
      if (result.success) {
        setDevServerUrl(result.url)
        toast({
          title: 'Success',
          description: 'Development server started'
        })
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to start dev server',
          variant: 'destructive'
        })
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start development server',
        variant: 'destructive'
      })
    } finally {
      setStartingServer(false)
    }
  }

  const executeCommand = async () => {
    if (!command.trim()) return
    
    setExecuting(true)
    try {
      const response = await fetch('/api/e2b/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'execute_command',
          session_id: sessionId,
          command: command.trim(),
          working_dir: '/home/user/project'
        })
      })
      
      if (!response.ok) throw new Error('Failed to execute command')
      
      const data = await response.json()
      
      // Add to history and results
      setCommandHistory(prev => [...prev, command.trim()])
      setCommandResults(prev => [...prev, data.result])
      setCommand('')
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute command',
        variant: 'destructive'
      })
    } finally {
      setExecuting(false)
    }
  }

  const installPackage = async () => {
    if (!packageName.trim()) return
    
    setInstalling(true)
    try {
      const response = await fetch('/api/e2b/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'install_packages',
          session_id: sessionId,
          packages: [packageName.trim()],
          working_dir: '/home/user/project'
        })
      })
      
      if (!response.ok) throw new Error('Failed to install package')
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Package ${packageName} installed`
        })
        setPackageName('')
        
        // Add to command results
        setCommandResults(prev => [...prev, result.result])
      } else {
        toast({
          title: 'Error',
          description: 'Package installation failed',
          variant: 'destructive'
        })
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to install package',
        variant: 'destructive'
      })
    } finally {
      setInstalling(false)
    }
  }

  const getFileTree = async () => {
    try {
      const response = await fetch('/api/e2b/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'get_file_tree',
          session_id: sessionId,
          root_path: '/home/user/project'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setFileTree(data.files)
      }
    } catch (error) {
      console.error('Failed to get file tree:', error)
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
      {/* Sandbox Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              E2B Development Sandbox
            </div>
            {sandbox && (
              <Badge variant={sandbox.status === 'ready' ? 'default' : 'secondary'}>
                <CheckCircle className="h-3 w-3 mr-1" />
                {sandbox.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sandbox ? (
            <div className="text-center py-8">
              <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Create Development Sandbox</h3>
              <p className="text-muted-foreground mb-4">
                Launch an isolated development environment with your project files
              </p>
              <Button onClick={createSandbox} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Create Sandbox
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sandbox Info */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Sandbox ID: {sandbox.id}</h4>
                  <div className="flex gap-2">
                    {sandbox.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(sandbox.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    {devServerUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(devServerUrl, '_blank')}
                      >
                        <Monitor className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Template: {sandbox.template || 'next-js'} • 
                  Created: {sandbox.created_at.toLocaleString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={deployFiles}
                  disabled={deploying || sandbox.status !== 'ready'}
                >
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Deploy Files
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={startDevServer}
                  disabled={startingServer || sandbox.status !== 'ready'}
                  variant="outline"
                >
                  {startingServer ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Dev Server
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={getFileTree}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Files
                </Button>
                
                <Button 
                  onClick={stopSandbox}
                  variant="destructive"
                  disabled={sandbox.status !== 'ready'}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Sandbox
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sandbox Tools */}
      {sandbox && sandbox.status === 'ready' && (
        <Tabs defaultValue="terminal" className="space-y-4">
          <TabsList>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
          </TabsList>

          {/* Terminal */}
          <TabsContent value="terminal">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Terminal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Command Input */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter command..."
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
                    className="font-mono"
                  />
                  <Button 
                    onClick={executeCommand}
                    disabled={executing || !command.trim()}
                  >
                    {executing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Execute'
                    )}
                  </Button>
                </div>

                {/* Terminal Output */}
                <div 
                  ref={terminalRef}
                  className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto"
                >
                  {commandResults.length === 0 ? (
                    <div className="text-gray-500">Terminal ready. Enter commands above.</div>
                  ) : (
                    commandResults.map((result, index) => (
                      <div key={index} className="mb-4">
                        <div className="text-blue-400">$ {commandHistory[index]}</div>
                        {result.stdout && (
                          <div className="text-green-400 whitespace-pre-wrap">{result.stdout}</div>
                        )}
                        {result.stderr && (
                          <div className="text-red-400 whitespace-pre-wrap">{result.stderr}</div>
                        )}
                        <div className="text-gray-500 text-xs">
                          Exit code: {result.exitCode} • Duration: {result.duration}ms
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Files */}
          <TabsContent value="files">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Project Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fileTree.length === 0 ? (
                  <div className="text-center py-8">
                    <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No files found. Deploy your files first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fileTree.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                      >
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="flex-1">{file.path}</span>
                        <span className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Packages */}
          <TabsContent value="packages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Package Manager
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Package name (e.g., lodash, @types/node)"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && installPackage()}
                  />
                  <Button 
                    onClick={installPackage}
                    disabled={installing || !packageName.trim()}
                  >
                    {installing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      'Install'
                    )}
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Install npm packages in your sandbox environment. 
                  Changes will be reflected in your project.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}