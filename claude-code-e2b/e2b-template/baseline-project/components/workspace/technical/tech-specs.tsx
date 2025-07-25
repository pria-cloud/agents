"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Download, Copy, Code, Database, Zap, Globe } from "lucide-react"

interface TechSpec {
  id: string
  category: string
  title: string
  description: string
  implementation: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'in-progress' | 'completed'
}

export function TechSpecs() {
  const [specs, setSpecs] = useState<TechSpec[]>([
    {
      id: '1',
      category: 'Frontend',
      title: 'React Component Architecture',
      description: 'Implement modular React components using TypeScript and modern hooks',
      implementation: `// Component structure
interface ProductCardProps {
  product: Product
  onAddToCart: (id: string) => void
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <Card>
      <CardContent>
        <h3>{product.name}</h3>
        <p>{product.price}</p>
        <Button onClick={() => onAddToCart(product.id)}>
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  )
}`,
      priority: 'high',
      status: 'completed'
    },
    {
      id: '2',
      category: 'Backend',
      title: 'API Endpoint Structure',
      description: 'RESTful API endpoints with proper error handling and validation',
      implementation: `// API Route: /api/products
export async function GET(request: Request) {
  try {
    const products = await db.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    })
    
    return Response.json({ 
      success: true, 
      data: products 
    })
  } catch (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch products' }, 
      { status: 500 }
    )
  }
}`,
      priority: 'high',
      status: 'in-progress'
    },
    {
      id: '3',
      category: 'Database',
      title: 'Data Schema Design',
      description: 'PostgreSQL schema with proper relationships and constraints',
      implementation: `-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  inventory_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders table with foreign key relationships
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);`,
      priority: 'high',
      status: 'pending'
    }
  ])

  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedSpec, setSelectedSpec] = useState<string>('1')

  const handleGenerateSpecs = async () => {
    setIsGenerating(true)
    // Simulate AI generation
    setTimeout(() => {
      setIsGenerating(false)
    }, 3000)
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
  }

  const techStack = [
    { category: 'Frontend', technologies: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS'] },
    { category: 'Backend', technologies: ['Next.js API Routes', 'Prisma ORM', 'Zod Validation'] },
    { category: 'Database', technologies: ['PostgreSQL', 'Supabase', 'Redis Cache'] },
    { category: 'Authentication', technologies: ['NextAuth.js', 'JWT Tokens', 'OAuth Providers'] },
    { category: 'Deployment', technologies: ['Vercel', 'Docker', 'GitHub Actions'] },
    { category: 'Monitoring', technologies: ['Sentry', 'Vercel Analytics', 'PostHog'] }
  ]

  const architecture = {
    layers: [
      { name: 'Presentation Layer', description: 'React components, pages, and UI logic' },
      { name: 'Business Logic Layer', description: 'Custom hooks, utilities, and business rules' },
      { name: 'Data Access Layer', description: 'API routes, database queries, and external services' },
      { name: 'Database Layer', description: 'PostgreSQL with Prisma ORM for data persistence' }
    ],
    patterns: [
      { name: 'Server Components', description: 'Leverage React Server Components for performance' },
      { name: 'API Route Handlers', description: 'RESTful endpoints with proper error handling' },
      { name: 'Middleware', description: 'Authentication and request processing' },
      { name: 'Custom Hooks', description: 'Reusable stateful logic across components' }
    ]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Technical Specifications</h2>
        <div className="flex space-x-2">
          <Button onClick={handleGenerateSpecs} disabled={isGenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Auto-Generate'}
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="specifications" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="tech-stack">Tech Stack</TabsTrigger>
          <TabsTrigger value="implementation">Implementation</TabsTrigger>
        </TabsList>

        <TabsContent value="specifications" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Specifications</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {specs.map((spec) => (
                    <button
                      key={spec.id}
                      onClick={() => setSelectedSpec(spec.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 border-b ${
                        selectedSpec === spec.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{spec.title}</span>
                        <Badge variant={
                          spec.status === 'completed' ? 'default' :
                          spec.status === 'in-progress' ? 'secondary' : 'outline'
                        } className="text-xs">
                          {spec.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{spec.category}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-8">
              {specs.find(s => s.id === selectedSpec) && (
                <div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{specs.find(s => s.id === selectedSpec)?.title}</CardTitle>
                      <div className="flex space-x-2">
                        <Badge>{specs.find(s => s.id === selectedSpec)?.category}</Badge>
                        <Badge variant={
                          specs.find(s => s.id === selectedSpec)?.priority === 'high' ? 'destructive' :
                          specs.find(s => s.id === selectedSpec)?.priority === 'medium' ? 'default' : 'secondary'
                        }>
                          {specs.find(s => s.id === selectedSpec)?.priority}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">
                      {specs.find(s => s.id === selectedSpec)?.description}
                    </p>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">Implementation</h4>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCopyCode(specs.find(s => s.id === selectedSpec)?.implementation || '')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <pre className="text-sm overflow-x-auto">
                        <code>{specs.find(s => s.id === selectedSpec)?.implementation}</code>
                      </pre>
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="architecture" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>System Architecture</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {architecture.layers.map((layer, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{layer.name}</h4>
                      <p className="text-sm text-gray-600">{layer.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Design Patterns</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {architecture.patterns.map((pattern, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{pattern.name}</h4>
                      <p className="text-sm text-gray-600">{pattern.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tech-stack" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {techStack.map((stack, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {stack.category === 'Database' && <Database className="h-5 w-5" />}
                    {stack.category === 'Frontend' && <Globe className="h-5 w-5" />}
                    {stack.category === 'Backend' && <Code className="h-5 w-5" />}
                    {!['Database', 'Frontend', 'Backend'].includes(stack.category) && <Zap className="h-5 w-5" />}
                    <span>{stack.category}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stack.technologies.map((tech, techIndex) => (
                      <Badge key={techIndex} variant="outline" className="mr-2 mb-2">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="implementation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Phase 1: Foundation (Week 1-2)</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Set up Next.js 15 with TypeScript and Tailwind CSS</li>
                    <li>Configure Supabase database and authentication</li>
                    <li>Implement basic routing and layout structure</li>
                    <li>Set up development environment and tooling</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Phase 2: Core Features (Week 3-4)</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>User authentication and profile management</li>
                    <li>Product catalog with search and filtering</li>
                    <li>Shopping cart functionality</li>
                    <li>Order processing system</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Phase 3: Advanced Features (Week 5-6)</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Payment integration (Stripe)</li>
                    <li>Email notifications and confirmations</li>
                    <li>Admin dashboard for inventory management</li>
                    <li>Analytics and reporting features</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Phase 4: Optimization (Week 7-8)</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Performance optimization and caching</li>
                    <li>SEO optimization and metadata</li>
                    <li>Testing and quality assurance</li>
                    <li>Deployment and monitoring setup</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}