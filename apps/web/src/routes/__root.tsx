import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/features/auth/context/session-context'
import { DEFAULT_THEME, THEME_STORAGE_KEY, ThemeProvider } from '@/libraries/theme/theme-provider'
import { ensureSessionUser } from '@/libraries/tuyau/session'

import '@/styles/globals.css'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context: { queryClient } }) => {
    await ensureSessionUser(queryClient).catch(() => undefined)
  },
  head: () => ({
    links: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=1' },
      { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico?v=1' },
    ],
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
          {/* Applies the stored theme before first paint; Harbor Control is dark by default.
              Mirrors theme-provider.ts's readStoredTheme() decision rule — keep both in sync. */}
          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: static string, no user input
            dangerouslySetInnerHTML={{
              __html: `try{const t=localStorage.getItem('${THEME_STORAGE_KEY}')==='light'?'light':'${DEFAULT_THEME}';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t}catch(e){const t='${DEFAULT_THEME}';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t}`,
            }}
          />
          <HeadContent />
        </head>
        <body>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <SessionProvider>
                <Outlet />
              </SessionProvider>
              <Toaster />
            </ThemeProvider>
          </QueryClientProvider>
          <Scripts />
        </body>
      </html>
    </StrictMode>
  )
}
