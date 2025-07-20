export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign in to your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Authentication placeholder page
          </p>
        </div>
        <div className="rounded-md bg-card p-6 shadow">
          <p className="text-center text-sm text-muted-foreground">
            This is a placeholder login page. 
            In a real application, you would implement authentication here.
          </p>
        </div>
      </div>
    </div>
  )
}