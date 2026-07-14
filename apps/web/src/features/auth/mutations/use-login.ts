import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tuyauQuery } from '@/libraries/tuyau/client'

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation(
    tuyauQuery.auth.login.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
      },
    }),
  )
}
