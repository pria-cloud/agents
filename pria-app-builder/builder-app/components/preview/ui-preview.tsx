'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  ExternalLink, 
  Monitor, 
  Smartphone, 
  Tablet,
  AlertCircle,
  Loader2,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UIPreviewProps {
  sessionId?: string
  previewUrl?: string
  onRefresh?: () => void
  className?: string
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_SIZES = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  mobile: { width: '375px', height: '667px', label: 'Mobile' }
}

export function UIPreview({ sessionId, previewUrl, onRefresh, className }: UIPreviewProps) {
  const [viewport, setViewport] = useState<ViewportSize>('desktop')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [isStartingDevServer, setIsStartingDevServer] = useState(false)
  const [devServerStatus, setDevServerStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (previewUrl) {
      setIsLoading(true)
      setLoadError(null)
    }
  }, [previewUrl])

  // Check dev server status when sessionId changes
  useEffect(() => {
    if (sessionId) {
      checkDevServerStatus()
    }
  }, [sessionId])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setLoadError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setLoadError('Failed to load preview. The application might not be running.')
  }

  const handleRefresh = () => {
    setLastRefresh(new Date())
    setIsLoading(true)
    setLoadError(null)
    
    if (iframeRef.current) {
      // Force reload the iframe
      const currentSrc = iframeRef.current.src
      iframeRef.current.src = 'about:blank'
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc
        }
      }, 100)
    }
    
    onRefresh?.()
  }

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank')
    }
  }

  const checkDevServerStatus = async () => {
    if (!sessionId) return
    
    try {
      const response = await fetch(`/api/claude/project?sessionId=${sessionId}&action=check_dev_server`)
      const result = await response.json()
      
      if (result.success) {
        setDevServerStatus(result.running ? 'running' : 'stopped')
      }
    } catch (error) {
      console.error('Failed to check dev server status:', error)
      setDevServerStatus('unknown')
    }
  }

  const handleStartDevServer = async () => {
    if (!sessionId) return
    
    setIsStartingDevServer(true)
    try {
      const response = await fetch(`/api/claude/project?sessionId=${sessionId}&action=start_dev_server`)
      const result = await response.json()
      
      if (result.success) {
        setDevServerStatus('running')
        // Force refresh the iframe with the new URL
        if (result.previewUrl) {
          handleRefresh()
        }
      } else {
        setLoadError(result.error || 'Failed to start dev server')
      }
    } catch (error) {
      console.error('Failed to start dev server:', error)
      setLoadError('Failed to start dev server')
    } finally {
      setIsStartingDevServer(false)
    }
  }

  const getViewportIcon = (size: ViewportSize) => {
    switch (size) {
      case 'desktop':
        return <Monitor className="h-4 w-4" />
      case 'tablet':
        return <Tablet className="h-4 w-4" />
      case 'mobile':
        return <Smartphone className="h-4 w-4" />
    }
  }

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Session Active</h3>
          <p className="text-muted-foreground">
            Start a conversation and generate code to see the live preview.
          </p>
        </Card>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <Monitor className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Preview Not Available</h3>
          <p className="text-muted-foreground mb-4">
            {devServerStatus === 'stopped' 
              ? 'The development server is not running. Start it to see the live preview.'
              : 'The application is being built. Preview will be available once the development server starts.'
            }
          </p>
          
          {devServerStatus === 'stopped' ? (
            <Button 
              onClick={handleStartDevServer} 
              disabled={isStartingDevServer}
              className="mb-4"
            >
              {isStartingDevServer ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting Server...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Dev Server
                </>
              )}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Waiting for:</p>
              <ul className="text-left mt-2 space-y-1">
                <li>• Code generation to complete</li>
                <li>• Dependencies to install</li>
                <li>• Development server to start</li>
              </ul>
              {devServerStatus !== 'unknown' && (
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleStartDevServer} 
                    disabled={isStartingDevServer}
                  >
                    {isStartingDevServer ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Try Starting Server
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Preview Controls */}
      <div className="p-3 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <span className="text-xs text-muted-foreground">
              {previewUrl}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Viewport Size Controls */}
            <div className="flex items-center gap-1 mr-2">
              {Object.entries(VIEWPORT_SIZES).map(([size, config]) => (
                <Button
                  key={size}
                  variant={viewport === size ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setViewport(size as ViewportSize)}
                  title={config.label}
                >
                  {getViewportIcon(size as ViewportSize)}
                </Button>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              title="Refresh preview"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenExternal}
              title="Open in new tab"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          </div>
        </div>
        
        {lastRefresh && (
          <div className="text-xs text-muted-foreground mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-hidden bg-muted/20 relative">
        {loadError ? (
          <div className="h-full flex items-center justify-center p-8">
            <Card className="p-6 text-center max-w-md border-destructive">
              <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
              <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-3 w-3 mr-2" />
                Try Again
              </Button>
            </Card>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <div
              className={cn(
                "bg-background border border-border shadow-lg transition-all duration-300",
                viewport === 'mobile' && "rounded-[2rem] p-2",
                viewport === 'tablet' && "rounded-lg",
                viewport === 'desktop' && "w-full h-full"
              )}
              style={{
                width: VIEWPORT_SIZES[viewport].width,
                height: VIEWPORT_SIZES[viewport].height,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              <div className="relative w-full h-full overflow-hidden rounded-inherit">
                {isLoading && (
                  <div className="absolute inset-0 z-10 bg-background/80 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading preview...
                    </div>
                  </div>
                )}
                
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="w-full h-full border-0 rounded-inherit"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  title="Application Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}