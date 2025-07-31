/**
 * Creates a Supabase service client with admin privileges
 * This client bypasses Row Level Security and should only be used in server-side code
 * Always uses the app_builder schema
 */
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: {
        schema: 'app_builder'
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}