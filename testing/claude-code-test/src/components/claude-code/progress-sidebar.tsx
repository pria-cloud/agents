'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface ProgressSidebarProps {
  session: any
  progress: any[]
  mode: 'business' | 'developer'
}

export function ProgressSidebar({ session, progress, mode }: ProgressSidebarProps) {
  const getProgress = () => {
    switch (session?.status) {
      case 'discovering': return 20
      case 'planning': return 40
      case 'generating': return 70
      case 'reviewing': return 90
      case 'completed': return 100
      default: return 0
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm text-muted-foreground">{getProgress()}%</span>
          </div>
          <Progress value={getProgress()} />
        </div>

        {session && (
          <div className="space-y-2">
            <Badge variant="secondary">
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Mode: {session.mode}
            </p>
            
            {/* Sandbox Status */}
            <div className="mt-3 p-3 bg-muted rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Development Environment</span>
                {session.e2b_sandbox_id ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              {session.e2b_sandbox_id ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Sandbox ID: {session.e2b_sandbox_id.slice(0, 8)}...
                  </p>
                  {session.e2b_sandbox_url && (
                    <p className="text-xs text-muted-foreground">
                      Ready for development
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Environment will be created on first message
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Events</h4>
          {progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet</p>
          ) : (
            <div className="space-y-1">
              {progress.slice(-5).map((event, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{event.event_type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}