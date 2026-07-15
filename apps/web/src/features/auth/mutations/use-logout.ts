import { useMutation, useQueryClient } from '@tanstack/react-query'

import { tuyauQuery } from '@/libraries/tuyau/client'

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation(
    tuyauQuery.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
      },
    }),
  )
}
