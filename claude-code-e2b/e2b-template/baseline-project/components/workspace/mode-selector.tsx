"use client"

import { Button } from "@/components/ui/button"
import { Users, Code } from "lucide-react"

interface ModeSelectorProps {
  mode: 'business' | 'developer'
  onModeChange: (mode: 'business' | 'developer') => void
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex space-x-2">
      <Button
        variant={mode === 'business' ? 'default' : 'outline'}
        onClick={() => onModeChange('business')}
        className="flex items-center space-x-2"
      >
        <Users className="h-4 w-4" />
        <span>Business</span>
      </Button>
      <Button
        variant={mode === 'developer' ? 'default' : 'outline'}
        onClick={() => onModeChange('developer')}
        className="flex items-center space-x-2"
      >
        <Code className="h-4 w-4" />
        <span>Developer</span>
      </Button>
    </div>
  )
}