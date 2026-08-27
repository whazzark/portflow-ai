import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { resetSession } from '@/features/auth/session/session-cache'
import { isUnauthorizedError, parseApiError } from '@/libraries/tuyau/api-error'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function isAlreadyRenewedError(error: unknown) {
  return parseApiError(error).code === 'E_PASSWORD_RENEWAL_NOT_REQUIRED'
}

export function usePasswordRenewal() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.auth.passwordRenewal.mutationOptions({
      onSuccess: async () => {
        await resetSession(queryClient)
        await router.invalidate()
      },
      onError: async (error) => {
        // Two refusals mean the screen is no longer the right place to be, and both are resolved
        // the same way — drop the cached session and re-run the guards:
        //
        // - `401`: the session expired mid-renewal. The guards send the user to sign-in, where the
        //   still-standing requirement will present this screen again.
        // - `409`: the requirement is already cleared, because another tab or an earlier submission
        //   that timed out client-side got there first. The password is recorded and there is
        //   nothing left to do, so the guards take the user into the application — US4-6's "refused
        //   **or resolves to the same cleared state**". Reporting a failed save here would be
        //   inaccurate as well as unhelpful.
        if (isUnauthorizedError(error) || isAlreadyRenewedError(error)) {
          await resetSession(queryClient)
          await router.invalidate()
        }
      },
    }),
  )
}
