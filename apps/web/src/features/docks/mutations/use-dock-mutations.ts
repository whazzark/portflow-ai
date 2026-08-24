import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useDockMutations() {
  const queryClient = useQueryClient()

  const invalidateDocks = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: dockQueries.list().queryKey,
    })
  }

  const create = useMutation(
    tuyauQuery.docks.store.mutationOptions({
      onSuccess: () => invalidateDocks(),
    }),
  )
  const update = useMutation(
    tuyauQuery.docks.update.mutationOptions({
      onSuccess: () => invalidateDocks(),
    }),
  )

  return {
    create,
    refreshDocks: invalidateDocks,
    update,
  }
}
