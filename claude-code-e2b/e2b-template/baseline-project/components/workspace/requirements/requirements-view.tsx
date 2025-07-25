"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Edit, Trash2, Search, CheckCircle, Clock } from "lucide-react"

interface Requirement {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed'
  category: string
}

export function RequirementsView() {
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      id: '1',
      title: 'User Authentication',
      description: 'Users should be able to register, login, and manage their accounts securely.',
      priority: 'high',
      status: 'completed',
      category: 'Authentication'
    },
    {
      id: '2',
      title: 'Product Catalog',
      description: 'Display products with images, descriptions, pricing, and inventory status.',
      priority: 'high',
      status: 'in-progress',
      category: 'Core Features'
    },
    {
      id: '3',
      title: 'Shopping Cart',
      description: 'Users can add, remove, and modify items in their shopping cart.',
      priority: 'medium',
      status: 'pending',
      category: 'E-commerce'
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newRequirement, setNewRequirement] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    category: ''
  })

  const filteredRequirements = requirements.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleAddRequirement = () => {
    if (newRequirement.title.trim()) {
      const requirement: Requirement = {
        id: Date.now().toString(),
        ...newRequirement,
        status: 'pending'
      }
      setRequirements([...requirements, requirement])
      setNewRequirement({ title: '', description: '', priority: 'medium', category: '' })
      setIsAddDialogOpen(false)
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold">Requirements & User Stories</h2>
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
                  <Badge variant="outline">{requirement.category}</Badge>
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
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequirements.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">No requirements found matching your criteria.</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Requirement
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}