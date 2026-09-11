import { useQuery } from '@tanstack/react-query'

import { tuyau } from '@/libraries/tuyau/client'

/**
 * Whose access an activation link opens. A read, but a read keyed by a credential, so the API takes
 * it as a `POST` body — and `tuyauQuery` only offers mutation options for a `POST` route, hence the
 * direct client call inside an ordinary query.
 *
 * - `retry: false`: a dead link answers at once, not after three backoffs.
 * - `gcTime: 0`: the token-keyed entry leaves memory as soon as the screen unmounts.
 * - `staleTime: Infinity`: a window refocus never replays the credential.
 */
export function useActivationPreview(token: string) {
  return useQuery({
    queryKey: ['auth', 'invitation-acceptance', 'preview', token],
    queryFn: () => tuyau.request('auth.invitation_acceptance.preview', { body: { token } }),
    retry: false,
    gcTime: 0,
    staleTime: Number.POSITIVE_INFINITY,
  })
}
