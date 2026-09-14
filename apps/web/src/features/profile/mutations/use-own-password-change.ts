import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { resetSession } from '@/features/auth/session/session-cache'
import { isSessionHandover } from '@/features/profile/mutations/use-own-profile-update'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useOwnPasswordChange() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.me.password.update.mutationOptions({
      onSuccess: (response) => {
        // The session projection again, so the shell reads the user the change leaves behind — the
        // renewal flag included. Nothing else in the application depends on a password, so nothing
        // else is invalidated.
        queryClient.setQueryData(tuyauQuery.auth.me.queryOptions({}).queryKey, response)
      },
      onError: async (error) => {
        // The session ended, or now owes a renewal: the guards decide where the user goes, exactly
        // as for the identity update.
        if (isSessionHandover(error)) {
          await resetSession(queryClient)
          await router.invalidate()
        }
      },
    }),
  )
}
