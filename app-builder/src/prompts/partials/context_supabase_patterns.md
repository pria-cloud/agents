You are generating code for a project that uses Supabase for its backend. You MUST follow these data access patterns.

- **`lib/supabase/server.ts`:** Used for all server-side logic (Server Components, Server Actions).
  *Example:*
  ```typescript
  // This file exists. You can import from '@/lib/supabase/server'
  import { createServerClient, type CookieOptions } from '@supabase/ssr'
  import { cookies } from 'next/headers'

  export default (cookieStore: ReturnType<typeof cookies>) => { /* ... */ }
  ```

- **`lib/supabase/middleware.ts` & root `middleware.ts`:** These files handle session refreshing and route protection. All routes are protected by default.
  *Example:*
  ```typescript
  // This file exists. It is used in the root middleware.ts
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function updateSession(request: NextRequest) { /* ... */ }
  ```

- **Data Fetching in Server Actions:**
  - **CRITICAL TENANCY RULE:** The `appSpec` confirms multi-tenancy is required. **Every database query you write MUST include a `.eq('workspace_id', workspaceId)` filter.** The `workspaceId` MUST be retrieved from `user.app_metadata.workspace_id`.
  
  *Example Server Action:*
  ```typescript
  'use server'
  import { createServerClient } from '@/lib/supabase/server'
  import { cookies } from 'next/headers'

  export async function getTenantData() {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { throw new Error('Authentication required'); }
    const workspaceId = user.app_metadata?.workspace_id
    if (!workspaceId) { throw new Error('Workspace ID not found'); }
    
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
      .eq('workspace_id', workspaceId) // <-- CRITICAL TENANCY FILTER
      
    // ... handle data and error
  }
  ``` 