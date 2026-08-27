import { createFileRoute } from '@tanstack/react-router'

import { PasswordRenewalScreen } from '@/features/auth/ui/password-renewal-screen'

export const Route = createFileRoute('/_password-renewal/password-renewal')({
  component: PasswordRenewalScreen,
})
