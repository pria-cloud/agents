'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code2, Terminal, GitBranch, MessageSquare } from 'lucide-react'
import { RequirementChat } from './requirement-chat'

interface DeveloperInterfaceProps {
  session: any
  progress: any[]
  workspaceId: string
  userId: string
}

export function DeveloperInterface({ session, progress, workspaceId, userId }: DeveloperInterfaceProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">File explorer will appear here</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Git
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Git integration will appear here</p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="code">Code Editor</TabsTrigger>
            <TabsTrigger value="terminal">Terminal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat">
            <RequirementChat 
              sessionId={session?.id || ''}
              mode="developer"
              workspaceId={workspaceId}
              userId={userId}
            />
          </TabsContent>
          
          <TabsContent value="code">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Code editor will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="terminal">
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">Terminal will appear here</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Build Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Build information will appear here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}