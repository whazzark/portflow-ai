import { createFileRoute } from '@tanstack/react-router'

import { GuestLayout } from '@/components/layout/guest-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

/**
 * A third pathless layout beside `_guest` and `_password-renewal`, sharing their `GuestLayout`, and
 * deliberately without either guard: `_guest` pushes a signed-in user out and `_password-renewal`
 * keeps a confined one in, where the activation screen must render for everyone and name whoever is
 * signed in rather than redirect them. The session is resolved here so the screen reads it settled.
 *
 * The path below this layout is the activation secret, so nothing it loads may carry it away in a
 * `Referer`. nginx sends the same policy as a header for `/activate/`.
 */
export const Route = createFileRoute('/_activation')({
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      await ensureSessionUser(queryClient)
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error
      }
    }
  },
  head: () => ({
    meta: [{ name: 'referrer', content: 'no-referrer' }],
  }),
  pendingComponent: () => null,
  component: GuestLayout,
})
