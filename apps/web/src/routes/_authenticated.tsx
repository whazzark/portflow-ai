import { createFileRoute, redirect } from '@tanstack/react-router'
import { getRequestHeader } from '@tanstack/react-start/server'
import { TuyauError } from '@tuyau/core/client'

import { AuthenticatedLayout } from '@/features/layout/ui/authenticated-layout'
import { tuyauQuery } from '@/libraries/tuyau/client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const cookie = import.meta.env.SSR ? getRequestHeader('cookie') : undefined

    try {
      await queryClient.ensureQueryData(
        tuyauQuery.auth.me.queryOptions(
          {},
          cookie ? { tuyau: { headers: { cookie } } } : undefined,
        ),
      )
    } catch (error) {
      if (error instanceof TuyauError && error.status === 401) {
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
