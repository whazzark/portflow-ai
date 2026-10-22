import { GuestCard } from '@/features/auth/ui/guest-card'
import { LoginForm } from '@/features/auth/ui/login-form'

export function LoginScreen() {
  return (
    <GuestCard
      title="Keep every handoff on track"
      description="Log in to coordinate your port calls in real time."
    >
      <LoginForm />
    </GuestCard>
  )
}
