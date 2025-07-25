"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Database, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  Link, 
  Download, 
  Code, 
  Play,
  RefreshCw,
  Settings
} from "lucide-react"

interface Column {
  name: string
  type: string
  nullable: boolean
  primary: boolean
  foreign?: string
  default?: string
}

interface Table {
  id: string
  name: string
  columns: Column[]
  description: string
}

interface Relationship {
  from: string
  to: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  fromField: string
  toField: string
}

export function DatabaseSchema() {
  const [tables, setTables] = useState<Table[]>([
    {
      id: '1',
      name: 'users',
      description: 'User accounts and authentication data',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' },
        { name: 'email', type: 'VARCHAR(255)', nullable: false, primary: false },
        { name: 'password_hash', type: 'VARCHAR(255)', nullable: false, primary: false },
        { name: 'first_name', type: 'VARCHAR(100)', nullable: true, primary: false },
        { name: 'last_name', type: 'VARCHAR(100)', nullable: true, primary: false },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, primary: false, default: 'NOW()' },
        { name: 'updated_at', type: 'TIMESTAMP', nullable: false, primary: false, default: 'NOW()' }
      ]
    },
    {
      id: '2',
      name: 'products',
      description: 'Product catalog information',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' },
        { name: 'name', type: 'VARCHAR(255)', nullable: false, primary: false },
        { name: 'description', type: 'TEXT', nullable: true, primary: false },
        { name: 'price', type: 'DECIMAL(10,2)', nullable: false, primary: false },
        { name: 'inventory_count', type: 'INTEGER', nullable: false, primary: false, default: '0' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, primary: false, default: 'NOW()' }
      ]
    },
    {
      id: '3',
      name: 'orders',
      description: 'Customer orders and transactions',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' },
        { name: 'user_id', type: 'UUID', nullable: false, primary: false, foreign: 'users.id' },
        { name: 'total_amount', type: 'DECIMAL(10,2)', nullable: false, primary: false },
        { name: 'status', type: 'VARCHAR(50)', nullable: false, primary: false, default: 'pending' },
        { name: 'created_at', type: 'TIMESTAMP', nullable: false, primary: false, default: 'NOW()' }
      ]
    },
    {
      id: '4',
      name: 'order_items',
      description: 'Individual items within orders',
      columns: [
        { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' },
        { name: 'order_id', type: 'UUID', nullable: false, primary: false, foreign: 'orders.id' },
        { name: 'product_id', type: 'UUID', nullable: false, primary: false, foreign: 'products.id' },
        { name: 'quantity', type: 'INTEGER', nullable: false, primary: false },
        { name: 'price', type: 'DECIMAL(10,2)', nullable: false, primary: false }
      ]
    }
  ])

  const [relationships] = useState<Relationship[]>([
    { from: 'users', to: 'orders', type: 'one-to-many', fromField: 'id', toField: 'user_id' },
    { from: 'orders', to: 'order_items', type: 'one-to-many', fromField: 'id', toField: 'order_id' },
    { from: 'products', to: 'order_items', type: 'one-to-many', fromField: 'id', toField: 'product_id' }
  ])

  const [selectedTable, setSelectedTable] = useState<string>('1')
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)
  const [isEditSchemaOpen, setIsEditSchemaOpen] = useState(false)
  const [isMigrationOpen, setIsMigrationOpen] = useState(false)

  const [newTable, setNewTable] = useState({
    name: '',
    description: '',
    columns: [
      { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' }
    ]
  })

  const handleAddTable = () => {
    if (newTable.name.trim()) {
      const table: Table = {
        id: Date.now().toString(),
        name: newTable.name.trim(),
        description: newTable.description.trim(),
        columns: newTable.columns
      }
      setTables([...tables, table])
      setNewTable({
        name: '',
        description: '',
        columns: [
          { name: 'id', type: 'UUID', nullable: false, primary: true, default: 'gen_random_uuid()' }
        ]
      })
      setIsAddTableOpen(false)
    }
  }

  const generateMigrationSQL = () => {
    const selectedTableData = tables.find(t => t.id === selectedTable)
    if (!selectedTableData) return ''

    let sql = `-- Create table: ${selectedTableData.name}\n`
    sql += `CREATE TABLE ${selectedTableData.name} (\n`
    
    const columnDefinitions = selectedTableData.columns.map(col => {
      let definition = `  ${col.name} ${col.type}`
      if (!col.nullable) definition += ' NOT NULL'
      if (col.primary) definition += ' PRIMARY KEY'
      if (col.default) definition += ` DEFAULT ${col.default}`
      return definition
    })
    
    sql += columnDefinitions.join(',\n')
    sql += '\n);\n\n'
    
    // Add foreign key constraints
    selectedTableData.columns.forEach(col => {
      if (col.foreign) {
        const [refTable, refColumn] = col.foreign.split('.')
        sql += `ALTER TABLE ${selectedTableData.name}\n`
        sql += `ADD CONSTRAINT fk_${selectedTableData.name}_${col.name}\n`
        sql += `FOREIGN KEY (${col.name}) REFERENCES ${refTable}(${refColumn});\n\n`
      }
    })
    
    return sql
  }

  const getColumnIcon = (column: Column) => {
    if (column.primary) return <Key className="h-3 w-3 text-yellow-500" />
    if (column.foreign) return <Link className="h-3 w-3 text-blue-500" />
    return null
  }

  const getTypeColor = (type: string) => {
    if (type.includes('VARCHAR') || type.includes('TEXT')) return 'bg-green-100 text-green-700'
    if (type.includes('INTEGER') || type.includes('DECIMAL')) return 'bg-blue-100 text-blue-700'
    if (type.includes('UUID')) return 'bg-purple-100 text-purple-700'
    if (type.includes('TIMESTAMP')) return 'bg-orange-100 text-orange-700'
    return 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Database Schema Designer</h2>
        <div className="flex space-x-2">
          <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Table</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Table name"
                  value={newTable.name}
                  onChange={(e) => setNewTable({...newTable, name: e.target.value})}
                />
                <Textarea
                  placeholder="Table description"
                  value={newTable.description}
                  onChange={(e) => setNewTable({...newTable, description: e.target.value})}
                />
                <Button onClick={handleAddTable} className="w-full">
                  Create Table
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isMigrationOpen} onOpenChange={setIsMigrationOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Code className="h-4 w-4 mr-2" />
                Generate Migration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Generate Migration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto">
                  <pre>{generateMigrationSQL()}</pre>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download SQL
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Execute Migration
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Schema
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Tables List */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Tables</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.id}
                  onClick={() => setSelectedTable(table.id)}
                  className={`w-full text-left p-3 hover:bg-gray-50 border-b ${
                    selectedTable === table.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{table.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {table.columns.length} cols
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{table.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table Details */}
        <Card className="col-span-8">
          {tables.find(t => t.id === selectedTable) && (
            <div>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Table: {tables.find(t => t.id === selectedTable)?.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Dialog open={isEditSchemaOpen} onOpenChange={setIsEditSchemaOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Schema
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Edit Table Schema</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600">
                            Schema editing interface would be implemented here with full CRUD operations for columns.
                          </p>
                          <Button className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Column
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-gray-600 mb-4">
                  {tables.find(t => t.id === selectedTable)?.description}
                </p>
                
                <Tabs defaultValue="columns" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="columns">Columns</TabsTrigger>
                    <TabsTrigger value="relationships">Relationships</TabsTrigger>
                    <TabsTrigger value="indices">Indices</TabsTrigger>
                  </TabsList>

                  <TabsContent value="columns" className="mt-4">
                    <div className="space-y-2">
                      {tables.find(t => t.id === selectedTable)?.columns.map((column, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getColumnIcon(column)}
                            <div>
                              <span className="font-semibold">{column.name}</span>
                              {column.foreign && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  FK → {column.foreign}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Badge className={`text-xs ${getTypeColor(column.type)}`}>
                              {column.type}
                            </Badge>
                            {!column.nullable && (
                              <Badge variant="outline" className="text-xs">NOT NULL</Badge>
                            )}
                            {column.default && (
                              <Badge variant="secondary" className="text-xs">
                                DEFAULT: {column.default}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="relationships" className="mt-4">
                    <div className="space-y-3">
                      {relationships
                        .filter(rel => rel.from === tables.find(t => t.id === selectedTable)?.name || 
                                     rel.to === tables.find(t => t.id === selectedTable)?.name)
                        .map((rel, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Link className="h-4 w-4 text-blue-500" />
                              <div>
                                <span className="font-semibold">
                                  {rel.from} → {rel.to}
                                </span>
                                <p className="text-sm text-gray-600">
                                  {rel.fromField} → {rel.toField}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">
                              {rel.type}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="indices" className="mt-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Key className="h-4 w-4 text-yellow-500" />
                          <div>
                            <span className="font-semibold">Primary Key</span>
                            <p className="text-sm text-gray-600">
                              {tables.find(t => t.id === selectedTable)?.columns
                                .filter(col => col.primary)
                                .map(col => col.name)
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default">UNIQUE</Badge>
                      </div>
                      
                      {tables.find(t => t.id === selectedTable)?.columns
                        .filter(col => col.foreign)
                        .map((col, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Link className="h-4 w-4 text-blue-500" />
                              <div>
                                <span className="font-semibold">Foreign Key</span>
                                <p className="text-sm text-gray-600">{col.name}</p>
                              </div>
                            </div>
                            <Badge variant="outline">INDEX</Badge>
                          </div>
                        ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </div>
          )}
        </Card>
      </div>

      {/* Schema Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">{tables.length}</div>
            <p className="text-sm text-gray-600">Total Tables</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">
              {tables.reduce((sum, table) => sum + table.columns.length, 0)}
            </div>
            <p className="text-sm text-gray-600">Total Columns</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">{relationships.length}</div>
            <p className="text-sm text-gray-600">Relationships</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-2">
              {tables.reduce((sum, table) => 
                sum + table.columns.filter(col => col.foreign).length, 0
              )}
            </div>
            <p className="text-sm text-gray-600">Foreign Keys</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}