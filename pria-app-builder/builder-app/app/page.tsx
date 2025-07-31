'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // User is authenticated, redirect to dashboard
          router.push('/dashboard')
        } else {
          // User is not authenticated, redirect to login
          router.push('/login')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // On error, redirect to login
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            PRIA App Builder
          </h1>
          <p className="text-muted-foreground">
            Checking authentication...
          </p>
        </div>
      </div>
    )
  }

  // This will only show briefly before redirect
  return null
}