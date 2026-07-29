import type { QueryClient } from '@tanstack/react-query'

import { tuyauQuery } from '@/libraries/tuyau/client'

export async function resetSession(queryClient: QueryClient) {
  await queryClient.resetQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
}
