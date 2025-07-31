'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Folder, 
  FolderOpen, 
  Download, 
  RefreshCw,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-muted">
      <div className="text-sm text-muted-foreground">Loading editor...</div>
    </div>
  )
})

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  lastModified?: string
  children?: FileNode[]
  content?: string
}

interface CodeViewProps {
  sessionId?: string
  files: FileNode[]
  onRefresh?: () => void
  className?: string
}

interface FileTreeProps {
  nodes: FileNode[]
  selectedFile?: string
  onFileSelect: (file: FileNode) => void
  level?: number
}

function FileTree({ nodes, selectedFile, onFileSelect, level = 0 }: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const getFileIcon = (file: FileNode) => {
    if (file.type === 'directory') {
      return expandedDirs.has(file.path) ? (
        <FolderOpen className="h-4 w-4" />
      ) : (
        <Folder className="h-4 w-4" />
      )
    }
    return <FileText className="h-4 w-4" />
  }

  const getLanguageFromExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'json':
        return 'json'
      case 'css':
        return 'css'
      case 'html':
        return 'html'
      case 'md':
        return 'markdown'
      case 'sql':
        return 'sql'
      default:
        return 'plaintext'
    }
  }

  return (
    <div>
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent rounded-sm text-sm",
              selectedFile === node.path && "bg-accent text-accent-foreground",
              "transition-colors"
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (node.type === 'directory') {
                toggleDirectory(node.path)
              } else {
                onFileSelect(node)
              }
            }}
          >
            {node.type === 'directory' && (
              <div className="w-4 h-4 flex items-center justify-center">
                {expandedDirs.has(node.path) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </div>
            )}
            {getFileIcon(node)}
            <span className="flex-1 truncate">{node.name}</span>
            {node.type === 'file' && node.size && (
              <span className="text-xs text-muted-foreground">
                {(node.size / 1024).toFixed(1)}KB
              </span>
            )}
          </div>
          
          {node.type === 'directory' && expandedDirs.has(node.path) && node.children && (
            <FileTree
              nodes={node.children}
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function CodeView({ sessionId, files, onRefresh, className }: CodeViewProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileSelect = async (file: FileNode) => {
    if (file.type === 'file') {
      setSelectedFile(file)
      setIsLoading(true)
      
      try {
        // Check if file already has content loaded
        if (file.content) {
          setFileContent(file.content)
        } else if (sessionId) {
          // Fetch actual file content from the Target App
          const response = await fetch(
            `/api/claude/project?sessionId=${sessionId}&action=get_file_content&filePath=${encodeURIComponent(file.path)}`
          )
          
          const result = await response.json()
          
          if (result.success && result.exists) {
            setFileContent(result.content || '')
          } else {
            setFileContent(
              `// File not found or empty: ${file.name}\n// Path: ${file.path}\n\n// ${result.error || 'File does not exist in the Target App'}`
            )
          }
        } else {
          setFileContent(`// No session active\n// Cannot fetch content for: ${file.name}`)
        }
      } catch (error) {
        console.error('Failed to load file content:', error)
        setFileContent(`// Error loading file: ${file.name}\n// ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleDownloadFile = () => {
    if (selectedFile && fileContent) {
      const blob = new Blob([fileContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedFile.name
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const getLanguageFromExtension = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'json':
        return 'json'
      case 'css':
        return 'css'
      case 'html':
        return 'html'
      case 'md':
        return 'markdown'
      case 'sql':
        return 'sql'
      default:
        return 'plaintext'
    }
  }

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Session Active</h3>
          <p className="text-muted-foreground">
            Start a conversation to begin generating code files.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex", className)}>
      {/* File Explorer */}
      <div className="w-80 border-r border-border flex flex-col bg-muted/10">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Files</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              title="Refresh files"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {files.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No files generated yet</p>
              <p className="text-xs mt-1">
                Start a conversation to generate code
              </p>
            </div>
          ) : (
            <div className="p-2">
              <FileTree
                nodes={files}
                selectedFile={selectedFile?.path}
                onFileSelect={handleFileSelect}
              />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b border-border bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedFile.path}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadFile}
                  title="Download file"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
            </div>
            
            <div className="flex-1">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-sm text-muted-foreground">
                    Loading file content...
                  </div>
                </div>
              ) : (
                <MonacoEditor
                  height="100%"
                  language={getLanguageFromExtension(selectedFile.name)}
                  value={fileContent}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Select a file</h3>
              <p className="text-muted-foreground">
                Choose a file from the explorer to view its contents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}