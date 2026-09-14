import { matchQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { resetSession } from '@/features/auth/session/session-cache'
import { isUnauthorizedError, parseApiError } from '@/libraries/tuyau/api-error'
import { tuyauQuery } from '@/libraries/tuyau/client'

/**
 * The two refusals that mean this screen is no longer the right place to be: the session ended, or
 * it now owes a password renewal. The guards decide where the user goes; the form says nothing, since
 * a message would land on a screen it makes no sense on.
 */
export function isSessionHandover(error: unknown) {
  return isUnauthorizedError(error) || parseApiError(error).code === 'E_PASSWORD_RENEWAL_REQUIRED'
}

export function useOwnProfileUpdate() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.me.profile.update.mutationOptions({
      onSuccess: async (response) => {
        // The response is the session projection `auth.me` returns, so the session is seeded from
        // it directly: the user menu follows at once, with no second read. The key is the exact one
        // `SessionProvider` reads — `setQueryData` matches exactly, unlike the prefix-matching
        // `queryKey()` the invalidations below can use.
        const sessionKey = tuyauQuery.auth.me.queryOptions({}).queryKey
        queryClient.setQueryData(sessionKey, response)

        // Everything else too. The signed-in user can be named wherever a lifecycle actor is
        // embedded — the user collection, a site reference's archival, a discharge's activity — and
        // enumerating those keys would rot with the next feature that names a user. Only the
        // queries on screen refetch; the write is rare. The session itself is left as just seeded.
        await queryClient.invalidateQueries({
          predicate: (query) => !matchQuery({ exact: false, queryKey: sessionKey }, query),
        })
      },
      onError: async (error) => {
        // Drop the cached session and re-run the guards, as `usePasswordRenewal` does: they send
        // the user to sign-in or to the renewal, whichever the server now says.
        if (isSessionHandover(error)) {
          await resetSession(queryClient)
          await router.invalidate()

          return
        }

        // Asked for a password the form did not think it needed: the stored address is no longer
        // the one this session knows — an administrator moved it. Reading the session again shows
        // the current address, and with it the password field the change now calls for.
        if (parseApiError(error).code === 'E_CURRENT_PASSWORD_REQUIRED') {
          await queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
        }
      },
    }),
  )
}
