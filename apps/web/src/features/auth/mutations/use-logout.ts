import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { resetSession } from '@/features/auth/session/session-cache'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.auth.logout.mutationOptions({
      onSuccess: async () => {
        await resetSession(queryClient)
        await router.invalidate()
      },
    }),
  )
}
