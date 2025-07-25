"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Folder, File, Save, Play, RefreshCw, Search, MoreHorizontal, Loader2, Plus, Trash2 } from "lucide-react"
import Editor from '@monaco-editor/react'
import { useToast } from "@/components/ui/use-toast"
import { useDebounce } from "@/hooks/use-debounce"

interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  content?: string
  children?: FileNode[]
  generated?: boolean
  modified?: boolean
}

interface GeneratedFile {
  id: string
  session_id: string
  workspace_id: string
  file_path: string
  content: string
  file_type: string
  checksum: string
  generated_by: 'claude' | 'user' | 'system'
  version: number
  created_at: string
  updated_at: string
}

interface OpenTab {
  id: string
  path: string
  name: string
  content: string
  modified: boolean
  generated?: boolean
}

interface CodeEditorProps {
  sessionId: string
  workspaceId: string
}

export function CodeEditor({ sessionId, workspaceId }: CodeEditorProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const { toast } = useToast()

  // Get current editor content
  const currentTab = openTabs.find(tab => tab.id === selectedTabId)
  const debouncedContent = useDebounce(currentTab?.content || '', 500)

  // Fetch files from backend
  useEffect(() => {
    fetchFiles()
  }, [sessionId])

  // Auto-save on content change
  useEffect(() => {
    if (currentTab && currentTab.modified && debouncedContent === currentTab.content) {
      saveFile(currentTab.path, currentTab.content)
    }
  }, [debouncedContent])

  const fetchFiles = async () => {
    try {
      const response = await fetch(`/api/generated-files?session_id=${sessionId}`)
      if (!response.ok) throw new Error('Failed to fetch files')
      
      const files: GeneratedFile[] = await response.json()
      
      // Build file tree from flat file list
      const tree = buildFileTree(files)
      setFileTree(tree)
      
      // Open the first file if none are open
      if (files.length > 0 && openTabs.length === 0) {
        openFile(files[0])
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const buildFileTree = (files: GeneratedFile[]): FileNode[] => {
    const root: FileNode[] = []
    const nodeMap = new Map<string, FileNode>()

    // Create all nodes
    files.forEach(file => {
      const parts = file.file_path.split('/')
      let currentPath = ''
      
      parts.forEach((part, index) => {
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        if (!nodeMap.has(currentPath)) {
          const isFile = index === parts.length - 1
          const node: FileNode = {
            id: isFile ? file.id : currentPath,
            name: part,
            type: isFile ? 'file' : 'folder',
            path: currentPath,
            content: isFile ? file.content : undefined,
            generated: isFile && file.generated_by === 'claude',
            children: isFile ? undefined : []
          }
          
          nodeMap.set(currentPath, node)
          
          if (parentPath) {
            const parent = nodeMap.get(parentPath)
            if (parent && parent.children) {
              parent.children.push(node)
            }
          } else {
            root.push(node)
          }
        }
      })
    })

    return root
  }

  const openFile = (file: GeneratedFile | FileNode) => {
    const existingTab = openTabs.find(tab => tab.path === ('file_path' in file ? file.file_path : file.path))
    
    if (existingTab) {
      setSelectedTabId(existingTab.id)
    } else {
      const newTab: OpenTab = {
        id: file.id,
        path: 'file_path' in file ? file.file_path : file.path,
        name: 'file_path' in file ? file.file_path.split('/').pop() || file.file_path : file.name,
        content: 'content' in file ? (file.content || '') : '',
        modified: false,
        generated: 'generated_by' in file ? file.generated_by === 'claude' : file.generated
      }
      
      setOpenTabs([...openTabs, newTab])
      setSelectedTabId(newTab.id)
    }
  }

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId)
    const newTabs = openTabs.filter(tab => tab.id !== tabId)
    setOpenTabs(newTabs)
    
    if (selectedTabId === tabId && newTabs.length > 0) {
      const newIndex = Math.min(tabIndex, newTabs.length - 1)
      setSelectedTabId(newTabs[newIndex].id)
    }
  }

  const updateTabContent = (tabId: string, content: string) => {
    setOpenTabs(openTabs.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, modified: true }
        : tab
    ))
  }

  const saveFile = async (filePath: string, content: string) => {
    setSaving(true)
    try {
      const response = await fetch('/api/generated-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          workspace_id: workspaceId,
          file_path: filePath,
          content,
          file_type: getFileType(filePath),
          generated_by: 'user'
        })
      })
      
      if (!response.ok) throw new Error('Failed to save file')
      
      // Mark tab as saved
      setOpenTabs(openTabs.map(tab => 
        tab.path === filePath 
          ? { ...tab, modified: false }
          : tab
      ))
      
      // Refresh file tree
      await fetchFiles()
      
      toast({
        title: 'Success',
        description: 'File saved'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAll = async () => {
    const modifiedTabs = openTabs.filter(tab => tab.modified)
    
    for (const tab of modifiedTabs) {
      await saveFile(tab.path, tab.content)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      // Save all modified files first
      await handleSaveAll()
      
      // Trigger code execution via Claude SDK
      const response = await fetch('/api/claude/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          workspace_id: workspaceId,
          entry_point: currentTab?.path || 'src/app/page.tsx'
        })
      })
      
      if (!response.ok) throw new Error('Failed to execute code')
      
      const result = await response.json()
      
      toast({
        title: 'Success',
        description: 'Code executed successfully'
      })
      
      // Handle execution results (open console, show output, etc.)
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute code',
        variant: 'destructive'
      })
    } finally {
      setRunning(false)
    }
  }

  const getFileType = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const typeMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'html': 'html',
      'py': 'python',
      'sql': 'sql'
    }
    return typeMap[ext] || 'text'
  }

  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'html': 'html',
      'py': 'python',
      'sql': 'sql'
    }
    return langMap[ext] || 'plaintext'
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.id} style={{ paddingLeft: `${level * 16}px` }}>
        {node.type === 'folder' ? (
          <div>
            <div className="flex items-center space-x-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
              <Folder className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{node.name}</span>
            </div>
            {node.children && renderFileTree(node.children, level + 1)}
          </div>
        ) : (
          <div
            className={`flex items-center space-x-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer ${
              openTabs.find(tab => tab.path === node.path) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
            onClick={() => openFile(node)}
          >
            <File className="h-4 w-4 text-gray-500" />
            <span className="text-sm flex-1">{node.name}</span>
            {node.generated && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                AI
              </Badge>
            )}
          </div>
        )}
      </div>
    ))
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
        <h2 className="text-2xl font-bold">Code Editor</h2>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleSaveAll} 
            disabled={saving || !openTabs.some(tab => tab.modified)}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
          <Button onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[600px]">
        {/* File Explorer */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Folder className="h-5 w-5" />
                <span>Files</span>
              </div>
              <Button variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 space-y-1 max-h-[500px] overflow-y-auto">
              {fileTree.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <File className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-sm">No files yet</p>
                </div>
              ) : (
                renderFileTree(fileTree)
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="col-span-9">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 overflow-x-auto">
                {openTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-t-md text-sm whitespace-nowrap ${
                      selectedTabId === tab.id
                        ? 'bg-white dark:bg-gray-800 border-t border-l border-r' 
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => setSelectedTabId(tab.id)}
                  >
                    <File className="h-3 w-3" />
                    <span>{tab.name}</span>
                    {tab.modified && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                    {tab.generated && (
                      <Badge variant="outline" className="text-xs px-1 py-0 ml-1">
                        AI
                      </Badge>
                    )}
                    <button
                      className="ml-2 p-0.5 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                      onClick={(e) => closeTab(tab.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
            {currentTab ? (
              <Editor
                height="500px"
                language={getLanguageFromPath(currentTab.path)}
                value={currentTab.content}
                onChange={(value) => updateTabContent(currentTab.id, value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  readOnly: false
                }}
              />
            ) : (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <File className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a file to edit</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span>{currentTab ? getLanguageFromPath(currentTab.path) : 'No file'}</span>
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