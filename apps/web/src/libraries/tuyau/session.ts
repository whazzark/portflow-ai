import type { QueryClient } from '@tanstack/react-query'
import { getRequestHeader } from '@tanstack/react-start/server'

import { tuyauQuery } from '@/libraries/tuyau/client'

export function ensureSessionUser(queryClient: QueryClient) {
  const cookie = import.meta.env.SSR ? getRequestHeader('cookie') : undefined

  return queryClient.ensureQueryData(
    tuyauQuery.auth.me.queryOptions({}, cookie ? { tuyau: { headers: { cookie } } } : undefined),
  )
}
