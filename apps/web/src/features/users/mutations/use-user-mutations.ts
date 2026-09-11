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

  const updateIdentity = useMutation(
    tuyauQuery.users.update.mutationOptions({
      onSuccess: () => refreshUsers(),
    }),
  )

  const resetPassword = useMutation(
    tuyauQuery.users.passwordReset.mutationOptions({
      onSuccess: () => refreshUsers(),
    }),
  )

  return { invite, deactivate, updateIdentity, resetPassword, refreshUsers }
}
