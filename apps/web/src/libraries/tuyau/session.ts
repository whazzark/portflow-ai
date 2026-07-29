import type { QueryClient } from '@tanstack/react-query'

import { tuyauQuery } from '@/libraries/tuyau/client'

export async function ensureSessionUser(queryClient: QueryClient) {
  return await queryClient.ensureQueryData(tuyauQuery.auth.me.queryOptions({}))
}
