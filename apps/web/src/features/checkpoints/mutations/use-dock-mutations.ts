import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dockQueries } from '@/features/checkpoints/queries/dock-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useDockMutations() {
  const queryClient = useQueryClient()

  const refreshDock = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: dockQueries.list().queryKey })
    if (id) {
      await queryClient.invalidateQueries({ queryKey: dockQueries.detail(id).queryKey })
    }
  }

  return {
    archive: useMutation(
      tuyauQuery.docks.archive.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
    create: useMutation(
      tuyauQuery.docks.store.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
    update: useMutation(
      tuyauQuery.docks.update.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
    reactivate: useMutation(
      tuyauQuery.docks.reactivate.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
  }
}
