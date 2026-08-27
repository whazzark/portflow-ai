import { createFileRoute, redirect } from '@tanstack/react-router'

import { GuestLayout } from '@/components/layout/guest-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context: { queryClient } }) => {
    let sessionUser: Awaited<ReturnType<typeof ensureSessionUser>>

    try {
      sessionUser = await ensureSessionUser(queryClient)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return
      }

      throw error
    }

    // Straight to the renewal step rather than to `/`, which `_authenticated` would only bounce
    // again: a confined user reaching the sign-in screen is redirected once, not twice.
    if (sessionUser.data.passwordRenewalRequired) {
      throw redirect({ to: '/password-renewal' })
    }

    throw redirect({ to: '/', search: { section: 'rotations' } })
  },
  component: GuestLayout,
})
