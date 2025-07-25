"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Folder, File, Save, Play, RefreshCw, Search, MoreHorizontal } from "lucide-react"
import Editor from '@monaco-editor/react'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
  content?: string
}

export function CodeEditor() {
  const [selectedFile, setSelectedFile] = useState<string>('src/app/page.tsx')
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const fileTree: FileNode[] = [
    {
      name: 'src',
      type: 'folder',
      children: [
        {
          name: 'app',
          type: 'folder',
          children: [
            { name: 'globals.css', type: 'file' },
            { name: 'layout.tsx', type: 'file' },
            { name: 'page.tsx', type: 'file', content: 'export default function Home() {\n  return (\n    <main className="container mx-auto p-8">\n      <h1 className="text-4xl font-bold mb-4">Welcome to Your App</h1>\n      <p className="text-lg">Start building your application here.</p>\n    </main>\n  )\n}' }
          ]
        },
        {
          name: 'components',
          type: 'folder',
          children: [
            {
              name: 'ui',
              type: 'folder',
              children: [
                { name: 'button.tsx', type: 'file' },
                { name: 'card.tsx', type: 'file' },
                { name: 'input.tsx', type: 'file' }
              ]
            },
            { name: 'header.tsx', type: 'file' },
            { name: 'footer.tsx', type: 'file' }
          ]
        },
        {
          name: 'lib',
          type: 'folder',
          children: [
            { name: 'utils.ts', type: 'file' }
          ]
        }
      ]
    },
    { name: 'package.json', type: 'file' },
    { name: 'README.md', type: 'file' },
    { name: 'next.config.js', type: 'file' }
  ]

  const openTabs = [
    { path: 'src/app/page.tsx', name: 'page.tsx', modified: true },
    { path: 'src/components/header.tsx', name: 'header.tsx', modified: false },
    { path: 'package.json', name: 'package.json', modified: false }
  ]

  useEffect(() => {
    // Find the selected file content
    const findFileContent = (nodes: FileNode[], path: string): string => {
      const pathParts = path.split('/')
      for (const node of nodes) {
        if (node.name === pathParts[0]) {
          if (pathParts.length === 1 && node.content) {
            return node.content
          } else if (node.children && pathParts.length > 1) {
            return findFileContent(node.children, pathParts.slice(1).join('/'))
          }
        }
      }
      return '// File content loading...'
    }

    const content = findFileContent(fileTree, selectedFile.replace(/^src\//, ''))
    setFileContent(content)
  }, [selectedFile])

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node, index) => (
      <div key={index} style={{ paddingLeft: `${level * 16}px` }}>
        {node.type === 'folder' ? (
          <div>
            <div className="flex items-center space-x-2 py-1 hover:bg-gray-100 rounded cursor-pointer">
              <Folder className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{node.name}</span>
            </div>
            {node.children && renderFileTree(node.children, level + 1)}
          </div>
        ) : (
          <div
            className={`flex items-center space-x-2 py-1 hover:bg-gray-100 rounded cursor-pointer ${
              selectedFile.includes(node.name) ? 'bg-blue-50' : ''
            }`}
            onClick={() => setSelectedFile(`src/${node.name}`)}
          >
            <File className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{node.name}</span>
          </div>
        )}
      </div>
    ))
  }

  const handleSave = () => {
    setIsLoading(true)
    // Simulate save operation
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  const handleRun = () => {
    setIsLoading(true)
    // Simulate run operation
    setTimeout(() => {
      setIsLoading(false)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Code Editor</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={handleRun} disabled={isLoading}>
            <Play className="h-4 w-4 mr-2" />
            {isLoading ? 'Running...' : 'Run'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[600px]">
        {/* File Explorer */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Folder className="h-5 w-5" />
              <span>File Explorer</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 space-y-1 max-h-[500px] overflow-y-auto">
              {renderFileTree(fileTree)}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="col-span-9">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-x-auto">
                {openTabs.map((tab, index) => (
                  <button
                    key={index}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-t-md text-sm whitespace-nowrap ${
                      selectedFile.includes(tab.name) 
                        ? 'bg-white border-t border-l border-r' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedFile(tab.path)}
                  >
                    <File className="h-3 w-3" />
                    <span>{tab.name}</span>
                    {tab.modified && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Editor
              height="500px"
              defaultLanguage="typescript"
              value={fileContent}
              onChange={(value) => setFileContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span>TypeScript React</span>
              <span>Line 1, Column 1</span>
              <Badge variant="outline">UTF-8</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-green-600">● No Problems</span>
              <Button variant="ghost" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}