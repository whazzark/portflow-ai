import { createFileRoute } from '@tanstack/react-router'

import { LoginScreen } from '@/features/auth/ui/login-screen'

export const Route = createFileRoute('/_guest/login')({
  component: LoginScreen,
})
