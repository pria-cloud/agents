"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Clock, 
  GitCommit, 
  FileText, 
  Code, 
  Database, 
  Search, 
  Filter, 
  Download,
  Eye,
  RotateCcw,
  CheckCircle,
  AlertCircle
} from "lucide-react"

interface HistoryEvent {
  id: string
  timestamp: string
  type: 'requirement' | 'code' | 'database' | 'deployment' | 'test'
  title: string
  description: string
  user: string
  changes: {
    added: number
    modified: number
    deleted: number
  }
  status: 'success' | 'failed' | 'pending'
}

export function SessionHistory() {
  const [events] = useState<HistoryEvent[]>([
    {
      id: '1',
      timestamp: '2024-01-15T14:30:00Z',
      type: 'requirement',
      title: 'Added User Authentication Requirement',
      description: 'Created comprehensive user authentication and authorization requirements',
      user: 'Claude',
      changes: { added: 3, modified: 0, deleted: 0 },
      status: 'success'
    },
    {
      id: '2',
      timestamp: '2024-01-15T14:25:00Z',
      type: 'code',
      title: 'Generated React Components',
      description: 'Auto-generated TypeScript React components for user interface',
      user: 'Claude',
      changes: { added: 12, modified: 2, deleted: 1 },
      status: 'success'
    },
    {
      id: '3',
      timestamp: '2024-01-15T14:20:00Z',
      type: 'database',
      title: 'Database Schema Update',
      description: 'Updated user table schema with additional fields for profile information',
      user: 'Claude',
      changes: { added: 5, modified: 3, deleted: 0 },
      status: 'success'
    },
    {
      id: '4',
      timestamp: '2024-01-15T14:15:00Z',
      type: 'deployment',
      title: 'Failed Deployment Attempt',
      description: 'Deployment failed due to missing environment variables',
      user: 'System',
      changes: { added: 0, modified: 0, deleted: 0 },
      status: 'failed'
    },
    {
      id: '5',
      timestamp: '2024-01-15T14:10:00Z',
      type: 'test',
      title: 'E2E Tests Added',
      description: 'Created comprehensive end-to-end tests for user authentication flow',
      user: 'Claude',
      changes: { added: 8, modified: 0, deleted: 0 },
      status: 'success'
    }
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || event.type === filterType
    return matchesSearch && matchesType
  })

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'requirement': return <FileText className="h-4 w-4" />
      case 'code': return <Code className="h-4 w-4" />
      case 'database': return <Database className="h-4 w-4" />
      case 'deployment': return <GitCommit className="h-4 w-4" />
      case 'test': return <CheckCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'requirement': return 'bg-blue-100 border-blue-300 text-blue-700'
      case 'code': return 'bg-green-100 border-green-300 text-green-700'
      case 'database': return 'bg-purple-100 border-purple-300 text-purple-700'
      case 'deployment': return 'bg-orange-100 border-orange-300 text-orange-700'
      case 'test': return 'bg-teal-100 border-teal-300 text-teal-700'
      default: return 'bg-gray-100 border-gray-300 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minutes ago`
    if (hours < 24) return `${hours} hours ago`
    return `${days} days ago`
  }

  const sessionStats = {
    totalEvents: events.length,
    successfulEvents: events.filter(e => e.status === 'success').length,
    failedEvents: events.filter(e => e.status === 'failed').length,
    totalChanges: events.reduce((sum, event) => sum + event.changes.added + event.changes.modified + event.changes.deleted, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Session History</h2>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Timeline
          </Button>
          <Button variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore Point
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-bold">{sessionStats.totalEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold">{sessionStats.successfulEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold">{sessionStats.failedEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GitCommit className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Total Changes</p>
                <p className="text-2xl font-bold">{sessionStats.totalChanges}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="changes">Change Log</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="requirement">Requirements</option>
              <option value="code">Code Changes</option>
              <option value="database">Database</option>
              <option value="deployment">Deployments</option>
              <option value="test">Tests</option>
            </select>
          </div>

          {/* Timeline */}
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                <div className="space-y-8">
                  {filteredEvents.map((event, index) => (
                    <div key={event.id} className="relative flex items-start space-x-4">
                      {/* Timeline dot */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${getEventColor(event.type)}`}>
                        {getEventIcon(event.type)}
                      </div>
                      
                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold">{event.title}</h3>
                            {getStatusIcon(event.status)}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{event.type}</Badge>
                            <span className="text-sm text-gray-500">{formatTimestamp(event.timestamp)}</span>
                          </div>
                        </div>
                        
                        <p className="text-gray-600 mt-1">{event.description}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-gray-500">by {event.user}</span>
                            {event.changes.added > 0 && (
                              <span className="text-green-600">+{event.changes.added} added</span>
                            )}
                            {event.changes.modified > 0 && (
                              <span className="text-blue-600">{event.changes.modified} modified</span>
                            )}
                            {event.changes.deleted > 0 && (
                              <span className="text-red-600">-{event.changes.deleted} deleted</span>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Change Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{event.title}</h4>
                      <Badge variant="outline">{formatTimestamp(event.timestamp)}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="font-semibold text-green-700">+{event.changes.added}</p>
                        <p className="text-green-600">Added</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <p className="font-semibold text-blue-700">{event.changes.modified}</p>
                        <p className="text-blue-600">Modified</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <p className="font-semibold text-red-700">-{event.changes.deleted}</p>
                        <p className="text-red-600">Deleted</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['requirement', 'code', 'database', 'deployment', 'test'].map((type) => {
                    const count = events.filter(e => e.type === type).length
                    const percentage = (count / events.length) * 100
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getEventIcon(type)}
                          <span className="capitalize">{type}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">{count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {Math.round((sessionStats.successfulEvents / sessionStats.totalEvents) * 100)}%
                  </div>
                  <p className="text-gray-600">Success Rate</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-green-600">{sessionStats.successfulEvents}</p>
                      <p className="text-gray-500">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-red-600">{sessionStats.failedEvents}</p>
                      <p className="text-gray-500">Failed</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}