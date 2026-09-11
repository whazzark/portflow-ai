import { useMutation, useQueryClient } from '@tanstack/react-query'

import { userQueries } from '@/features/users/queries/user-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useUserMutations() {
  const queryClient = useQueryClient()

  /**
   * The record is a view over the retrieved collection, so one invalidation refreshes the row, the
   * counts, the open record, and every other place the corrected user is named.
   */
  const refreshUsers = () =>
    queryClient.invalidateQueries({ exact: true, queryKey: userQueries.list().queryKey })

  const invite = useMutation(
    tuyauQuery.users.store.mutationOptions({
      onSuccess: () => refreshUsers(),
    }),
  )

  /**
   * Refreshed on the failure path too, not only on success: a refusal usually means the record's
   * authoritative state moved on since this view loaded, and the administrator should read the
   * reason against a workbench that already agrees with the server.
   */
  const deactivate = useMutation(
    tuyauQuery.users.deactivate.mutationOptions({
      onSuccess: () => refreshUsers(),
      onError: () => refreshUsers(),
    }),
  )

  /** Refreshed on a refusal too, for the reason `deactivate` gives. */
  const cancelInvitation = useMutation(
    tuyauQuery.users.cancelInvitation.mutationOptions({
      onSuccess: () => refreshUsers(),
      onError: () => refreshUsers(),
    }),
  )

  /**
   * Refreshed on a refusal too, as `deactivate` is: a refusal means the user moved on — they
   * activated their access, or someone else removed them first — and the reason reads best against a
   * workbench that already agrees.
   */
  const remove = useMutation(
    tuyauQuery.users.destroy.mutationOptions({
      onSuccess: () => refreshUsers(),
      onError: () => refreshUsers(),
    }),
  )

  const updateIdentity = useMutation(
    tuyauQuery.users.update.mutationOptions({
      onSuccess: () => refreshUsers(),
    }),
  )

  /** Refreshed on a refusal too, as `deactivate` is: a deactivated user is refused a new role. */
  const changeRole = useMutation(
    tuyauQuery.users.changeRole.mutationOptions({
      onSuccess: async () => {
        await refreshUsers()
        // The viewer's own session too: were an administrator's own role ever changed, their
        // navigation must follow. The Edit panel is never offered on the viewer's own record and
        // GH-29 refuses the case in the API, so this is belt-and-braces — and one line.
        await queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })
      },
      onError: () => refreshUsers(),
    }),
  )

  const resetPassword = useMutation(
    tuyauQuery.users.passwordReset.mutationOptions({
      onSuccess: () => refreshUsers(),
    }),
  )

  /**
   * Refreshed on a refusal too, as `deactivate` is: the commonest refusal is a user who stopped being
   * pending since this view loaded, and the reason should be read against a workbench that agrees.
   *
   * Not awaited, unlike the other writes: the new link is presented as soon as the server answers,
   * not once the whole collection has been read again. And `gcTime: 0`, because the result carries a
   * secret with a single read — the mutation cache would otherwise keep it in memory for minutes.
   */
  const renewActivationLink = useMutation(
    tuyauQuery.users.activationLinkRenewal.mutationOptions({
      gcTime: 0,
      onSuccess: () => void refreshUsers(),
      onError: () => void refreshUsers(),
    }),
  )

  return {
    invite,
    deactivate,
    cancelInvitation,
    remove,
    updateIdentity,
    changeRole,
    resetPassword,
    renewActivationLink,
    refreshUsers,
  }
}
