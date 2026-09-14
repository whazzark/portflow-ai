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

  /**
   * Refreshed on a refusal too, for the reason `deactivate` gives: the commonest refusal is a user
   * someone else already reactivated, who has left the deactivated view since this one loaded.
   */
  const reactivate = useMutation(
    tuyauQuery.users.reactivate.mutationOptions({
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

  /**
   * The collection, then the viewer's own session — on a refusal as much as on a success.
   *
   * A refusal because the organization must keep an active organization admin only ever reaches an
   * administrator who lost that role, or their access, in the same collision: had they still been
   * one, they would have been the admin who remains. Their session is therefore stale the moment the
   * refusal arrives, and refetching it is what makes the workbench follow them — the panel gives
   * way to the record their new role allows, or the frame to sign-in. A deactivated user's refusal
   * is refreshed for the reason `deactivate` gives.
   *
   * Side by side rather than one after the other: the outcome is reported once both have settled,
   * and the collection alone must not arrive in a new viewer's shape while the session still
   * describes the old one.
   */
  const refreshAfterRoleChange = async () => {
    await Promise.all([
      refreshUsers(),
      queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() }),
    ])
  }

  const changeRole = useMutation(
    tuyauQuery.users.changeRole.mutationOptions({
      onSuccess: refreshAfterRoleChange,
      onError: refreshAfterRoleChange,
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

  /**
   * The renewal's shape, for the renewal's reasons: the result carries a secret with a single read,
   * so `gcTime: 0`; the link is presented as soon as the server answers, so the refresh is not
   * awaited; and a refusal usually means the user moved on, so the collection is refreshed then too.
   */
  const restoreInvitation = useMutation(
    tuyauQuery.users.restoreInvitation.mutationOptions({
      gcTime: 0,
      onSuccess: () => void refreshUsers(),
      onError: () => void refreshUsers(),
    }),
  )

  return {
    invite,
    deactivate,
    reactivate,
    cancelInvitation,
    remove,
    updateIdentity,
    changeRole,
    resetPassword,
    renewActivationLink,
    restoreInvitation,
    refreshUsers,
  }
}
