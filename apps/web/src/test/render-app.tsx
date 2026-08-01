import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { afterEach } from 'vitest'

import { routeTree } from '@/routeTree.gen'

type TestApp = {
  queryClient: QueryClient
  router: {
    cancelMatches: () => void
    clearCache: () => void
    history: { destroy: () => void }
  }
}

const activeTestApps = new Set<TestApp>()

afterEach(() => {
  for (const { queryClient, router } of activeTestApps) {
    router.cancelMatches()
    router.history.destroy()
    router.clearCache()
    queryClient.clear()
  }

  activeTestApps.clear()
})

export function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
      mutations: {
        gcTime: Infinity,
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })

  activeTestApps.add({ queryClient, router })

  return { ...render(<RouterProvider router={router} />), queryClient, router }
}
