import { LoginForm } from '@/features/auth/ui/login-form'
import { Brand } from '@/features/brand/ui/brand'

export function LoginScreen() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-7">
        <Brand
          className="font-mono text-primary text-xs uppercase tracking-[0.16em]"
        />
        <h1 className="mt-7 font-semibold text-3xl leading-tight tracking-tight">
          Keep every handoff on track
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-7">
          Sign in to coordinate your port calls in real time.
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
