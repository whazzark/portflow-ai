import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { resetSession } from '@/features/auth/session/session-cache'
import { parseApiError } from '@/libraries/tuyau/api-error'
import { tuyauQuery } from '@/libraries/tuyau/client'

/**
 * Every answer meaning "this link is of no use". The API gives one identical refusal whatever the
 * reason; a validation refusal naming `token` itself means the same to the person holding the link,
 * so it is not placed on a field they cannot see.
 */
export function isActivationLinkUnusableError(error: unknown) {
  const apiError = parseApiError(error)

  return (
    apiError.code === 'E_ACTIVATION_LINK_UNUSABLE' ||
    (apiError.code === 'E_VALIDATION_ERROR' &&
      (apiError.details ?? []).some(({ field }) => field === 'token'))
  )
}

/** A session opened in this browser — another tab's login — since the screen was rendered. */
export function isSessionOpenError(error: unknown) {
  return parseApiError(error).code === 'E_INVITATION_ACCEPTANCE_SESSION_OPEN'
}

/**
 * The activation committed but no session could be opened. Only the request that activated can
 * know it, so this answer tells the person the truth: their access works, through a login.
 */
export function isSessionNotOpenedError(error: unknown) {
  return parseApiError(error).code === 'E_INVITATION_ACCEPTED_SESSION_NOT_OPENED'
}

export function useInvitationAcceptance() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation(
    tuyauQuery.auth.invitationAcceptance.store.mutationOptions({
      onSuccess: async () => {
        await resetSession(queryClient)
        // An explicit navigation rather than login's `invalidate()`: no guard on the activation
        // route pushes a signed-in user out — it must render for everyone. And `replace`, so the
        // activation URL, whose path is the secret, is not left in history behind the application.
        await router.navigate({ to: '/', search: { section: 'rotations' }, replace: true })
      },
      onError: async (error) => {
        // The screen was rendered for a logged-out browser and no longer is: re-read the session so
        // it names whoever is now signed in, instead of reporting a failure the person cannot fix
        // from the form.
        if (isSessionOpenError(error)) {
          await resetSession(queryClient)
          await router.invalidate()
        }
      },
    }),
  )
}
