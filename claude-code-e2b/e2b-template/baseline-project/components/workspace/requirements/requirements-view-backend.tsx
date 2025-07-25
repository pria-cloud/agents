"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Search, CheckCircle, Clock, RefreshCw, Zap } from "lucide-react"
import { RequirementsService } from "@/lib/services/requirements"
import type { Requirement } from "@/lib/supabase/types"
import { useWorkspace } from "../../claude-workspace-refactored"

export function RequirementsViewBackend() {
  const { currentSession } = useWorkspace()
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)

  const [newRequirement, setNewRequirement] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: '',
    acceptanceCriteria: [] as string[]
  })

  // Load requirements on component mount and session change
  useEffect(() => {
    if (currentSession?.id) {
      loadRequirements()
    }
  }, [currentSession?.id])

  const loadRequirements = async () => {
    if (!currentSession?.id) return

    try {
      setLoading(true)
      setError(null)
      const data = await RequirementsService.getRequirements(currentSession.id)
      setRequirements(data)
    } catch (error) {
      console.error('Failed to load requirements:', error)
      setError(error instanceof Error ? error.message : 'Failed to load requirements')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRequirement = async () => {
    if (!newRequirement.title.trim() || !currentSession?.id) return

    try {
      setError(null)
      const requirement = await RequirementsService.createRequirement({
        sessionId: currentSession.id,
        workspaceId: currentSession.workspace_id,
        title: newRequirement.title.trim(),
        description: newRequirement.description.trim(),
        priority: newRequirement.priority,
        category: newRequirement.category.trim() || undefined,
        acceptanceCriteria: newRequirement.acceptanceCriteria.filter(c => c.trim())
      })

      setRequirements(prev => [requirement, ...prev])
      setNewRequirement({ title: '', description: '', priority: 'medium', category: '', acceptanceCriteria: [] })
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Failed to create requirement:', error)
      setError(error instanceof Error ? error.message : 'Failed to create requirement')
    }
  }

  const handleUpdateRequirement = async (id: string, updates: Partial<Requirement>) => {
    try {
      setError(null)
      const updatedRequirement = await RequirementsService.updateRequirement(id, updates)
      setRequirements(prev => prev.map(req => req.id === id ? updatedRequirement : req))
    } catch (error) {
      console.error('Failed to update requirement:', error)
      setError(error instanceof Error ? error.message : 'Failed to update requirement')
    }
  }

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return

    try {
      setError(null)
      await RequirementsService.deleteRequirement(id)
      setRequirements(prev => prev.filter(req => req.id !== id))
    } catch (error) {
      console.error('Failed to delete requirement:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete requirement')
    }
  }

  const handleAnalyzeRequirements = async () => {
    if (!currentSession?.id || requirements.length === 0) return

    try {
      setIsAnalyzing(true)
      setError(null)
      
      const response = await RequirementsService.analyzeRequirements({
        operation: 'analyze_requirements',
        sessionId: currentSession.id,
        workspaceId: currentSession.workspace_id,
        requirement_ids: requirements.map(r => r.id)
      })

      console.log('Analysis completed:', response)
      // Optionally refresh requirements or show success message
    } catch (error) {
      console.error('Failed to analyze requirements:', error)
      setError(error instanceof Error ? error.message : 'Failed to analyze requirements')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateCode = async () => {
    if (!currentSession?.id || requirements.length === 0) return

    const completedRequirements = requirements.filter(r => r.status === 'completed')
    if (completedRequirements.length === 0) {
      setError('No completed requirements available for code generation')
      return
    }

    try {
      setIsGeneratingCode(true)
      setError(null)
      
      const response = await RequirementsService.generateCode({
        operation: 'generate_code',
        sessionId: currentSession.id,
        workspaceId: currentSession.workspace_id,
        requirement_ids: completedRequirements.map(r => r.id),
        generate_tests: true
      })

      console.log('Code generation completed:', response)
      // Optionally show success message or redirect to code editor
    } catch (error) {
      console.error('Failed to generate code:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate code')
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const filteredRequirements = requirements.filter(requirement => {
    const matchesSearch = requirement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         requirement.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || requirement.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in-progress': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading requirements...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">Requirements & User Stories</h2>
        <div className="flex gap-2">
          <Button
            onClick={handleAnalyzeRequirements}
            disabled={isAnalyzing || requirements.length === 0}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Analyze with Claude'}
          </Button>
          <Button
            onClick={handleGenerateCode}
            disabled={isGeneratingCode || requirements.filter(r => r.status === 'completed').length === 0}
            variant="outline"
          >
            <Zap className={`h-4 w-4 mr-2 ${isGeneratingCode ? 'animate-spin' : ''}`} />
            {isGeneratingCode ? 'Generating...' : 'Generate Code'}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Requirement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Requirement Title"
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({...newRequirement, title: e.target.value})}
                />
                <Textarea
                  placeholder="Detailed Description"
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({...newRequirement, description: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={newRequirement.priority}
                    onChange={(e) => setNewRequirement({...newRequirement, priority: e.target.value as any})}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <Input
                    placeholder="Category"
                    value={newRequirement.category}
                    onChange={(e) => setNewRequirement({...newRequirement, category: e.target.value})}
                  />
                </div>
                <Button onClick={handleAddRequirement} className="w-full">
                  Add Requirement
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center text-red-700">
              <span className="text-sm">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-auto"
              >
                ×
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search requirements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <Button variant="outline" onClick={loadRequirements}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredRequirements.map((requirement) => (
          <Card key={requirement.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(requirement.status)}
                  <CardTitle className="text-lg">{requirement.title}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getPriorityColor(requirement.priority)}>
                    {requirement.priority}
                  </Badge>
                  {requirement.category && (
                    <Badge variant="outline">{requirement.category}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">{requirement.description}</p>
              <div className="flex items-center justify-between">
                <Badge variant={
                  requirement.status === 'completed' ? 'default' :
                  requirement.status === 'in-progress' ? 'secondary' : 'outline'
                }>
                  {requirement.status.replace('-', ' ')}
                </Badge>
                <div className="flex space-x-2">
                  <select
                    value={requirement.status}
                    onChange={(e) => handleUpdateRequirement(requirement.id, { 
                      status: e.target.value as any 
                    })}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteRequirement(requirement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {requirement.acceptance_criteria && requirement.acceptance_criteria.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <h5 className="text-sm font-semibold mb-2">Acceptance Criteria:</h5>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {requirement.acceptance_criteria.map((criteria, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{criteria}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequirements.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {searchTerm || filterStatus !== 'all' 
                ? 'No requirements found matching your criteria.'
                : 'No requirements yet. Get started by adding your first requirement.'
              }
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Requirement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">{requirements.length}</div>
            <p className="text-sm text-gray-600">Total Requirements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {requirements.filter(r => r.status === 'completed').length}
            </div>
            <p className="text-sm text-gray-600">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {requirements.filter(r => r.status === 'in-progress').length}
            </div>
            <p className="text-sm text-gray-600">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {requirements.filter(r => r.priority === 'high').length}
            </div>
            <p className="text-sm text-gray-600">High Priority</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}