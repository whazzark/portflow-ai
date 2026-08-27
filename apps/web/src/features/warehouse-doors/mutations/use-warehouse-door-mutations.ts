import { useMutation, useQueryClient } from '@tanstack/react-query'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useWarehouseDoorMutations() {
  const queryClient = useQueryClient()

  // Doors are embedded under their warehouse in the warehouse collection, so invalidating that one
  // query is the whole refresh — there is no separate door list to keep in step.
  const create = useMutation(
    tuyauQuery.warehouseDoors.store.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          exact: true,
          queryKey: warehouseQueries.list().queryKey,
        }),
    }),
  )

  const update = useMutation(
    tuyauQuery.warehouseDoors.update.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          exact: true,
          queryKey: warehouseQueries.list().queryKey,
        }),
    }),
  )

  const archive = useMutation(
    tuyauQuery.warehouseDoors.archive.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          exact: true,
          queryKey: warehouseQueries.list().queryKey,
        }),
    }),
  )

  // Bulk archival reports partial success, so the action bar owns when to refresh — it invalidates
  // after reading the outcome rather than on every settled request.
  const archiveMany = useMutation(tuyauQuery.warehouseDoors.archiveMany.mutationOptions())

  // Called after a refusal as well as after a success, so a view made stale by another
  // administrator's archival catches up rather than keeping an action it can no longer offer.
  const refreshWarehouseDoors = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: warehouseQueries.list().queryKey,
    })
  }

  return { archive, archiveMany, create, update, refreshWarehouseDoors }
}
