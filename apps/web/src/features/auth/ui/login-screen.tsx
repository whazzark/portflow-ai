import { LoginForm } from '@/features/auth/ui/login-form'

export function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div>
        <h1 className="font-semibold text-2xl">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  )
}
