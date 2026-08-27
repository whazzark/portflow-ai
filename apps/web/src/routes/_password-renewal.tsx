import { createFileRoute, redirect } from '@tanstack/react-router'

import { GuestLayout } from '@/components/layout/guest-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

/**
 * A third pathless layout rather than a branch inside `_authenticated`: the renewal step stands
 * *instead of* the application frame, so nothing of the shell may render behind it. It reuses
 * `GuestLayout` so the renewal lands on the same split-screen surface as sign-in.
 *
 * The guard is `_guest`'s inverted: that one exists to push an authenticated user out, this one
 * exists to keep a confined user in.
 */
export const Route = createFileRoute('/_password-renewal')({
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

    if (!sessionUser.data.passwordRenewalRequired) {
      throw redirect({ to: '/', search: { section: 'rotations' } })
    }
  },
  pendingComponent: () => null,
  component: GuestLayout,
})
