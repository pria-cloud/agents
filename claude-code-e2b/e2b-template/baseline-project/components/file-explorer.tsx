'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Plus, Trash2, Edit, Save, X } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  children?: FileNode[]
}

interface FileExplorerProps {
  onFileSelect?: (path: string) => void
}

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const [fileTree, setFileTree] = useState<FileNode | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadFileTree()
  }, [])

  const loadFileTree = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/files/tree')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const tree = await response.json()
      setFileTree(tree)
    } catch (error) {
      console.error('Error loading file tree:', error)
      setError('Failed to load file tree')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const selectFile = async (path: string, isFile: boolean) => {
    if (!isFile) {
      toggleDirectory(path)
      return
    }

    setSelectedFile(path)
    setIsEditing(false)
    onFileSelect?.(path)

    try {
      const response = await fetch(`/api/files/content/${encodeURIComponent(path)}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setFileContent(data.content)
    } catch (error) {
      console.error('Error loading file content:', error)
      setFileContent('Error loading file content')
    }
  }

  const saveFile = async () => {
    if (!selectedFile) return

    try {
      const response = await fetch('/api/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: selectedFile,
          content: fileContent,
          createDirectories: true
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setIsEditing(false)
      await loadFileTree() // Refresh tree to show any new files
    } catch (error) {
      console.error('Error saving file:', error)
      setError('Failed to save file')
    }
  }

  const deleteFile = async (path: string) => {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return

    try {
      const response = await fetch(`/api/files/${encodeURIComponent(path)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (selectedFile === path) {
        setSelectedFile(null)
        setFileContent('')
      }
      await loadFileTree()
    } catch (error) {
      console.error('Error deleting file:', error)
      setError('Failed to delete file')
    }
  }

  const createNewFile = async () => {
    const fileName = prompt('Enter file name:')
    if (!fileName) return

    const path = selectedFile ? selectedFile.split('/').slice(0, -1).join('/') + '/' + fileName : fileName

    try {
      const response = await fetch('/api/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          content: '',
          createDirectories: true
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      await loadFileTree()
      selectFile(path, true)
    } catch (error) {
      console.error('Error creating file:', error)
      setError('Failed to create file')
    }
  }

  const renderFileNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedDirs.has(node.path)
    const isSelected = selectedFile === node.path
    const Icon = node.type === 'directory' 
      ? (isExpanded ? FolderOpen : Folder)
      : File

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded text-sm ${
            isSelected ? 'bg-accent text-accent-foreground' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => selectFile(node.path, node.type === 'file')}
        >
          {node.type === 'directory' && (
            <button
              className="p-0.5 hover:bg-secondary rounded"
              onClick={(e) => {
                e.stopPropagation()
                toggleDirectory(node.path)
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          )}
          
          <Icon size={16} className="flex-shrink-0" />
          <span className="truncate flex-1">{node.name}</span>
          
          {node.type === 'file' && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                className="p-1 hover:bg-secondary rounded"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteFile(node.path)
                }}
                title="Delete file"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* File Tree */}
      <div className="w-80 border-r border-border bg-card">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Project Files</h3>
            <div className="flex gap-1">
              <button
                onClick={createNewFile}
                className="p-1.5 hover:bg-secondary rounded"
                title="New file"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={loadFileTree}
                className="p-1.5 hover:bg-secondary rounded"
                title="Refresh"
              >
                <File size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto h-full p-2">
          {isLoading && (
            <div className="text-center text-muted-foreground py-4">
              Loading...
            </div>
          )}
          
          {error && (
            <div className="text-center text-destructive py-4 text-sm">
              {error}
            </div>
          )}
          
          {fileTree && !isLoading && (
            <div className="space-y-1">
              {fileTree.children?.map(node => renderFileNode(node)) || renderFileNode(fileTree)}
            </div>
          )}
        </div>
      </div>

      {/* File Content */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedFile.split('/').pop()}</h3>
                  <p className="text-xs text-muted-foreground">{selectedFile}</p>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={saveFile}
                        className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                      >
                        <Save size={12} />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false)
                          selectFile(selectedFile, true) // Reload original content
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/80"
                    >
                      <Edit size={12} />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 p-4">
              {isEditing ? (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full h-full p-3 font-mono text-sm bg-background border border-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder="File content..."
                />
              ) : (
                <pre className="w-full h-full p-3 font-mono text-sm bg-secondary rounded overflow-auto">
                  <code>{fileContent}</code>
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <File size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a file to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}