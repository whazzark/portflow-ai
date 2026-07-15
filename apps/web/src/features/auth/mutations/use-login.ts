import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { tuyauQuery } from '@/libraries/tuyau/client'

export function useLogin() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation(
    tuyauQuery.auth.login.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
        void navigate({ to: '/' })
      },
    }),
  )
}
