import { createFileRoute } from '@tanstack/react-router'

import { ActivationScreen } from '@/features/auth/ui/activation-screen'

export const Route = createFileRoute('/_activation/activate/$token')({
  component: ActivatePage,
})

function ActivatePage() {
  const { token } = Route.useParams()

  return <ActivationScreen token={token} />
}
