"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Play, Square, Loader2, Save } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface WorkflowNode {
  id: string
  workflow_id: string
  type: 'start' | 'action' | 'decision' | 'end'
  title: string
  description: string
  x: number
  y: number
  created_at?: string
  updated_at?: string
}

interface WorkflowConnection {
  id?: string
  workflow_id: string
  from_node: string
  to_node: string
  label?: string
  created_at?: string
}

interface Workflow {
  id: string
  session_id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  created_at: string
  updated_at: string
}

interface WorkflowDesignerProps {
  sessionId: string
  workspaceId: string
}

export function WorkflowDesigner({ sessionId, workspaceId }: WorkflowDesignerProps) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [connections, setConnections] = useState<WorkflowConnection[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newNode, setNewNode] = useState({
    type: 'action' as const,
    title: '',
    description: ''
  })
  const { toast } = useToast()

  // Fetch or create workflow for the session
  useEffect(() => {
    fetchWorkflow()
  }, [sessionId])

  const fetchWorkflow = async () => {
    try {
      // Check if workflow exists for this session
      const response = await fetch(`/api/workflows?session_id=${sessionId}`)
      if (!response.ok) throw new Error('Failed to fetch workflow')
      
      const workflows = await response.json()
      
      if (workflows.length > 0) {
        // Use existing workflow
        const existingWorkflow = workflows[0]
        setWorkflow(existingWorkflow)
        await fetchWorkflowData(existingWorkflow.id)
      } else {
        // Create new workflow
        await createWorkflow()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load workflow',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const createWorkflow = async () => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          workspace_id: workspaceId,
          name: 'Main Workflow',
          description: 'Application workflow',
          status: 'draft'
        })
      })
      
      if (!response.ok) throw new Error('Failed to create workflow')
      
      const newWorkflow = await response.json()
      setWorkflow(newWorkflow)
      
      // Create default nodes for new workflow
      await createDefaultNodes(newWorkflow.id)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create workflow',
        variant: 'destructive'
      })
    }
  }

  const createDefaultNodes = async (workflowId: string) => {
    const defaultNodes = [
      { type: 'start', title: 'User Registration', description: 'New user signs up', x: 100, y: 50 },
      { type: 'action', title: 'Email Verification', description: 'Send verification email', x: 300, y: 50 },
      { type: 'decision', title: 'Email Verified?', description: 'Check if user verified email', x: 500, y: 50 },
      { type: 'action', title: 'Account Activation', description: 'Activate user account', x: 700, y: 50 },
      { type: 'end', title: 'Welcome User', description: 'Show welcome message', x: 900, y: 50 }
    ]

    const createdNodes: WorkflowNode[] = []
    
    for (const node of defaultNodes) {
      const response = await fetch('/api/workflow-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflowId,
          workspace_id: workspaceId,
          ...node
        })
      })
      
      if (response.ok) {
        const created = await response.json()
        createdNodes.push(created)
      }
    }
    
    setNodes(createdNodes)
    
    // Create default connections
    if (createdNodes.length >= 5) {
      const defaultConnections = [
        { from_node: createdNodes[0].id, to_node: createdNodes[1].id },
        { from_node: createdNodes[1].id, to_node: createdNodes[2].id },
        { from_node: createdNodes[2].id, to_node: createdNodes[3].id, label: 'Yes' },
        { from_node: createdNodes[3].id, to_node: createdNodes[4].id }
      ]
      
      for (const conn of defaultConnections) {
        await fetch('/api/workflow-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow_id: workflowId,
            workspace_id: workspaceId,
            ...conn
          })
        })
      }
      
      setConnections(defaultConnections.map(c => ({ ...c, workflow_id: workflowId })))
    }
  }

  const fetchWorkflowData = async (workflowId: string) => {
    try {
      // Fetch nodes
      const nodesResponse = await fetch(`/api/workflow-nodes?workflow_id=${workflowId}`)
      if (nodesResponse.ok) {
        const nodesData = await nodesResponse.json()
        setNodes(nodesData)
      }
      
      // Fetch connections
      const connectionsResponse = await fetch(`/api/workflow-connections?workflow_id=${workflowId}`)
      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json()
        setConnections(connectionsData)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load workflow data',
        variant: 'destructive'
      })
    }
  }

  const handleAddNode = async () => {
    if (!newNode.title.trim() || !workflow) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/workflow-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          workspace_id: workspaceId,
          ...newNode,
          x: Math.random() * 400 + 100,
          y: Math.random() * 200 + 100
        })
      })
      
      if (!response.ok) throw new Error('Failed to create node')
      
      const createdNode = await response.json()
      setNodes([...nodes, createdNode])
      setNewNode({ type: 'action', title: '', description: '' })
      setIsAddDialogOpen(false)
      
      toast({
        title: 'Success',
        description: 'Node added to workflow'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add node',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/workflow-nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId })
      })
      
      if (!response.ok) throw new Error('Failed to delete node')
      
      setNodes(nodes.filter(n => n.id !== nodeId))
      setConnections(connections.filter(c => c.from_node !== nodeId && c.to_node !== nodeId))
      setSelectedNode(null)
      
      toast({
        title: 'Success',
        description: 'Node deleted'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete node',
        variant: 'destructive'
      })
    }
  }

  const handleUpdateNodePosition = async (nodeId: string, x: number, y: number) => {
    try {
      const response = await fetch(`/api/workflow-nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          x,
          y
        })
      })
      
      if (!response.ok) throw new Error('Failed to update node position')
      
      setNodes(nodes.map(n => n.id === nodeId ? { ...n, x, y } : n))
    } catch (error) {
      console.error('Failed to update node position:', error)
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
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
                <Button 
                  onClick={handleAddNode} 
                  className="w-full"
                  disabled={saving || !newNode.title.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Step'
                  )}
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
                const fromNode = nodes.find(n => n.id === conn.from_node)
                const toNode = nodes.find(n => n.id === conn.to_node)
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
                draggable
                onDragEnd={(e) => {
                  const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                  if (rect) {
                    const x = e.clientX - rect.left - 80
                    const y = e.clientY - rect.top - 40
                    handleUpdateNodePosition(node.id, x, y)
                  }
                }}
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
                      <button 
                        className="p-1 hover:bg-white rounded"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNode(node.id)
                        }}
                      >
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
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-semibold capitalize">{workflow?.status || 'draft'}</span>
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