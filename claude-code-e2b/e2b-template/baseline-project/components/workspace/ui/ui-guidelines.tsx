"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Palette, Monitor, Eye, Copy, Download } from "lucide-react"

export function UIGuidelines() {
  const [selectedComponent, setSelectedComponent] = useState('buttons')

  const colorPalette = [
    { name: 'Primary', color: '#3b82f6', usage: 'Main actions, links' },
    { name: 'Secondary', color: '#64748b', usage: 'Supporting elements' },
    { name: 'Success', color: '#10b981', usage: 'Confirmations, success states' },
    { name: 'Warning', color: '#f59e0b', usage: 'Warnings, cautions' },
    { name: 'Error', color: '#ef4444', usage: 'Errors, destructive actions' },
    { name: 'Background', color: '#f8fafc', usage: 'Page backgrounds' },
    { name: 'Surface', color: '#ffffff', usage: 'Card backgrounds, surfaces' },
    { name: 'Text Primary', color: '#1e293b', usage: 'Main content text' },
    { name: 'Text Secondary', color: '#64748b', usage: 'Secondary text, labels' }
  ]

  const typography = [
    { name: 'Display Large', class: 'text-6xl font-bold', usage: 'Hero headings' },
    { name: 'Display Medium', class: 'text-5xl font-bold', usage: 'Page titles' },
    { name: 'Heading 1', class: 'text-4xl font-bold', usage: 'Section headings' },
    { name: 'Heading 2', class: 'text-3xl font-semibold', usage: 'Subsection headings' },
    { name: 'Heading 3', class: 'text-2xl font-semibold', usage: 'Component titles' },
    { name: 'Body Large', class: 'text-lg', usage: 'Large body text' },
    { name: 'Body Regular', class: 'text-base', usage: 'Default body text' },
    { name: 'Body Small', class: 'text-sm', usage: 'Supporting text' },
    { name: 'Caption', class: 'text-xs text-gray-600', usage: 'Captions, labels' }
  ]

  const spacing = [
    { name: 'xs', value: '0.25rem', class: 'p-1' },
    { name: 'sm', value: '0.5rem', class: 'p-2' },
    { name: 'md', value: '1rem', class: 'p-4' },
    { name: 'lg', value: '1.5rem', class: 'p-6' },
    { name: 'xl', value: '2rem', class: 'p-8' },
    { name: '2xl', value: '3rem', class: 'p-12' }
  ]

  const components = {
    buttons: (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Button Components</h3>
        <div className="flex flex-wrap gap-4">
          <Button>Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="destructive">Destructive Button</Button>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Usage Guidelines:</h4>
          <ul className="text-sm space-y-1">
            <li>• Use primary buttons for main actions</li>
            <li>• Secondary buttons for supporting actions</li>
            <li>• Outline buttons for less prominent actions</li>
            <li>• Ghost buttons for subtle interactions</li>
          </ul>
        </div>
      </div>
    ),
    cards: (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Card Components</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This is a basic card with header and content.</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle>Highlighted Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card has a highlighted border.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    ),
    badges: (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Badge Components</h3>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">UI/UX Guidelines</h2>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Copy className="h-4 w-4 mr-2" />
            Copy CSS
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Guide
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="spacing">Spacing</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Color Palette</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {colorPalette.map((color, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div
                      className="w-12 h-12 rounded-lg border"
                      style={{ backgroundColor: color.color }}
                    />
                    <div>
                      <h4 className="font-semibold">{color.name}</h4>
                      <p className="text-sm text-gray-600">{color.color}</p>
                      <p className="text-xs text-gray-500">{color.usage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography Scale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {typography.map((type, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{type.name}</h4>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{type.class}</code>
                    </div>
                    <p className={type.class}>The quick brown fox jumps over the lazy dog</p>
                    <p className="text-xs text-gray-500 mt-1">{type.usage}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spacing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Spacing System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spacing.map((space, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{space.name}</span>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{space.value}</code>
                    </div>
                    <div className="bg-blue-100 rounded">
                      <div className={`bg-blue-500 rounded ${space.class}`}>
                        <div className="bg-blue-100 rounded h-4"></div>
                      </div>
                    </div>
                    <code className="text-xs text-gray-500 mt-1">{space.class}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Components</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {Object.keys(components).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSelectedComponent(key)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        selectedComponent === key ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="col-span-9">
              <CardContent className="p-6">
                {components[selectedComponent as keyof typeof components]}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>Responsive Breakpoints</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Mobile</h4>
              <p className="text-sm text-gray-600">0px - 767px</p>
              <code className="text-xs">sm:</code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Tablet</h4>
              <p className="text-sm text-gray-600">768px - 1023px</p>
              <code className="text-xs">md:</code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Desktop</h4>
              <p className="text-sm text-gray-600">1024px - 1279px</p>
              <code className="text-xs">lg:</code>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Large</h4>
              <p className="text-sm text-gray-600">1280px+</p>
              <code className="text-xs">xl:</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}