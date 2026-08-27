import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient } }) => {
    let sessionUser: Awaited<ReturnType<typeof ensureSessionUser>>

    try {
      sessionUser = await ensureSessionUser(queryClient)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        throw redirect({ to: '/login' })
      }

      throw error
    }

    // The API refuses this session anyway; the redirect is what keeps the user from meeting a wall
    // of failed requests instead of the one screen that can clear the requirement.
    if (sessionUser.data.passwordRenewalRequired) {
      throw redirect({ to: '/password-renewal' })
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
