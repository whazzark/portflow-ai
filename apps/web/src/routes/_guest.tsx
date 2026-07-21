import { createFileRoute, redirect } from '@tanstack/react-router'

import { GuestLayout } from '@/components/layout/guest-layout'
import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context: { queryClient } }) => {
    try {
      await ensureSessionUser(queryClient)
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return
      }

      throw error
    }

    throw redirect({ to: '/' })
  },
  component: GuestLayout,
})
