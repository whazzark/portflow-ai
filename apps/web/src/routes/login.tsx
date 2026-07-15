import { createFileRoute, redirect } from '@tanstack/react-router'
import { getRequestHeader } from '@tanstack/react-start/server'

import { LoginScreen } from '@/features/auth/ui/login-screen'
import { tuyauQuery } from '@/libraries/tuyau/client'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const cookie = import.meta.env.SSR ? getRequestHeader('cookie') : undefined

    const isAuthenticated = await queryClient
      .ensureQueryData(
        tuyauQuery.auth.me.queryOptions(
          {},
          cookie ? { tuyau: { headers: { cookie } } } : undefined,
        ),
      )
      .then(() => true)
      .catch(() => false)

    if (isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginScreen,
})
