# Baseline Project - E2B Sandbox Template

This is a baseline Next.js 15 project template designed for E2B sandbox environments. It includes everything needed to create modern web applications with live preview capabilities.

## Stack

- **Next.js 15** - React framework with App Router
- **React 19** - Latest React version
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI components
- **Supabase** - Backend-as-a-Service
- **Jest** - JavaScript testing framework
- **Lucide React** - Beautiful icons

## Features

- 🚀 **Hot reloading** for instant development feedback
- 🎨 **All shadcn/ui components** automatically installed
- 📱 **Responsive design** with Tailwind CSS
- 🔒 **Supabase integration** for authentication and database
- 🧪 **Jest testing** setup with React Testing Library
- 📦 **Optimized build** for production deployment

## E2B Sandbox Usage

This project is designed to be used as an E2B sandbox template. When deployed:

1. **Dependencies** are automatically installed
2. **shadcn/ui components** are added via `npx shadcn@latest add --all`
3. **Development server** starts on port 3000
4. **Live preview** available at `https://[sandbox-id].e2b.dev`

## Local Development

```bash
# Install dependencies
npm install

# Install all shadcn/ui components
npm run ui:add-all

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
baseline-project/
├── app/                 # Next.js app router
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   └── ui/            # shadcn/ui components (auto-generated)
├── lib/               # Utility functions
│   ├── supabase.ts    # Supabase client
│   └── utils.ts       # Utility functions
├── public/            # Static assets
├── components.json    # shadcn/ui configuration
├── tailwind.config.ts # Tailwind CSS configuration
└── e2b.Dockerfile     # E2B sandbox configuration
```

## Environment Variables

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Development Configuration
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
```

## shadcn/ui Components

All shadcn/ui components are automatically installed when the sandbox starts. You can also manually add specific components:

```bash
# Add a specific component
npm run ui:add button

# Add all components
npm run ui:add-all
```

## Supabase Integration

The project includes comprehensive Supabase integration with SSR support:

### Client Setup
- **Browser client**: `@/lib/supabase/client` - SSR-optimized for client-side usage
- **Server client**: `@/lib/supabase/server` - SSR-optimized for server components/actions  
- **Middleware**: `@/lib/supabase/middleware` - Session management and auth routing
- **Legacy client**: `@/lib/supabase` - Simple client for backwards compatibility

### Authentication
- **Middleware protection**: Automatic redirects to `/auth/login` for unauthenticated users
- **Session management**: Automatic session refresh and cookie handling
- **Environment checks**: Graceful fallback when Supabase env vars are missing

### Local Development
- **Supabase CLI**: Pre-configured with `supabase/config.toml`
- **Local database**: PostgreSQL with port 54322
- **Local API**: REST API on port 54321
- **Local Studio**: Management interface on port 54323

### Usage Examples

```typescript
// Client-side usage
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data, error } = await supabase.from('users').select('*')

// Server-side usage
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

## Testing

Jest is configured with React Testing Library:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## License

MIT License - See LICENSE file for details