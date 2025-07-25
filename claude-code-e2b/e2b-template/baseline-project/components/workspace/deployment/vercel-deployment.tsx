"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Rocket, 
  ExternalLink, 
  Settings, 
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Globe,
  GitBranch,
  Eye,
  Activity,
  Clock,
  Code2
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface VercelDeploymentProps {
  sessionId: string
  workspaceId: string
}

interface Deployment {
  id: string
  url: string
  state: string
  type: string
  created_at: string
  git_branch?: string
  git_commit?: string
}

interface VercelConfig {
  project_id?: string
  org_id?: string
  domain?: string
  production_url?: string
}

export function VercelDeployment({ sessionId, workspaceId }: VercelDeploymentProps) {
  const [config, setConfig] = useState<VercelConfig>({})
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [deployingProduction, setDeployingProduction] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [newConfig, setNewConfig] = useState({
    project_id: '',
    org_id: '',
    domain: ''
  })
  const { toast } = useToast()

  useEffect(() => {
    loadDeployments()
  }, [sessionId])

  const loadDeployments = async () => {
    try {
      const response = await fetch('/api/deploy/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'get_deployments',
          session_id: sessionId
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setDeployments(data.deployments || [])
      }
    } catch (error) {
      console.error('Failed to load deployments:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupVercelProject = async () => {
    if (!newConfig.project_id.trim()) {
      toast({
        title: 'Error',
        description: 'Project ID is required',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/deploy/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'setup_vercel_project',
          session_id: sessionId,
          vercel_project_id: newConfig.project_id,
          vercel_org_id: newConfig.org_id,
          domain_name: newConfig.domain
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      
      setConfig({
        project_id: newConfig.project_id,
        org_id: newConfig.org_id,
        domain: newConfig.domain
      })
      setIsConfigOpen(false)
      
      toast({
        title: 'Success',
        description: 'Vercel project configured successfully'
      })
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to configure Vercel',
        variant: 'destructive'
      })
    }
  }

  const deployPreview = async () => {
    setDeploying(true)
    try {
      const response = await fetch('/api/deploy/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'deploy_preview',
          session_id: sessionId,
          branch_name: 'develop',
          commit_message: `Preview deployment from PRIA - ${new Date().toLocaleString()}`
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Preview deployment started'
        })
        
        // Refresh deployments
        setTimeout(() => loadDeployments(), 2000)
      } else {
        throw new Error(result.error)
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deploy preview',
        variant: 'destructive'
      })
    } finally {
      setDeploying(false)
    }
  }

  const deployProduction = async () => {
    setDeployingProduction(true)
    try {
      const response = await fetch('/api/deploy/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'deploy_production',
          session_id: sessionId,
          commit_message: `Production deployment from PRIA - ${new Date().toLocaleString()}`
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Production deployment started'
        })
        
        setConfig(prev => ({
          ...prev,
          production_url: result.deployment_url
        }))
        
        // Refresh deployments
        setTimeout(() => loadDeployments(), 2000)
      } else {
        throw new Error(result.error)
      }
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deploy to production',
        variant: 'destructive'
      })
    } finally {
      setDeployingProduction(false)
    }
  }

  const getDeploymentStatusColor = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'building':
      case 'queued':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
      case 'canceled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDeploymentIcon = (state: string) => {
    switch (state?.toLowerCase()) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'building':
      case 'queued':
        return <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
      case 'error':
      case 'canceled':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
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
      {/* Deployment Status & Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Vercel Deployment
            </div>
            <div className="flex items-center gap-2">
              {config.project_id && (
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  Connected
                </Badge>
              )}
              <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configure Vercel Project</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Project ID *</label>
                      <Input
                        placeholder="prj_xxxxxxxxxxxxxxxxxxxxx"
                        value={newConfig.project_id}
                        onChange={(e) => setNewConfig({...newConfig, project_id: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Organization ID</label>
                      <Input
                        placeholder="team_xxxxxxxxxxxxxxxxxxxxx"
                        value={newConfig.org_id}
                        onChange={(e) => setNewConfig({...newConfig, org_id: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Custom Domain</label>
                      <Input
                        placeholder="myapp.com"
                        value={newConfig.domain}
                        onChange={(e) => setNewConfig({...newConfig, domain: e.target.value})}
                      />
                    </div>
                    <Button onClick={setupVercelProject} className="w-full">
                      Save Configuration
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!config.project_id ? (
            <div className="text-center py-8">
              <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Configure Vercel Deployment</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Vercel project to enable automatic deployments
              </p>
              <Button onClick={() => setIsConfigOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configure Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Project Info */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Project: {config.project_id}</h4>
                  {config.production_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(config.production_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {config.domain && `Domain: ${config.domain} • `}
                  {config.org_id && `Org: ${config.org_id}`}
                </div>
              </div>

              {/* Deployment Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={deployPreview}
                  disabled={deploying}
                  variant="outline"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying Preview...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Deploy Preview
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={deployProduction}
                  disabled={deployingProduction}
                >
                  {deployingProduction ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deploying Production...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Deploy Production
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={loadDeployments}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployment History */}
      {config.project_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Deployment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deployments.length === 0 ? (
              <div className="text-center py-8">
                <Code2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No deployments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      {getDeploymentIcon(deployment.state)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {deployment.type === 'LAMBDAS' ? 'Production' : 'Preview'}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={getDeploymentStatusColor(deployment.state)}
                          >
                            {deployment.state}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {deployment.git_branch && (
                            <span className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {deployment.git_branch}
                              {deployment.git_commit && ` (${deployment.git_commit})`}
                            </span>
                          )}
                          <span className="ml-2">
                            {new Date(deployment.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {deployment.state === 'ready' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://${deployment.url}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deployment Pipeline Info */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Code2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium">1. E2B Development</h4>
                <p className="text-sm text-muted-foreground">
                  Code and test in isolated sandbox environment
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium">2. GitHub Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Files synced to GitHub repository with version control
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Rocket className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium">3. Vercel Deployment</h4>
                <p className="text-sm text-muted-foreground">
                  Automatic deployment to Vercel with preview and production environments
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}