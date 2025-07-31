'use client'

import React from 'react'
import { Loader2, Code, MessageSquare, FileText, Settings, Zap, Database, Globe, Cpu } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// Basic loading spinner component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  )
}

// Page-level loading component
interface PageLoadingProps {
  title?: string
  description?: string
  progress?: number
  steps?: string[]
  currentStep?: number
}

export function PageLoading({ 
  title = "Loading PRIA App Builder",
  description = "Setting up your development environment...",
  progress,
  steps,
  currentStep
}: PageLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {typeof progress === 'number' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {steps && steps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Steps:</h4>
              <div className="space-y-1">
                {steps.map((step, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center gap-2 text-sm p-2 rounded",
                      currentStep === index 
                        ? "bg-blue-50 text-blue-700 border border-blue-200" 
                        : currentStep !== undefined && index < currentStep
                        ? "text-green-600 bg-green-50"
                        : "text-muted-foreground"
                    )}
                  >
                    {currentStep !== undefined && index < currentStep ? (
                      <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0" />
                    ) : currentStep === index ? (
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    {step}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Chat loading state
export function ChatLoading() {
  return (
    <div className="flex gap-3 p-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-4 h-4 text-white animate-spin" />
      </div>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center gap-1 pt-1">
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Code view loading state
export function CodeViewLoading() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Code className="w-5 h-5 text-muted-foreground" />
        <Skeleton className="h-5 w-32" />
      </div>
      
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-4 w-8 flex-shrink-0" />
            <Skeleton className={cn("h-4", 
              i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-5/6"
            )} />
          </div>
        ))}
      </div>
    </div>
  )
}

// File tree loading state
export function FileTreeLoading() {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
          <Skeleton className="h-3 w-3 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

// Tab content loading
interface TabLoadingProps {
  type: 'code' | 'preview' | 'requirements' | 'specs'
}

export function TabLoading({ type }: TabLoadingProps) {
  const configs = {
    code: {
      icon: Code,
      title: "Loading Code View",
      description: "Fetching project files..."
    },
    preview: {
      icon: Globe,
      title: "Loading Preview",
      description: "Starting development server..."
    },
    requirements: {
      icon: FileText,
      title: "Loading Requirements",
      description: "Gathering project requirements..."
    },
    specs: {
      icon: Settings,
      title: "Loading Specifications",
      description: "Loading technical specifications..."
    }
  }

  const config = configs[type]
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-medium mb-2">{config.title}</h3>
      <p className="text-muted-foreground mb-4">{config.description}</p>
      <LoadingSpinner size="md" />
    </div>
  )
}

// E2B Sandbox loading states
interface SandboxLoadingProps {
  stage: 'initializing' | 'creating' | 'installing' | 'configuring' | 'ready'
  progress?: number
}

export function SandboxLoading({ stage, progress }: SandboxLoadingProps) {
  const stages = {
    initializing: { icon: Zap, text: "Initializing sandbox environment..." },
    creating: { icon: Cpu, text: "Creating development container..." },
    installing: { icon: Database, text: "Installing dependencies..." },
    configuring: { icon: Settings, text: "Configuring project structure..." },
    ready: { icon: Zap, text: "Environment ready!" }
  }

  const currentStage = stages[stage]
  const Icon = currentStage.icon

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader className="text-center pb-3">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
          <Icon className={cn("w-6 h-6 text-green-600", stage !== 'ready' && "animate-pulse")} />
        </div>
        <CardTitle className="text-lg">E2B Sandbox</CardTitle>
        <CardDescription>{currentStage.text}</CardDescription>
      </CardHeader>
      
      <CardContent>
        {typeof progress === 'number' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Inline loading for buttons and small components
interface InlineLoadingProps {
  text?: string
  size?: 'sm' | 'md'
  className?: string
}

export function InlineLoading({ text = "Loading...", size = 'sm', className }: InlineLoadingProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", size === 'sm' ? "w-3 h-3" : "w-4 h-4")} />
      <span className={cn("text-muted-foreground", size === 'sm' ? "text-xs" : "text-sm")}>
        {text}
      </span>
    </div>
  )
}

// Stream loading (for Claude responses)
export function StreamLoading() {
  return (
    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
      </div>
      <span>Claude is thinking...</span>
    </div>
  )
}

// Skeleton components for consistent loading states
export function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </CardContent>
    </Card>
  )
}

// Loading wrapper component for consistent loading states
interface LoadingWrapperProps {
  loading: boolean
  children: React.ReactNode
  loadingComponent?: React.ReactNode
  type?: 'spinner' | 'skeleton' | 'custom'
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function LoadingWrapper({ 
  loading, 
  children, 
  loadingComponent,
  type = 'spinner',
  size = 'md',
  text
}: LoadingWrapperProps) {
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

    if (type === 'skeleton') {
      return <CardSkeleton />
    }

    return <LoadingSpinner size={size} text={text} />
  }

  return <>{children}</>
}