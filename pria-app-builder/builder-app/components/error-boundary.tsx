'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean
  level?: 'page' | 'section' | 'component'
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: ErrorBoundary.generateErrorId()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler
    this.props.onError?.(error, errorInfo)

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Report to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys?.some((key, idx) => prevProps.resetKeys?.[idx] !== key)) {
        this.resetErrorBoundary()
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary()
    }
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateErrorId(): string {
    return ErrorBoundary.generateErrorId()
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      copied: false
    })
  }

  private handleRetry = () => {
    this.resetErrorBoundary()
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private copyErrorDetails = async () => {
    const { error, errorInfo, errorId } = this.state
    
    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      errorInfo: {
        componentStack: errorInfo?.componentStack
      },
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      this.setState({ copied: true })
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        this.setState({ copied: false })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // In a real application, you would send this to your error tracking service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    const errorReport = {
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component'
    }

    // Example: Send to your error tracking service
    // errorTrackingService.captureException(errorReport)
    
    console.log('Error report generated:', errorReport)
  }

  render() {
    const { hasError, error, errorId, copied } = this.state
    const { children, fallback, level = 'component', showDetails = true, isolate = false } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Different UI based on error level
      if (level === 'page') {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <Card className="w-full max-w-2xl">
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <CardTitle className="text-2xl">Something went wrong</CardTitle>
                <CardDescription>
                  The application encountered an unexpected error. We've been notified and are working to fix it.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <Alert>
                  <Bug className="h-4 w-4" />
                  <AlertTitle>Error ID: {errorId}</AlertTitle>
                  <AlertDescription>
                    Please reference this ID when contacting support.
                  </AlertDescription>
                </Alert>

                {showDetails && error && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 rounded-md">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                        {error.message}
                      </pre>
                    </div>
                  </details>
                )}
              </CardContent>

              <CardFooter className="flex gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="default">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
                {showDetails && (
                  <Button onClick={this.copyErrorDetails} variant="ghost" size="sm">
                    {copied ? (
                      <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? 'Copied!' : 'Copy Details'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        )
      }

      if (level === 'section') {
        return (
          <Card className={cn("w-full", isolate && "border-red-200 bg-red-50")}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <CardTitle className="text-lg">Section Error</CardTitle>
              </div>
              <CardDescription>
                This section encountered an error and couldn't load properly.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Alert variant="destructive">
                <AlertTitle>Error ID: {errorId}</AlertTitle>
                <AlertDescription className="mt-1">
                  {error?.message || 'An unexpected error occurred'}
                </AlertDescription>
              </Alert>
            </CardContent>

            <CardFooter className="flex gap-2">
              <Button onClick={this.handleRetry} size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
              {showDetails && (
                <Button onClick={this.copyErrorDetails} variant="ghost" size="sm">
                  {copied ? (
                    <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied ? 'Copied' : 'Copy Error'}
                </Button>
              )}
            </CardFooter>
          </Card>
        )
      }

      // Component level error (minimal UI)
      return (
        <Alert variant="destructive" className={cn("my-2", isolate && "border-red-300")}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            Component Error
            <Button 
              onClick={this.handleRetry} 
              variant="ghost" 
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </AlertTitle>
          <AlertDescription>
            {error?.message || 'Failed to render component'} (ID: {errorId})
          </AlertDescription>
        </Alert>
      )
    }

    return children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for manually triggering error boundary
export function useErrorBoundary() {
  return (error: Error) => {
    throw error
  }
}