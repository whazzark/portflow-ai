import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { getRequestHeader } from '@tanstack/react-start/server'
import { StrictMode } from 'react'

import { SessionProvider } from '@/features/auth/context/session-context'
import { tuyauQuery } from '@/libraries/tuyau/client'

import '@/styles/globals.css'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context: { queryClient } }) => {
    const cookie = import.meta.env.SSR ? getRequestHeader('cookie') : undefined

    await queryClient
      .ensureQueryData(
        tuyauQuery.auth.me.queryOptions(
          {},
          cookie ? { tuyau: { headers: { cookie } } } : undefined,
        ),
      )
      .catch(() => undefined)
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Portflow' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <StrictMode>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <Outlet />
            </SessionProvider>
          </QueryClientProvider>
          <Scripts />
        </body>
      </html>
    </StrictMode>
  )
}
