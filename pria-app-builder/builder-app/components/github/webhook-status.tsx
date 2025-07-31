'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface WebhookEvent {
  id: string
  event_type: string
  repository_name: string
  payload: any
  processed_at: string
  created_at: string
}

interface GitHubNotification {
  id: string
  type: string
  title: string
  message: string
  data: any
  read: boolean
  created_at: string
}

interface WebhookStatusProps {
  sessionId: string
  workspaceId: string
}

export function WebhookStatus({ sessionId, workspaceId }: WebhookStatusProps) {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
  const [notifications, setNotifications] = useState<GitHubNotification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()
  
  useEffect(() => {
    // Load initial data
    loadWebhookEvents()
    loadNotifications()
    
    // Set up real-time subscriptions
    const webhookChannel = supabase
      .channel('webhook_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhook_events'
        },
        (payload) => {
          console.log('[WEBHOOK] Real-time event:', payload)
          loadWebhookEvents() // Refresh the list
        }
      )
      .subscribe()
    
    const notificationChannel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('[NOTIFICATION] Real-time event:', payload)
          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as GitHubNotification
            setNotifications(prev => [newNotification, ...prev])
            
            // Show toast for code sync notifications
            if (newNotification.type === 'code_sync') {
              toast({
                title: newNotification.title,
                description: newNotification.message,
                duration: 5000,
              })
            }
          }
        }
      )
      .subscribe()
    
    setIsConnected(true)
    
    return () => {
      webhookChannel.unsubscribe()
      notificationChannel.unsubscribe()
    }
  }, [sessionId, workspaceId, supabase])
  
  const loadWebhookEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (error) throw error
      setWebhookEvents(data || [])
    } catch (error) {
      console.error('Failed to load webhook events:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }
  
  const markNotificationRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      
      if (error) throw error
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }
  
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'push':
        return <GitBranch className="h-4 w-4" />
      case 'pull_request':
        return <RefreshCw className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }
  
  const getEventBadgeVariant = (eventType: string) => {
    switch (eventType) {
      case 'push':
        return 'default'
      case 'pull_request':
        return 'secondary'
      default:
        return 'outline'
    }
  }
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Webhook Status...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            GitHub Webhook Status
          </CardTitle>
          <CardDescription>
            {isConnected 
              ? 'Connected and listening for GitHub events'
              : 'Disconnected from GitHub webhook service'
            }
          </CardDescription>
        </CardHeader>
      </Card>
      
      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>
              Code synchronization and GitHub activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.read ? 'opacity-60' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    {notification.data?.commits && (
                      <div className="mt-2 space-y-1">
                        {notification.data.commits.map((commit: any) => (
                          <div key={commit.id} className="text-xs text-muted-foreground">
                            <code className="bg-muted px-1 rounded">{commit.id}</code>
                            {' '}{commit.message} - {commit.author}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markNotificationRead(notification.id)}
                      >
                        Mark Read
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* Recent Webhook Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Events</CardTitle>
          <CardDescription>
            Latest GitHub webhook events received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhookEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No webhook events received yet
            </p>
          ) : (
            <div className="space-y-3">
              {webhookEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {getEventIcon(event.event_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getEventBadgeVariant(event.event_type)}>
                          {event.event_type}
                        </Badge>
                        <span className="text-sm font-medium">
                          {event.repository_name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {event.payload?.commits?.[0]?.message || 
                         event.payload?.pull_request?.title || 
                         'GitHub activity'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(event.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}