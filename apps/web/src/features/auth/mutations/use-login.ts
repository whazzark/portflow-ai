import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { tuyauQuery } from '@/libraries/tuyau/client'

export function useLogin() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.auth.login.mutationOptions({
      onSuccess: async () => {
        await queryClient.resetQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
        await router.invalidate()
      },
    }),
  )
}
