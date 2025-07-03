# CONTEXT: Supabase Integration & Data Access Patterns
You MUST follow these patterns for all Supabase authentication and data access. The goal is to enforce strict tenant isolation using `workspace_id` from the # CONTEXT: Supabase Integration & Data Access Patterns
You MUST follow these patterns for all Supabase authentication and data access. The goal is to enforce strict tenant isolation using `workspace_id` from the user's JWT, as defined in the PRIA specifications.

- **`lib/supabase/client.ts` (For Client Components):**
  This file should export a `createClient` function that initializes a singleton Supabase client for use in browser environments.
  *Example `lib/supabase/client.ts`:*
  ```typescript
  import { createBrowserClient } from '@supabase/ssr'

  export function createClient() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  ```

- **`lib/supabase/server.ts` (For Server Components, Server Actions, Route Handlers):**
  This file should export a `createServerClient` function that initializes a Supabase client for server-side operations, reading cookies to maintain the user's session.
  **CRITICAL RULE:** Any time this `createServerClient` function is called anywhere in the application (e.g., in Server Actions or Server Components), it **MUST** be passed the `cookies` object from `next/headers`.

  *Correct Usage Example (in a Server Action):*
  ```typescript
  'use server'
  import { cookies } from 'next/headers'
  import createServerClient from '@/lib/supabase/server'

  export async function someAction() {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    // ... rest of the logic
  }
  ```

  *Example `lib/supabase/server.ts`:*
  ```typescript
  import { createServerClient, type CookieOptions } from '@supabase/ssr'
  import { cookies } from 'next/headers'

  export default (cookieStore: ReturnType<typeof cookies>) => {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
  }
  ```

- **`lib/supabase/middleware.ts` (For the `updateSession` helper):**
  This file must be created. It should export a reusable `updateSession` function that refreshes the user's session cookie.
  *Example `lib/supabase/middleware.ts`:*
  ```typescript
  import { createServerClient, type CookieOptions } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.getUser()

    return response
  }
  ```

- **`middleware.ts` (For Root Directory):**
  This file should import `updateSession` from `./lib/supabase/middleware.ts` and use it to handle session refreshing and route protection.
  *Example `middleware.ts`:*
  ```typescript
  import { updateSession } from '@/lib/supabase/middleware'
  import createServerClient from '@/lib/supabase/server'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function middleware(request: NextRequest) {
    // Refresh session cookies
    const response = await updateSession(request)

    // Create a server client within middleware to check user
    const supabase = createServerClient(request.cookies)
    const { data: { user } } = await supabase.auth.getUser()

    // if user is signed in and the current path is /login, redirect the user to /dashboard
    if (user && request.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // if user is not signed in and the current path is not /login, redirect the user to /login
    const protectedRoutes = ['/dashboard'] // Add any route that needs protection
    const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    if (!user && isProtectedRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return response
  }

  export const config = {
    matcher: [
      /*
       * Match all request paths except for the ones starting with:
       * - _next/static (static files)
       * - _next/image (image optimization files)
       * - favicon.ico (favicon file)
       */
      '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
  }
  ```

- **Data Fetching in Server Actions:**
  All database operations (read, write, delete) MUST be performed within Server Actions to ensure security and tenant isolation.
  1.  Create the server-side Supabase client.
  2.  Get the current user via `supabase.auth.getUser()`.
  3.  **CRITICALLY, you MUST get the `workspace_id` from the user's metadata: `user.app_metadata.workspace_id`.** This is non-negotiable.
  4.  Every database query MUST then be filtered with this ID: `.eq('workspace_id', workspaceId)`.

  *Correct Server Action Example:*
  ```typescript
  'use server'
  import { cookies } from 'next/headers'
  import createServerClient from '@/lib/supabase/server'
  import { revalidatePath } from 'next/cache'

  export async function getTenantData() {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Authentication required' }
    }

    // The workspace_id MUST be retrieved from the user's JWT metadata
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) {
      return { error: 'Workspace ID not found for user' }
    }

    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('workspace_id', workspaceId) // <-- CRITICAL TENANCY FILTER

    if (error) {
      console.error('Database Error:', error)
      return { error: 'Failed to fetch data.' }
    }
    return { data }
  }
  ```
- **User Registration and Public Data:**
  When a user signs up via `supabase.auth.signUp`, it only creates a record in the private `auth.users` table. If you have a public `users` or `profiles` table to store public user data, you **MUST** explicitly insert a new row into that table after the `signUp` call succeeds. Use the `id` from the `signUp` response to link the two records.

  *Correct User Registration Example:*
  ```typescript
  // In a Server Action
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Handle error
  }

  // If signUp is successful, insert into the public table
  if (data.user) {
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: data.user.id, email: data.user.email, role: 'user' });
    
    if (insertError) {
      // Handle insert error
    }
  }
  ```