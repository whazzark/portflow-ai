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

  return { create, update }
}
