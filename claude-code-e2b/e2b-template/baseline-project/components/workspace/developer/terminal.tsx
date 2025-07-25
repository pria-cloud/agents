"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Terminal as TerminalIcon, 
  Play, 
  Square, 
  Trash2, 
  Copy, 
  Download,
  History,
  Settings,
  Maximize2,
  RefreshCw
} from "lucide-react"

interface CommandHistory {
  id: string
  command: string
  output: string
  timestamp: string
  exitCode: number
  duration: number
}

interface Deployment {
  id: string
  environment: string
  status: 'building' | 'deployed' | 'failed'
  timestamp: string
  commit: string
  url?: string
}

export function Terminal() {
  const [currentCommand, setCurrentCommand] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('terminal')
  const terminalRef = useRef<HTMLDivElement>(null)

  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([
    {
      id: '1',
      command: 'npm install',
      output: 'added 1245 packages from 892 contributors and audited 1245 packages in 23.456s\nfound 0 vulnerabilities',
      timestamp: '2024-01-15T14:30:00Z',
      exitCode: 0,
      duration: 23.456
    },
    {
      id: '2',
      command: 'npm run build',
      output: '> next build\n\nCreating an optimized production build...\n✓ Compiled successfully\n✓ Linting and checking validity of types\n✓ Collecting page data\n✓ Generating static pages (5/5)\n✓ Finalizing page optimization\n\nRoute (app)                              Size     First Load JS\n┌ ○ /                                    142 B          87.4 kB\n├ ○ /about                               142 B          87.4 kB\n└ ○ /contact                             142 B          87.4 kB\n+ First Load JS shared by all            87.3 kB\n  ├ chunks/webpack-8fa1640cc84ba8ef.js   31.0 kB\n  ├ chunks/main-app-2f0c8cd8b8b6d8c9.js  54.5 kB\n  └ other shared chunks (total)          1.79 kB\n\n○  (Static)  automatically rendered as static HTML (uses no initial props)',
      timestamp: '2024-01-15T14:25:00Z',
      exitCode: 0,
      duration: 45.23
    },
    {
      id: '3',
      command: 'npm test',
      output: 'FAIL src/components/Button.test.tsx\n  ● Button component › should render correctly\n\n    expect(received).toBeInTheDocument()\n\n    Received element is not present in the document\n\n      12 |     render(<Button>Click me</Button>)\n      13 |     const button = screen.getByRole(\'button\')\n    > 14 |     expect(button).toBeInTheDocument()\n         |                    ^\n      15 |   })\n      16 | })\n\nTest Suites: 1 failed, 2 passed, 3 total\nTests:       1 failed, 8 passed, 9 total\nSnapshots:   0 total\nTime:        2.756 s',
      timestamp: '2024-01-15T14:20:00Z',
      exitCode: 1,
      duration: 2.756
    }
  ])

  const [deployments] = useState<Deployment[]>([
    {
      id: '1',
      environment: 'Production',
      status: 'deployed',
      timestamp: '2024-01-15T14:15:00Z',
      commit: 'feat: add user authentication',
      url: 'https://myapp.vercel.app'
    },
    {
      id: '2',
      environment: 'Staging',
      status: 'building',
      timestamp: '2024-01-15T14:10:00Z',
      commit: 'fix: resolve cart calculation bug'
    },
    {
      id: '3',
      environment: 'Development',
      status: 'failed',
      timestamp: '2024-01-15T14:05:00Z',
      commit: 'refactor: update component structure'
    }
  ])

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCommand.trim() || isRunning) return

    setIsRunning(true)
    
    // Simulate command execution
    setTimeout(() => {
      const newCommand: CommandHistory = {
        id: Date.now().toString(),
        command: currentCommand,
        output: getSimulatedOutput(currentCommand),
        timestamp: new Date().toISOString(),
        exitCode: Math.random() > 0.8 ? 1 : 0,
        duration: Math.random() * 10 + 1
      }
      
      setCommandHistory(prev => [newCommand, ...prev])
      setCurrentCommand('')
      setIsRunning(false)
    }, 1000 + Math.random() * 2000)
  }

  const getSimulatedOutput = (command: string): string => {
    if (command.includes('npm install')) {
      return 'added 42 packages from 28 contributors and audited 1287 packages in 5.234s\nfound 0 vulnerabilities'
    }
    if (command.includes('npm run build')) {
      return '> next build\n\n✓ Compiled successfully\n✓ Static pages generated\nBuild completed in 12.45s'
    }
    if (command.includes('npm test')) {
      return 'Test Suites: 3 passed, 3 total\nTests: 12 passed, 12 total\nSnapshots: 0 total\nTime: 3.456 s'
    }
    if (command.includes('git')) {
      return 'Git operation completed successfully'
    }
    return `Command executed: ${command}\nOutput would appear here...`
  }

  const handleClearTerminal = () => {
    setCommandHistory([])
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'default'
      case 'building': return 'secondary'
      case 'failed': return 'destructive'
      default: return 'outline'
    }
  }

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = 0
    }
  }, [commandHistory])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Terminal</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleClearTerminal}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="terminal" className="mt-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <TerminalIcon className="h-5 w-5" />
                  <span>Interactive Terminal</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Terminal Output */}
              <div 
                ref={terminalRef}
                className="flex-1 bg-gray-900 text-green-400 font-mono text-sm p-4 overflow-y-auto"
              >
                {commandHistory.map((cmd, index) => (
                  <div key={cmd.id} className="mb-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-blue-400">$</span>
                      <span className="text-white">{cmd.command}</span>
                      <Badge variant={cmd.exitCode === 0 ? 'default' : 'destructive'} className="text-xs">
                        {cmd.exitCode === 0 ? 'success' : 'error'}
                      </Badge>
                      <span className="text-gray-500 text-xs">
                        {formatTimestamp(cmd.timestamp)} ({cmd.duration.toFixed(2)}s)
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap text-gray-300 ml-4">
                      {cmd.output}
                    </pre>
                  </div>
                ))}
                
                {isRunning && (
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400">$</span>
                    <span className="text-white">{currentCommand}</span>
                    <div className="inline-block w-2 h-4 bg-green-400 animate-pulse"></div>
                  </div>
                )}
              </div>
              
              {/* Command Input */}
              <div className="bg-gray-800 p-4 border-t">
                <form onSubmit={handleCommandSubmit} className="flex items-center space-x-2">
                  <span className="text-blue-400 font-mono">$</span>
                  <Input
                    value={currentCommand}
                    onChange={(e) => setCurrentCommand(e.target.value)}
                    placeholder="Enter command..."
                    disabled={isRunning}
                    className="flex-1 bg-transparent border-none text-white font-mono focus:outline-none focus:ring-0"
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={isRunning || !currentCommand.trim()}
                  >
                    {isRunning ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Deployments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deployments.map((deployment) => (
                    <div key={deployment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-semibold">{deployment.environment}</h4>
                          <p className="text-sm text-gray-600">{deployment.commit}</p>
                          <p className="text-xs text-gray-500">{formatTimestamp(deployment.timestamp)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Badge variant={getStatusColor(deployment.status)}>
                          {deployment.status}
                        </Badge>
                        
                        {deployment.url && (
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        )}
                        
                        <Button variant="ghost" size="sm">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {deployments.filter(d => d.status === 'deployed').length}
                  </div>
                  <p className="text-sm text-gray-600">Successful Deployments</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {deployments.filter(d => d.status === 'building').length}
                  </div>
                  <p className="text-sm text-gray-600">Currently Building</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-600 mb-2">
                    {deployments.filter(d => d.status === 'failed').length}
                  </div>
                  <p className="text-sm text-gray-600">Failed Deployments</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="h-5 w-5" />
                <span>System Logs</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto">
                <div className="space-y-1">
                  <div className="text-gray-500">[2024-01-15 14:30:15] INFO: Application started successfully</div>
                  <div className="text-blue-400">[2024-01-15 14:30:12] DEBUG: Database connection established</div>
                  <div className="text-green-400">[2024-01-15 14:30:10] INFO: Server listening on port 3000</div>
                  <div className="text-yellow-400">[2024-01-15 14:30:08] WARN: Deprecated API usage detected</div>
                  <div className="text-gray-500">[2024-01-15 14:30:05] INFO: Loading environment configuration</div>
                  <div className="text-red-400">[2024-01-15 14:30:03] ERROR: Failed to connect to Redis cache</div>
                  <div className="text-gray-500">[2024-01-15 14:30:01] INFO: Application initialization started</div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                  <select className="text-sm border rounded px-2 py-1">
                    <option>All Levels</option>
                    <option>INFO</option>
                    <option>WARN</option>
                    <option>ERROR</option>
                    <option>DEBUG</option>
                  </select>
                </div>
                
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}