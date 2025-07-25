export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-center">
          Welcome to Your AI-Generated App
        </h1>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">🤖 Built with Claude Code</h2>
          <p className="text-lg mb-4">
            This is your clean baseline application that Claude Code will transform based on your requirements.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Next.js 15 with App Router</li>
            <li>React 19</li>
            <li>TypeScript</li>
            <li>Tailwind CSS</li>
            <li>Ready for AI-powered development</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">🔧 Development</h3>
            <p className="text-gray-600">
              Chat with Claude Code in the development interface to build your application.
            </p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">🚀 Preview</h3>
            <p className="text-gray-600">
              This preview will update in real-time as Claude Code modifies your app.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Running on port 4000 • Built with E2B sandbox technology
          </p>
        </div>
      </div>
    </main>
  )
}