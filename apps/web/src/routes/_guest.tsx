import { createFileRoute, redirect } from '@tanstack/react-router'
import { getRequestHeader } from '@tanstack/react-start/server'

import { GuestLayout } from '@/features/layout/ui/guest-layout'
import { tuyauQuery } from '@/libraries/tuyau/client'

export const Route = createFileRoute('/_guest')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const cookie = import.meta.env.SSR ? getRequestHeader('cookie') : undefined

    try {
      await queryClient.ensureQueryData(
        tuyauQuery.auth.me.queryOptions(
          {},
          cookie ? { tuyau: { headers: { cookie } } } : undefined,
        ),
      )
    } catch {
      return
    }

    throw redirect({ to: '/' })
  },
  component: GuestLayout,
})
