export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex">
        <div className="flex flex-col items-center space-y-6">
          <h1 className="text-4xl font-bold text-center">
            Welcome to E2B Sandbox
          </h1>
          <p className="text-xl text-muted-foreground text-center">
            Next.js 15 + Supabase + Tailwind 4 + shadcn/ui
          </p>
          <div className="flex space-x-4">
            <div className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Ready for Development
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}