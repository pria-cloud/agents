"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Play, Square } from "lucide-react"

interface WorkflowNode {
  id: string
  type: 'start' | 'action' | 'decision' | 'end'
  title: string
  description: string
  x: number
  y: number
}

interface WorkflowConnection {
  from: string
  to: string
  label?: string
}

export function WorkflowDesigner() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: '1', type: 'start', title: 'User Registration', description: 'New user signs up', x: 100, y: 50 },
    { id: '2', type: 'action', title: 'Email Verification', description: 'Send verification email', x: 300, y: 50 },
    { id: '3', type: 'decision', title: 'Email Verified?', description: 'Check if user verified email', x: 500, y: 50 },
    { id: '4', type: 'action', title: 'Account Activation', description: 'Activate user account', x: 700, y: 50 },
    { id: '5', type: 'end', title: 'Welcome User', description: 'Show welcome message', x: 900, y: 50 }
  ])

  const [connections] = useState<WorkflowConnection[]>([
    { from: '1', to: '2' },
    { from: '2', to: '3' },
    { from: '3', to: '4', label: 'Yes' },
    { from: '4', to: '5' }
  ])

  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newNode, setNewNode] = useState({
    type: 'action' as const,
    title: '',
    description: ''
  })

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'start': return 'bg-green-100 border-green-300'
      case 'action': return 'bg-blue-100 border-blue-300'
      case 'decision': return 'bg-yellow-100 border-yellow-300'
      case 'end': return 'bg-red-100 border-red-300'
      default: return 'bg-gray-100 border-gray-300'
    }
  }

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'start': return <Play className="h-4 w-4 text-green-600" />
      case 'end': return <Square className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  const handleAddNode = () => {
    if (newNode.title.trim()) {
      const node: WorkflowNode = {
        id: Date.now().toString(),
        ...newNode,
        x: Math.random() * 400 + 100,
        y: Math.random() * 200 + 100
      }
      setNodes([...nodes, node])
      setNewNode({ type: 'action', title: '', description: '' })
      setIsAddDialogOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Workflow Designer</h2>
        <div className="flex space-x-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Workflow Step</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <select
                  value={newNode.type}
                  onChange={(e) => setNewNode({...newNode, type: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="action">Action</option>
                  <option value="decision">Decision</option>
                  <option value="start">Start</option>
                  <option value="end">End</option>
                </select>
                <Input
                  placeholder="Step Title"
                  value={newNode.title}
                  onChange={(e) => setNewNode({...newNode, title: e.target.value})}
                />
                <Input
                  placeholder="Description"
                  value={newNode.description}
                  onChange={(e) => setNewNode({...newNode, description: e.target.value})}
                />
                <Button onClick={handleAddNode} className="w-full">
                  Add Step
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Simulate
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visual Workflow Canvas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative bg-gray-50 border rounded-lg p-4 min-h-[400px] overflow-auto">
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {connections.map((conn, index) => {
                const fromNode = nodes.find(n => n.id === conn.from)
                const toNode = nodes.find(n => n.id === conn.to)
                if (!fromNode || !toNode) return null
                
                return (
                  <g key={index}>
                    <line
                      x1={fromNode.x + 80}
                      y1={fromNode.y + 40}
                      x2={toNode.x}
                      y2={toNode.y + 40}
                      stroke="#666"
                      strokeWidth="2"
                      markerEnd="url(#arrowhead)"
                    />
                    {conn.label && (
                      <text
                        x={(fromNode.x + toNode.x) / 2 + 40}
                        y={(fromNode.y + toNode.y) / 2 + 35}
                        fill="#666"
                        fontSize="12"
                        textAnchor="middle"
                      >
                        {conn.label}
                      </text>
                    )}
                  </g>
                )
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="10"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#666"
                  />
                </marker>
              </defs>
            </svg>
            
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`absolute w-40 p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getNodeColor(node.type)} ${
                  selectedNode === node.id ? 'ring-2 ring-blue-400' : ''
                }`}
                style={{ left: node.x, top: node.y }}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1">
                    {getNodeIcon(node.type)}
                    <span className="text-xs font-medium uppercase text-gray-600">
                      {node.type}
                    </span>
                  </div>
                  {selectedNode === node.id && (
                    <div className="flex space-x-1">
                      <button className="p-1 hover:bg-white rounded">
                        <Edit className="h-3 w-3" />
                      </button>
                      <button className="p-1 hover:bg-white rounded">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <h4 className="font-semibold text-sm mb-1">{node.title}</h4>
                <p className="text-xs text-gray-600">{node.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Steps:</span>
                <span className="font-semibold">{nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Decision Points:</span>
                <span className="font-semibold">{nodes.filter(n => n.type === 'decision').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Connections:</span>
                <span className="font-semibold">{connections.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Export as PNG
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Export as JSON
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Generate Documentation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}