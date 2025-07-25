"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Play, 
  Pause, 
  RefreshCw, 
  Camera, 
  Bug, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ExternalLink,
  Filter
} from "lucide-react"

interface TestCase {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration: number
  error?: string
}

export function PreviewTesting() {
  const [selectedDevice, setSelectedDevice] = useState('desktop')
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [testProgress, setTestProgress] = useState(0)

  const devices = [
    { id: 'desktop', name: 'Desktop', icon: Monitor, viewport: '1440x900' },
    { id: 'tablet', name: 'Tablet', icon: Tablet, viewport: '768x1024' },
    { id: 'mobile', name: 'Mobile', icon: Smartphone, viewport: '375x667' }
  ]

  const [testCases, setTestCases] = useState<TestCase[]>([
    { id: '1', name: 'User Authentication Flow', status: 'passed', duration: 2.1 },
    { id: '2', name: 'Product Catalog Rendering', status: 'passed', duration: 1.8 },
    { id: '3', name: 'Shopping Cart Operations', status: 'failed', duration: 3.2, error: 'AssertionError: Expected cart count to be 2, got 1' },
    { id: '4', name: 'Checkout Process', status: 'pending', duration: 0 },
    { id: '5', name: 'Responsive Design Tests', status: 'running', duration: 0 }
  ])

  const handleRunTests = async () => {
    setIsRunningTests(true)
    setTestProgress(0)
    
    // Simulate test execution
    const interval = setInterval(() => {
      setTestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsRunningTests(false)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  const testStats = {
    total: testCases.length,
    passed: testCases.filter(t => t.status === 'passed').length,
    failed: testCases.filter(t => t.status === 'failed').length,
    running: testCases.filter(t => t.status === 'running').length,
    pending: testCases.filter(t => t.status === 'pending').length
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'pending': return <Clock className="h-4 w-4 text-gray-400" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'default'
      case 'failed': return 'destructive'
      case 'running': return 'secondary'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Preview & Testing</h2>
        <div className="flex space-x-2">
          <Button onClick={handleRunTests} disabled={isRunningTests}>
            <Play className="h-4 w-4 mr-2" />
            {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
          </Button>
          <Button variant="outline">
            <Camera className="h-4 w-4 mr-2" />
            Screenshot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Preview</CardTitle>
                <div className="flex items-center space-x-2">
                  {devices.map((device) => {
                    const Icon = device.icon
                    return (
                      <Button
                        key={device.id}
                        variant={selectedDevice === device.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedDevice(device.id)}
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {device.name}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {devices.find(d => d.id === selectedDevice)?.viewport}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {devices.find(d => d.id === selectedDevice)?.name} View
                    </span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className={`bg-white border rounded-lg overflow-hidden ${
                  selectedDevice === 'mobile' ? 'max-w-sm mx-auto' : 
                  selectedDevice === 'tablet' ? 'max-w-2xl mx-auto' : 
                  'w-full'
                }`}>
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <div className="text-center">
                      <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-600">Live Preview</h3>
                      <p className="text-sm text-gray-500">Your application preview will appear here</p>
                      <div className="mt-4 flex items-center justify-center space-x-2">
                        <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              {isRunningTests && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Running tests...</span>
                    <span className="text-sm">{testProgress}%</span>
                  </div>
                  <Progress value={testProgress} className="h-2" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-center p-2 bg-green-50 rounded">
                  <p className="text-2xl font-bold text-green-600">{testStats.passed}</p>
                  <p className="text-xs text-green-600">Passed</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <p className="text-2xl font-bold text-red-600">{testStats.failed}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Test Cases</span>
                  <select className="text-xs border rounded px-2 py-1">
                    <option>All Tests</option>
                    <option>Passed</option>
                    <option>Failed</option>
                    <option>Running</option>
                  </select>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {testCases.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(test.status)}
                        <span className="text-sm font-medium">{test.name}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Badge variant={getStatusColor(test.status)} className="text-xs">
                          {test.status}
                        </Badge>
                        {test.duration > 0 && (
                          <span className="text-xs text-gray-500">{test.duration}s</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="test-cases" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="test-cases">Test Cases</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
        </TabsList>

        <TabsContent value="test-cases" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Test Cases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testCases.map((test) => (
                  <div key={test.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(test.status)}
                        <h4 className="font-semibold">{test.name}</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStatusColor(test.status)}>
                          {test.status}
                        </Badge>
                        {test.duration > 0 && (
                          <span className="text-sm text-gray-500">{test.duration}s</span>
                        )}
                      </div>
                    </div>
                    
                    {test.error && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                        <h5 className="font-semibold text-red-700 mb-1">Error Details</h5>
                        <code className="text-sm text-red-600">{test.error}</code>
                      </div>
                    )}
                    
                    <div className="mt-3 flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </Button>
                      <Button variant="outline" size="sm">
                        <Bug className="h-3 w-3 mr-1" />
                        Debug
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Code Coverage Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-2">87%</div>
                    <p className="text-sm text-gray-600">Lines Covered</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-2">92%</div>
                    <p className="text-sm text-gray-600">Functions Covered</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">78%</div>
                    <p className="text-sm text-gray-600">Branches Covered</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {[
                    { file: 'components/auth/login.tsx', coverage: 95 },
                    { file: 'components/product/card.tsx', coverage: 88 },
                    { file: 'components/cart/manager.tsx', coverage: 72 },
                    { file: 'lib/utils/validation.ts', coverage: 100 }
                  ].map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm font-medium">{file.file}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${file.coverage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold">{file.coverage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Core Web Vitals</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">First Contentful Paint</span>
                      <Badge variant="default">1.2s</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">Largest Contentful Paint</span>
                      <Badge variant="default">2.1s</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">Cumulative Layout Shift</span>
                      <Badge variant="default">0.05</Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Resource Loading</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">JavaScript Bundle</span>
                      <Badge variant="outline">245 KB</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">CSS Bundle</span>
                      <Badge variant="outline">32 KB</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm">Images</span>
                      <Badge variant="outline">1.2 MB</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-6 border rounded-lg">
                  <div className="text-4xl font-bold text-green-600 mb-2">94</div>
                  <p className="text-sm text-gray-600">Accessibility Score</p>
                </div>
                
                <div className="space-y-3">
                  {[
                    { check: 'Color Contrast', status: 'passed', issues: 0 },
                    { check: 'Keyboard Navigation', status: 'passed', issues: 0 },
                    { check: 'Alt Text for Images', status: 'warning', issues: 3 },
                    { check: 'ARIA Labels', status: 'passed', issues: 0 },
                    { check: 'Focus Management', status: 'failed', issues: 2 }
                  ].map((audit, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <span className="text-sm font-medium">{audit.check}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          audit.status === 'passed' ? 'default' :
                          audit.status === 'warning' ? 'secondary' : 'destructive'
                        }>
                          {audit.status}
                        </Badge>
                        {audit.issues > 0 && (
                          <span className="text-xs text-red-600">{audit.issues} issues</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}