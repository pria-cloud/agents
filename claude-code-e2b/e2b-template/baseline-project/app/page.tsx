'use client'

import { useState } from 'react'
import { ClaudeCodeChat } from '@/components/claude-code-chat'
import { FileExplorer } from '@/components/file-explorer'
import { StatusBar } from '@/components/status-bar'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, FolderTree, Code, Terminal, Globe } from 'lucide-react'

export default function Home() {
  const [activeView, setActiveView] = useState<'chat' | 'files' | 'preview'>('chat')
  const [currentSession, setCurrentSession] = useState({
    id: 'new-session',
    name: 'New App Project',
    status: 'active' as 'active' | 'idle',
    lastActivity: new Date().toISOString()
  })

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Claude Code App Builder</h1>
            <span className="text-sm text-muted-foreground">
              Build your app with AI assistance
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Session:</span>
            <span className="text-sm font-medium">{currentSession.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Claude Code Chat */}
        <div className="w-1/2 border-r flex flex-col">
          <div className="border-b px-4 py-2 flex items-center space-x-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-semibold">Chat with Claude Code</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ClaudeCodeChat />
          </div>
        </div>

        {/* Right Panel - Code/Files/Preview */}
        <div className="w-1/2 flex flex-col">
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat" className="flex items-center space-x-2">
                <Code className="h-4 w-4" />
                <span>Code</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center space-x-2">
                <FolderTree className="h-4 w-4" />
                <span>Files</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Preview</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 p-4">
              <Card className="h-full">
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">Generated Code</h3>
                  <div className="text-sm text-muted-foreground">
                    Code files will appear here as Claude generates them
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="flex-1 overflow-hidden">
              <FileExplorer />
            </TabsContent>

            <TabsContent value="preview" className="flex-1 p-4">
              <Card className="h-full">
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
                  <div className="text-sm text-muted-foreground">
                    Your app preview will appear here when running
                  </div>
                  <div className="mt-4">
                    <iframe 
                      className="w-full h-96 border rounded"
                      src="about:blank"
                      title="App Preview"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}