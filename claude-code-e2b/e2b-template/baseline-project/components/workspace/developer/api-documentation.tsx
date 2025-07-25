"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Globe, 
  Play, 
  Copy, 
  Download, 
  Search, 
  Filter,
  ChevronRight,
  ChevronDown,
  Code,
  Key,
  AlertCircle,
  CheckCircle
} from "lucide-react"

interface APIEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  summary: string
  description: string
  category: string
  parameters: Parameter[]
  responses: Response[]
  authentication: boolean
}

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  example: string
}

interface Response {
  code: number
  description: string
  example: string
}

export function APIDocumentation() {
  const [endpoints] = useState<APIEndpoint[]>([
    {
      id: '1',
      method: 'GET',
      path: '/api/users',
      summary: 'Get all users',
      description: 'Retrieve a list of all users in the system with pagination support',
      category: 'User Management',
      authentication: true,
      parameters: [
        { name: 'page', type: 'integer', required: false, description: 'Page number for pagination', example: '1' },
        { name: 'limit', type: 'integer', required: false, description: 'Number of items per page', example: '10' },
        { name: 'search', type: 'string', required: false, description: 'Search term for filtering users', example: 'john' }
      ],
      responses: [
        { code: 200, description: 'Success', example: '{"users": [{"id": "123", "email": "user@example.com"}], "total": 1, "page": 1}' },
        { code: 401, description: 'Unauthorized', example: '{"error": "Authentication required"}' },
        { code: 500, description: 'Internal Server Error', example: '{"error": "Database connection failed"}' }
      ]
    },
    {
      id: '2',
      method: 'POST',
      path: '/api/users',
      summary: 'Create new user',
      description: 'Create a new user account with email and password',
      category: 'User Management',
      authentication: false,
      parameters: [
        { name: 'email', type: 'string', required: true, description: 'User email address', example: 'user@example.com' },
        { name: 'password', type: 'string', required: true, description: 'User password (min 8 characters)', example: 'secretpassword' },
        { name: 'firstName', type: 'string', required: false, description: 'User first name', example: 'John' },
        { name: 'lastName', type: 'string', required: false, description: 'User last name', example: 'Doe' }
      ],
      responses: [
        { code: 201, description: 'Created', example: '{"id": "123", "email": "user@example.com", "message": "User created successfully"}' },
        { code: 400, description: 'Bad Request', example: '{"error": "Email already exists"}' },
        { code: 422, description: 'Validation Error', example: '{"error": "Password must be at least 8 characters"}' }
      ]
    },
    {
      id: '3',
      method: 'GET',
      path: '/api/products',
      summary: 'Get products',
      description: 'Retrieve product catalog with filtering and search capabilities',
      category: 'Product Catalog',
      authentication: false,
      parameters: [
        { name: 'category', type: 'string', required: false, description: 'Filter by product category', example: 'electronics' },
        { name: 'minPrice', type: 'number', required: false, description: 'Minimum price filter', example: '10.00' },
        { name: 'maxPrice', type: 'number', required: false, description: 'Maximum price filter', example: '100.00' }
      ],
      responses: [
        { code: 200, description: 'Success', example: '{"products": [{"id": "456", "name": "Product Name", "price": 29.99}]}' },
        { code: 400, description: 'Bad Request', example: '{"error": "Invalid price range"}' },
        { code: 500, description: 'Internal Server Error', example: '{"error": "Service unavailable"}' }
      ]
    },
    {
      id: '4',
      method: 'POST',
      path: '/api/orders',
      summary: 'Create order',
      description: 'Create a new order with product items and calculate total',
      category: 'Order Processing',
      authentication: true,
      parameters: [
        { name: 'items', type: 'array', required: true, description: 'Array of order items', example: '[{"productId": "456", "quantity": 2}]' },
        { name: 'shippingAddress', type: 'object', required: true, description: 'Shipping address information', example: '{"street": "123 Main St", "city": "Anytown"}' }
      ],
      responses: [
        { code: 201, description: 'Created', example: '{"orderId": "789", "total": 59.98, "status": "pending"}' },
        { code: 400, description: 'Bad Request', example: '{"error": "Invalid product ID"}' },
        { code: 401, description: 'Unauthorized', example: '{"error": "Authentication required"}' }
      ]
    }
  ])

  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('1')
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['User Management'])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [isTestConsoleOpen, setIsTestConsoleOpen] = useState(false)
  const [testRequest, setTestRequest] = useState({
    method: 'GET',
    url: '',
    headers: '{"Content-Type": "application/json"}',
    body: ''
  })
  const [testResponse, setTestResponse] = useState<string>('')

  const categories = [...new Set(endpoints.map(e => e.category))]
  
  const filteredEndpoints = endpoints.filter(endpoint => {
    const matchesSearch = endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMethod = filterMethod === 'all' || endpoint.method === filterMethod
    return matchesSearch && matchesMethod
  })

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'POST': return 'bg-green-100 text-green-700 border-green-300'
      case 'PUT': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'DELETE': return 'bg-red-100 text-red-700 border-red-300'
      case 'PATCH': return 'bg-purple-100 text-purple-700 border-purple-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-green-600'
    if (code >= 400 && code < 500) return 'text-yellow-600'
    if (code >= 500) return 'text-red-600'
    return 'text-gray-600'
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleTestAPI = async () => {
    // Simulate API test
    setTestResponse('Loading...')
    setTimeout(() => {
      setTestResponse(`{
  "status": "success",
  "data": {
    "message": "API test completed successfully",
    "timestamp": "${new Date().toISOString()}",
    "endpoint": "${testRequest.url}",
    "method": "${testRequest.method}"
  }
}`)
    }, 2000)
  }

  const currentEndpoint = endpoints.find(e => e.id === selectedEndpoint)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">API Documentation</h2>
        <div className="flex space-x-2">
          <Dialog open={isTestConsoleOpen} onOpenChange={setIsTestConsoleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                Test API
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>API Test Console</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Method & URL</label>
                    <div className="flex space-x-2 mt-1">
                      <select 
                        value={testRequest.method}
                        onChange={(e) => setTestRequest({...testRequest, method: e.target.value})}
                        className="px-3 py-2 border rounded-md"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                      <Input
                        placeholder="https://api.example.com/endpoint"
                        value={testRequest.url}
                        onChange={(e) => setTestRequest({...testRequest, url: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Headers</label>
                    <Textarea
                      placeholder='{"Content-Type": "application/json"}'
                      value={testRequest.headers}
                      onChange={(e) => setTestRequest({...testRequest, headers: e.target.value})}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Request Body</label>
                    <Textarea
                      placeholder='{"key": "value"}'
                      value={testRequest.body}
                      onChange={(e) => setTestRequest({...testRequest, body: e.target.value})}
                      className="mt-1"
                      rows={4}
                    />
                  </div>
                  
                  <Button onClick={handleTestAPI} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Response</label>
                  <div className="mt-1 bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-80 overflow-y-auto">
                    <pre>{testResponse || 'Response will appear here...'}</pre>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export OpenAPI
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* API Navigation */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>API Endpoints</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search and Filter */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            {/* Endpoints by Category */}
            <div className="max-h-96 overflow-y-auto">
              {categories.map((category) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b"
                  >
                    <span className="font-semibold text-sm">{category}</span>
                    {expandedCategories.includes(category) ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </button>
                  
                  {expandedCategories.includes(category) && (
                    <div className="bg-gray-50">
                      {filteredEndpoints
                        .filter(endpoint => endpoint.category === category)
                        .map((endpoint) => (
                          <button
                            key={endpoint.id}
                            onClick={() => setSelectedEndpoint(endpoint.id)}
                            className={`w-full text-left p-3 hover:bg-gray-100 border-b ${
                              selectedEndpoint === endpoint.id ? 'bg-blue-100 border-r-2 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className={`text-xs px-2 py-0.5 ${getMethodColor(endpoint.method)}`}>
                                {endpoint.method}
                              </Badge>
                              {endpoint.authentication && <Key className="h-3 w-3 text-yellow-500" />}
                            </div>
                            <p className="text-sm font-medium">{endpoint.path}</p>
                            <p className="text-xs text-gray-600 truncate">{endpoint.summary}</p>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Endpoint Details */}
        <Card className="col-span-8">
          {currentEndpoint ? (
            <div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Badge className={`px-3 py-1 ${getMethodColor(currentEndpoint.method)}`}>
                      {currentEndpoint.method}
                    </Badge>
                    <code className="text-lg font-mono">{currentEndpoint.path}</code>
                    {currentEndpoint.authentication && (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Key className="h-3 w-3" />
                        <span>Auth Required</span>
                      </Badge>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle>{currentEndpoint.summary}</CardTitle>
                <p className="text-gray-600">{currentEndpoint.description}</p>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="parameters" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="responses">Responses</TabsTrigger>
                    <TabsTrigger value="examples">Examples</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parameters" className="mt-4">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Request Parameters</h4>
                      {currentEndpoint.parameters.length > 0 ? (
                        <div className="space-y-3">
                          {currentEndpoint.parameters.map((param, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <code className="font-semibold">{param.name}</code>
                                  <Badge variant="outline" className="text-xs">{param.type}</Badge>
                                  {param.required && (
                                    <Badge variant="destructive" className="text-xs">Required</Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{param.description}</p>
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-xs text-gray-500">Example: </span>
                                <code className="text-sm">{param.example}</code>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No parameters required</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="responses" className="mt-4">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Response Schema</h4>
                      <div className="space-y-3">
                        {currentEndpoint.responses.map((response, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="outline" className={`${getStatusColor(response.code)}`}>
                                {response.code}
                              </Badge>
                              <span className="font-semibold">{response.description}</span>
                              {response.code === 200 && <CheckCircle className="h-4 w-4 text-green-500" />}
                              {response.code >= 400 && <AlertCircle className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="bg-gray-900 text-green-400 font-mono text-sm p-3 rounded">
                              <pre>{JSON.stringify(JSON.parse(response.example), null, 2)}</pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="examples" className="mt-4">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Code Examples</h4>
                      
                      <Tabs defaultValue="curl" className="w-full">
                        <TabsList>
                          <TabsTrigger value="curl">cURL</TabsTrigger>
                          <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                          <TabsTrigger value="python">Python</TabsTrigger>
                        </TabsList>

                        <TabsContent value="curl" className="mt-3">
                          <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg">
                            <pre>{`curl -X ${currentEndpoint.method} \\
  "https://api.example.com${currentEndpoint.path}" \\
  -H "Content-Type: application/json"${currentEndpoint.authentication ? ' \\\n  -H "Authorization: Bearer YOUR_TOKEN"' : ''}${currentEndpoint.method === 'POST' ? ' \\\n  -d \'{"key": "value"}\'' : ''}`}</pre>
                          </div>
                        </TabsContent>

                        <TabsContent value="javascript" className="mt-3">
                          <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg">
                            <pre>{`const response = await fetch('https://api.example.com${currentEndpoint.path}', {
  method: '${currentEndpoint.method}',
  headers: {
    'Content-Type': 'application/json',${currentEndpoint.authentication ? "\n    'Authorization': 'Bearer YOUR_TOKEN'," : ''}
  },${currentEndpoint.method === 'POST' ? "\n  body: JSON.stringify({key: 'value'})," : ''}
});

const data = await response.json();
console.log(data);`}</pre>
                          </div>
                        </TabsContent>

                        <TabsContent value="python" className="mt-3">
                          <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg">
                            <pre>{`import requests

url = "https://api.example.com${currentEndpoint.path}"
headers = {
    "Content-Type": "application/json",${currentEndpoint.authentication ? '\n    "Authorization": "Bearer YOUR_TOKEN",' : ''}
}${currentEndpoint.method === 'POST' ? '\ndata = {"key": "value"}' : ''}

response = requests.${currentEndpoint.method.toLowerCase()}(url, headers=headers${currentEndpoint.method === 'POST' ? ', json=data' : ''})
print(response.json())`}</pre>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </div>
          ) : (
            <CardContent className="text-center py-12">
              <Globe className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select an API Endpoint</h3>
              <p className="text-gray-600">Choose an endpoint from the left panel to view its documentation</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}