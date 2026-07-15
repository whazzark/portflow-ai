import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/features/layout/ui/authenticated-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      await ensureSessionUser(queryClient)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        throw redirect({ to: '/login' })
      }

      throw error
    }
  },
  pendingComponent: () => null,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center">
      <p role="alert">Something went wrong. Please try again.</p>
    </main>
  ),
  component: AuthenticatedLayout,
})
