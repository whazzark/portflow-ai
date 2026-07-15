import type { QueryClient } from '@tanstack/react-query'
import { createIsomorphicFn } from '@tanstack/react-start'

import { tuyauQuery } from '@/libraries/tuyau/client'

const getSessionCookie = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeader } = await import('@tanstack/react-start/server')

    return getRequestHeader('cookie')
  })
  .client(() => undefined)

export async function ensureSessionUser(queryClient: QueryClient) {
  const cookie = await getSessionCookie()

  return await queryClient.ensureQueryData(
    tuyauQuery.auth.me.queryOptions({}, cookie ? { tuyau: { headers: { cookie } } } : undefined),
  )
}
