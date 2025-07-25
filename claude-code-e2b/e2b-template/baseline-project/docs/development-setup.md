# PRIA Platform Development Setup Guide

Complete guide for setting up a local development environment for the Platform for Rapid Intelligent Applications (PRIA), including all dependencies, configuration, and development workflows.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [External Service Setup](#external-service-setup)
5. [Local Development](#local-development)
6. [Development Workflow](#development-workflow)
7. [Testing Setup](#testing-setup)
8. [Contributing Guidelines](#contributing-guidelines)
9. [IDE Configuration](#ide-configuration)
10. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20+ LTS | JavaScript runtime |
| **npm** | 10+ | Package manager |
| **Git** | Latest | Version control |
| **Docker** | Latest | E2B template development |
| **PostgreSQL** | 15+ | Local database (optional) |

### System Requirements

#### **Minimum Requirements**
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 20.04+
- **RAM**: 8GB
- **Storage**: 10GB free space
- **Network**: Stable internet connection

#### **Recommended Requirements**
- **RAM**: 16GB+
- **Storage**: 50GB+ SSD
- **CPU**: 8+ cores

### Installation Instructions

#### **Node.js & npm**
```bash
# Using Node Version Manager (recommended)
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

#### **Git**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install git

# macOS (using Homebrew)
brew install git

# Windows (using Chocolatey)
choco install git

# Verify installation
git --version
```

#### **Docker**
```bash
# Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS
brew install --cask docker

# Windows
# Download Docker Desktop from https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker-compose --version
```

## 🌍 Environment Setup

### Clone Repository

```bash
# Clone the PRIA platform repository
git clone https://github.com/your-org/pria-platform.git
cd pria-platform

# Create development branch
git checkout -b feature/your-feature-name
```

### Environment Configuration

#### **1. Create Environment Files**
```bash
# Copy example environment files
cp .env.example .env.local
cp .env.example .env.development
cp .env.example .env.test
```

#### **2. Basic Environment Variables**
Edit `.env.local` with your development configuration:

```bash
# === Application Configuration ===
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-development-key-here

# === Database Configuration ===
# Option 1: Use Supabase Cloud (Recommended for development)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Option 2: Local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/pria_development

# === AI Services ===
ANTHROPIC_API_KEY=sk-ant-your-claude-api-key-here
E2B_API_KEY=your-e2b-api-key-here
E2B_TEMPLATE_ID=node  # or your custom template

# === External Integrations ===
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret

VERCEL_TOKEN=your-vercel-api-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id

# === Development Tools ===
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# === Monitoring & Debugging ===
LOG_LEVEL=debug
ENABLE_ANALYTICS=false
MEMORY_WARNING_MB=200
MEMORY_CRITICAL_MB=400
```

#### **3. Install Dependencies**
```bash
# Install project dependencies
npm install

# Install global development tools
npm install -g tsx vercel supabase@">=1.8.1"

# Verify installations
tsx --version
vercel --version
supabase --version
```

## 🗄️ Database Configuration

### Option 1: Supabase Cloud (Recommended)

#### **1. Create Supabase Project**
```bash
# Login to Supabase CLI
supabase login

# Create new project
supabase projects create pria-development --org-id YOUR_ORG_ID

# Link local project
supabase link --project-ref YOUR_PROJECT_REF
```

#### **2. Set Up Database Schema**
```bash
# Initialize Supabase locally
supabase init

# Apply database migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > lib/supabase/database.types.ts
```

#### **3. Configure Row-Level Security**
```sql
-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create development-friendly policies
CREATE POLICY "dev_access" ON workspaces FOR ALL USING (true);
CREATE POLICY "dev_access" ON applications FOR ALL USING (true);
CREATE POLICY "dev_access" ON sessions FOR ALL USING (true);
```

### Option 2: Local PostgreSQL

#### **1. Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql@15
brew services start postgresql@15

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### **2. Create Development Database**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE pria_development;
CREATE USER pria_user WITH PASSWORD 'pria_password';
GRANT ALL PRIVILEGES ON DATABASE pria_development TO pria_user;

# Enable required extensions
\c pria_development
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\q
```

#### **3. Run Migrations**
```bash
# Apply database schema
psql -d pria_development -f lib/supabase/database.sql

# Verify tables created
psql -d pria_development -c "\dt"
```

### Option 3: Docker PostgreSQL

#### **1. Docker Compose Setup**
Create `docker-compose.dev.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pria_development
      POSTGRES_USER: pria_user
      POSTGRES_PASSWORD: pria_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./lib/supabase/database.sql:/docker-entrypoint-initdb.d/01-schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pria_user -d pria_development"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### **2. Start Services**
```bash
# Start database services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

## 🔑 External Service Setup

### AI Services Configuration

#### **1. Claude API (Anthropic)**
```bash
# Sign up at https://console.anthropic.com
# Generate API key
# Add to .env.local:
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Test API connection
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "claude-3-sonnet-20240229", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}' \
     https://api.anthropic.com/v1/messages
```

#### **2. E2B Sandboxes**
```bash
# Sign up at https://e2b.dev
# Get API key from dashboard
# Add to .env.local:
E2B_API_KEY=your-e2b-api-key
E2B_TEMPLATE_ID=node

# Test E2B connection
curl -H "Authorization: Bearer $E2B_API_KEY" \
     https://api.e2b.dev/sandboxes
```

### GitHub Integration Setup

#### **1. Create GitHub OAuth App**
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in application details:
   - **Application name**: `PRIA Development`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/callback/github`

#### **2. Configure Webhooks (Optional)**
```bash
# Install ngrok for webhook testing
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use ngrok URL for webhook endpoint:
# https://abcd1234.ngrok.io/api/github/webhook
```

### Vercel Integration Setup

#### **1. Vercel CLI Setup**
```bash
# Login to Vercel
vercel login

# Link project (optional for development)
vercel link

# Get project information
vercel project ls
```

## 🚀 Local Development

### Development Server

#### **1. Start Development Environment**
```bash
# Start database services (if using Docker)
docker-compose -f docker-compose.dev.yml up -d

# Start Next.js development server
npm run dev

# Alternative: Start with debugging
npm run dev:debug
```

#### **2. Verify Setup**
```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Expected response:
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "services": [...]
  }
}
```

#### **3. Access Development Environment**
- **Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **API Documentation**: http://localhost:3000/api-docs (if configured)

### Development Scripts

```bash
# Development server
npm run dev                    # Start development server
npm run dev:debug             # Start with debugging enabled
npm run dev:https             # Start with HTTPS (requires cert setup)

# Code quality
npm run lint                  # Run ESLint
npm run lint:fix              # Fix linting errors
npm run type-check            # TypeScript type checking
npm run format                # Format code with Prettier

# Testing
npm run test                  # Run unit tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage
npm run test:e2e              # Run end-to-end tests

# Build and preview
npm run build                 # Production build
npm run start                 # Start production server
npm run analyze               # Bundle analysis

# Database
npm run db:generate           # Generate database types
npm run db:migrate            # Apply database migrations
npm run db:reset              # Reset database to initial state
npm run db:seed               # Seed database with test data

# Load testing
npm run load-test:smoke       # Quick smoke tests
npm run load-test:production  # Production readiness tests
npm run production-readiness  # Complete production validation
```

### Hot Reloading

The development server supports hot reloading for:
- **React components**: Instant updates without losing state
- **API routes**: Automatic restart on changes
- **CSS/Styles**: Live updates
- **Environment variables**: Restart required

### Development Database

#### **Seed Development Data**
```bash
# Create seed script
cat > scripts/seed-dev-data.ts << 'EOF'
import { createClient } from '@/lib/supabase/client'

async function seedData() {
  const supabase = createClient()
  
  // Create development workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({
      name: 'Development Workspace',
      slug: 'dev-workspace'
    })
    .select()
    .single()
  
  // Create sample application
  await supabase
    .from('applications')
    .insert({
      workspace_id: workspace.id,
      name: 'Sample Todo App',
      description: 'A sample todo application for development',
      type: 'web_app',
      framework: 'nextjs'
    })
  
  console.log('Development data seeded successfully!')
}

seedData().catch(console.error)
EOF

# Run seed script
tsx scripts/seed-dev-data.ts
```

## 🔄 Development Workflow

### Branch Management

#### **Git Flow**
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Work on feature
git add .
git commit -m "feat: add new feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
# Use GitHub CLI (optional)
gh pr create --title "Add new feature" --body "Description of changes"
```

#### **Commit Message Convention**
Follow conventional commits format:
```
type(scope): description

feat(auth): add GitHub OAuth integration
fix(api): resolve rate limiting issue
docs(readme): update setup instructions
test(units): add tests for user service
chore(deps): update dependencies
```

### Code Quality Workflow

#### **Pre-commit Hooks**
```bash
# Install husky
npm install --save-dev husky lint-staged

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# Configure lint-staged in package.json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

#### **Code Review Checklist**
- [ ] Code follows TypeScript best practices
- [ ] All functions have proper type annotations
- [ ] Error handling is implemented
- [ ] Tests are included for new features
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] Environment variables are properly configured
- [ ] Security best practices are followed

### Feature Development Process

#### **1. Planning Phase**
```bash
# Create feature branch
git checkout -b feature/user-authentication

# Document requirements
echo "## User Authentication Feature
- JWT-based authentication
- Login/logout functionality  
- Protected route middleware
- User session management" > docs/features/authentication.md
```

#### **2. Development Phase**
```bash
# Start development server
npm run dev

# Work in parallel:
# Terminal 1: Development server
npm run dev

# Terminal 2: Test runner
npm run test:watch

# Terminal 3: Type checking
npm run type-check --watch
```

#### **3. Testing Phase**
```bash
# Run all tests
npm run test

# Run specific test file
npm run test auth.test.ts

# Run tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

#### **4. Integration Phase**
```bash
# Ensure code quality
npm run lint
npm run type-check
npm run test

# Build verification
npm run build

# Load testing (for API changes)
npm run load-test:smoke
```

## 🧪 Testing Setup

### Testing Framework Configuration

#### **Unit Testing (Vitest)**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

#### **Test Setup File**
```typescript
// tests/setup.ts
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with testing-library matchers
expect.extend(matchers)

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  },
}))

// Cleanup after each test
afterEach(() => {
  cleanup()
})
```

#### **Example Test Files**
```typescript
// tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginForm } from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const mockSubmit = vi.fn()
    render(<LoginForm onSubmit={mockSubmit} />)
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    })
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    
    expect(mockSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    })
  })
})
```

### End-to-End Testing (Playwright)

#### **Playwright Configuration**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

#### **Example E2E Test**
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can login and logout', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')
    
    // Fill login form
    await page.fill('[data-testid=email]', 'test@example.com')
    await page.fill('[data-testid=password]', 'password123')
    await page.click('[data-testid=submit]')
    
    // Verify successful login
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid=user-menu]')).toBeVisible()
    
    // Logout
    await page.click('[data-testid=user-menu]')
    await page.click('[data-testid=logout]')
    
    // Verify logout
    await expect(page).toHaveURL('/login')
  })
})
```

### Load Testing

#### **Development Load Testing**
```bash
# Run smoke tests during development
npm run load-test:smoke

# Test specific endpoints
npm run load-test -- --categories="authentication,applications"

# Test with custom configuration
LOAD_TEST_BASE_URL=http://localhost:3000 \
LOAD_TEST_AUTH_TOKEN=your-dev-token \
npm run load-test:production
```

## 📝 Contributing Guidelines

### Code Standards

#### **TypeScript Guidelines**
```typescript
// ✅ Good: Strong typing
interface User {
  id: string
  email: string
  name: string
  workspace_id: string
}

async function getUser(id: string): Promise<User | null> {
  // Implementation
}

// ❌ Bad: Any types
function getUser(id: any): Promise<any> {
  // Implementation
}
```

#### **React Component Guidelines**
```typescript
// ✅ Good: Proper component structure
interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary',
  disabled = false 
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      data-testid="button"
    >
      {children}
    </button>
  )
}
```

#### **API Route Guidelines**
```typescript
// ✅ Good: Proper error handling and validation
import { z } from 'zod'

const CreateApplicationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['web_app', 'api', 'mobile'])
})

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validation
    const body = await request.json()
    const validatedData = CreateApplicationSchema.parse(body)

    // Business logic
    const application = await createApplication(auth.user.workspace_id, validatedData)

    return NextResponse.json({ 
      success: true, 
      data: application 
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('API Error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}
```

### Documentation Standards

#### **Code Documentation**
```typescript
/**
 * Creates a new application within a workspace
 * @param workspaceId - The workspace identifier
 * @param data - Application creation data
 * @returns Promise resolving to the created application
 * @throws {ValidationError} When application data is invalid
 * @throws {ConflictError} When application name already exists
 * @example
 * ```typescript
 * const app = await createApplication('workspace-123', {
 *   name: 'My App',
 *   type: 'web_app'
 * })
 * ```
 */
export async function createApplication(
  workspaceId: string,
  data: CreateApplicationData
): Promise<Application> {
  // Implementation
}
```

#### **README Updates**
When adding new features, update relevant documentation:
- Feature description in main README
- API documentation for new endpoints
- Environment variable documentation
- Setup instructions if needed

### Pull Request Process

#### **1. Pre-submission Checklist**
- [ ] Code follows project standards
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Breaking changes are documented
- [ ] Environment variables are documented

#### **2. Pull Request Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

## 🔧 IDE Configuration

### Visual Studio Code Setup

#### **Recommended Extensions**
```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

#### **VS Code Settings**
```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true,
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

#### **Debug Configuration**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "console": "integratedTerminal",
      "env": {
        "NODE_OPTIONS": "--inspect"
      }
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Development Tasks

#### **VS Code Tasks**
```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "shell",
      "command": "npm",
      "args": ["run", "dev"],
      "group": "build",
      "isBackground": true,
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "test",
      "type": "shell",
      "command": "npm",
      "args": ["run", "test"],
      "group": "test"
    },
    {
      "label": "build",
      "type": "shell",
      "command": "npm",
      "args": ["run", "build"],
      "group": "build"
    }
  ]
}
```

## 🔍 Troubleshooting

### Common Development Issues

#### **Port Already in Use**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or use different port
npm run dev -- -p 3001
```

#### **Module Not Found Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Next.js cache
rm -rf .next

# Restart development server
npm run dev
```

#### **TypeScript Errors**
```bash
# Regenerate TypeScript types
npm run db:generate

# Check TypeScript configuration
npm run type-check

# Update type definitions
npm update @types/node @types/react @types/react-dom
```

#### **Database Connection Issues**
```bash
# Check database status
docker-compose -f docker-compose.dev.yml ps

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres

# Check connection
psql $DATABASE_URL -c "SELECT version();"
```

#### **Environment Variable Issues**
```bash
# Verify environment variables are loaded
node -e "console.log(process.env.NODE_ENV)"

# Check Next.js environment loading
echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"

# Restart development server after env changes
npm run dev
```

### Performance Optimization

#### **Development Server Performance**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev

# Use faster builds
export NEXT_TELEMETRY_DISABLED=1
npm run dev

# Enable SWC (already enabled in Next.js 12+)
# Automatic in newer versions
```

#### **Build Performance**
```javascript
// next.config.js optimizations
const nextConfig = {
  experimental: {
    // Faster builds
    swcMinify: true,
    // Reduce bundle size
    outputFileTracingOptimizations: true,
  },
  // Webpack optimizations
  webpack: (config, { dev }) => {
    if (dev) {
      // Development optimizations
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}
```

---

## 🎉 Success!

You now have a complete PRIA development environment! Here's what you can do next:

1. **Start Developing**: Create your first feature branch and start coding
2. **Explore Examples**: Check the `examples/` directory for sample implementations
3. **Join Community**: Connect with other developers on Discord
4. **Contribute**: Help improve PRIA by submitting bug reports and feature requests

For additional help, see the [Troubleshooting Guide](./troubleshooting.md) or reach out on our [Discord server](https://discord.gg/pria).

**Happy coding! 🚀**