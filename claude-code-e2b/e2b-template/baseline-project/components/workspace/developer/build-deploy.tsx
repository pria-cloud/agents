"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Zap, 
  Play, 
  Square, 
  RefreshCw, 
  ExternalLink, 
  Settings, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Download,
  Upload,
  Eye,
  RotateCcw,
  GitBranch,
  Monitor
} from "lucide-react"

interface Deployment {
  id: string
  environment: string
  branch: string
  commit: string
  status: 'building' | 'deployed' | 'failed' | 'deploying'
  timestamp: string
  duration: number
  url?: string
  buildLogs?: string[]
}

interface BuildMetrics {
  buildTime: string
  bundleSize: string
  dependencies: number
  testsPassed: number
  testsTotal: number
}

export function BuildDeploy() {
  const [deployments, setDeployments] = useState<Deployment[]>([
    {
      id: '1',
      environment: 'Production',
      branch: 'main',
      commit: 'feat: add user authentication system',
      status: 'deployed',
      timestamp: '2024-01-15T14:30:00Z',
      duration: 3.2,
      url: 'https://myapp.vercel.app',
      buildLogs: [
        'Installing dependencies...',
        'Building application...',
        'Running tests...',
        'Optimizing bundle...',
        'Deployment successful!'
      ]
    },
    {
      id: '2',
      environment: 'Staging',
      branch: 'develop',
      commit: 'fix: resolve cart calculation bug',
      status: 'building',
      timestamp: '2024-01-15T14:25:00Z',
      duration: 0,
      url: 'https://staging-myapp.vercel.app'
    },
    {
      id: '3',
      environment: 'Development',
      branch: 'feature/new-ui',
      commit: 'refactor: update component structure',
      status: 'failed',
      timestamp: '2024-01-15T14:20:00Z',
      duration: 1.8,
      buildLogs: [
        'Installing dependencies...',
        'Building application...',
        'Error: Module not found: ./components/NewComponent',
        'Build failed with exit code 1'
      ]
    }
  ])

  const [buildMetrics] = useState<BuildMetrics>({
    buildTime: '2.3s',
    bundleSize: '245 KB',
    dependencies: 42,
    testsPassed: 23,
    testsTotal: 25
  })

  const [isBuilding, setIsBuilding] = useState(false)
  const [buildProgress, setBuildProgress] = useState(0)
  const [isEnvDialogOpen, setIsEnvDialogOpen] = useState(false)
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null)

  const [envVars, setEnvVars] = useState([
    { key: 'NEXT_PUBLIC_API_URL', value: 'https://api.example.com', environment: 'production' },
    { key: 'DATABASE_URL', value: '••••••••••••••••••••', environment: 'production' },
    { key: 'STRIPE_SECRET_KEY', value: '••••••••••••••••••••', environment: 'production' }
  ])

  const handleBuild = async () => {
    setIsBuilding(true)
    setBuildProgress(0)
    
    const steps = [
      'Installing dependencies...',
      'Building application...',
      'Running tests...',
      'Optimizing bundle...',
      'Build complete!'
    ]
    
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setBuildProgress((i + 1) * 20)
    }
    
    setIsBuilding(false)
  }

  const handleDeploy = async (environment: string) => {
    const newDeployment: Deployment = {
      id: Date.now().toString(),
      environment,
      branch: 'main',
      commit: 'Latest changes',
      status: 'deploying',
      timestamp: new Date().toISOString(),
      duration: 0
    }
    
    setDeployments(prev => [newDeployment, ...prev])
    
    // Simulate deployment
    setTimeout(() => {
      setDeployments(prev => 
        prev.map(dep => 
          dep.id === newDeployment.id 
            ? { ...dep, status: 'deployed', duration: 2.5, url: `https://${environment}-myapp.vercel.app` }
            : dep
        )
      )
    }, 5000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'building': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'deploying': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'default'
      case 'building': return 'secondary'
      case 'deploying': return 'secondary'
      case 'failed': return 'destructive'
      default: return 'outline'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Build & Deploy</h2>
        <div className="flex space-x-2">
          <Button onClick={handleBuild} disabled={isBuilding}>
            <Play className="h-4 w-4 mr-2" />
            {isBuilding ? 'Building...' : 'Build Project'}
          </Button>
          <Button onClick={() => handleDeploy('staging')} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Deploy to Staging
          </Button>
          <Button onClick={() => handleDeploy('production')}>
            <Zap className="h-4 w-4 mr-2" />
            Deploy to Production
          </Button>
        </div>
      </div>

      {/* Build Status */}
      {isBuilding && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Building Project...</h3>
                <Progress value={buildProgress} className="h-2" />
                <p className="text-sm text-gray-600 mt-1">{buildProgress}% complete</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Build Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">{buildMetrics.buildTime}</div>
            <p className="text-sm text-gray-600">Build Time</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">{buildMetrics.bundleSize}</div>
            <p className="text-sm text-gray-600">Bundle Size</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">{buildMetrics.dependencies}</div>
            <p className="text-sm text-gray-600">Dependencies</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-2">
              {buildMetrics.testsPassed}/{buildMetrics.testsTotal}
            </div>
            <p className="text-sm text-gray-600">Tests Passed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 mb-2">
              {deployments.filter(d => d.status === 'deployed').length}
            </div>
            <p className="text-sm text-gray-600">Live Deployments</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deployments" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="deployments">Deployment History</TabsTrigger>
          <TabsTrigger value="environments">Environment Variables</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Deployments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployments.map((deployment) => (
                  <div key={deployment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(deployment.status)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold">{deployment.environment}</h4>
                          <Badge variant="outline" className="text-xs">
                            <GitBranch className="h-3 w-3 mr-1" />
                            {deployment.branch}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{deployment.commit}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{formatTimestamp(deployment.timestamp)}</span>
                          {deployment.duration > 0 && <span>{deployment.duration}min build</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge variant={getStatusColor(deployment.status)}>
                        {deployment.status}
                      </Badge>
                      
                      {deployment.url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </a>
                        </Button>
                      )}
                      
                      <Dialog open={isLogsDialogOpen && selectedDeployment === deployment.id} 
                              onOpenChange={(open) => {
                                setIsLogsDialogOpen(open)
                                if (!open) setSelectedDeployment(null)
                              }}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedDeployment(deployment.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Logs
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Deployment Logs - {deployment.environment}</DialogTitle>
                          </DialogHeader>
                          <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-80 overflow-y-auto">
                            {deployment.buildLogs?.map((log, index) => (
                              <div key={index} className="mb-1">
                                <span className="text-gray-500">[{new Date().toLocaleTimeString()}] </span>
                                {log}
                              </div>
                            )) || 'No logs available'}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button variant="outline" size="sm">
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Rollback
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Environment Variables</CardTitle>
                <Dialog open={isEnvDialogOpen} onOpenChange={setIsEnvDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Env Vars
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Manage Environment Variables</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Input placeholder="Variable name" />
                        <Input placeholder="Variable value" />
                      </div>
                      <select className="w-full px-3 py-2 border rounded-md">
                        <option>Production</option>
                        <option>Staging</option>
                        <option>Development</option>
                      </select>
                      <Button className="w-full">Add Variable</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {envVars.map((envVar, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <code className="font-semibold">{envVar.key}</code>
                      <p className="text-sm text-gray-600">{envVar.environment}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {envVar.value.includes('•') ? envVar.value : `${envVar.value.substring(0, 10)}...`}
                      </code>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Monitor className="h-5 w-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm font-medium">Response Time</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                      <span className="text-sm font-semibold">142ms</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm font-medium">Uptime</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '99%' }}></div>
                      </div>
                      <span className="text-sm font-semibold">99.9%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm font-medium">Error Rate</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '5%' }}></div>
                      </div>
                      <span className="text-sm font-semibold">0.1%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Deployment successful</p>
                      <p className="text-xs text-gray-500">2 minutes ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">High memory usage detected</p>
                      <p className="text-xs text-gray-500">15 minutes ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">SSL certificate renewed</p>
                      <p className="text-xs text-gray-500">1 hour ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Build Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Build Command</label>
                    <Input defaultValue="npm run build" className="mt-1" />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Output Directory</label>
                    <Input defaultValue=".next" className="mt-1" />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Node Version</label>
                    <select className="w-full px-3 py-2 border rounded-md mt-1">
                      <option>20.x</option>
                      <option>18.x</option>
                      <option>16.x</option>
                    </select>
                  </div>
                  
                  <Button className="w-full">Save Build Settings</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deployment Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Auto Deploy</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Preview Deployments</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Branch Protection</span>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Production Branch</label>
                    <Input defaultValue="main" className="mt-1" />
                  </div>
                  
                  <Button className="w-full">Save Deployment Settings</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}