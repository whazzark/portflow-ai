import { useMutation, useQueryClient } from '@tanstack/react-query'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useWarehouseMutations() {
  const queryClient = useQueryClient()

  // The warehouse collection embeds every door, so one invalidation refreshes the warehouse's
  // status and archive context together with every door the cascade touched.
  const invalidateWarehouses = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: warehouseQueries.list().queryKey,
    })
  }

  const create = useMutation(
    tuyauQuery.warehouses.store.mutationOptions({
      onSuccess: () => invalidateWarehouses(),
    }),
  )

  const archive = useMutation(
    tuyauQuery.warehouses.archive.mutationOptions({
      onSuccess: () => invalidateWarehouses(),
    }),
  )

  // Bulk archival reports partial success, so the action bar owns when to refresh — it invalidates
  // after reading the outcome rather than on every settled request.
  const archiveMany = useMutation(tuyauQuery.warehouses.archiveMany.mutationOptions())

  return { archive, archiveMany, create, refreshWarehouses: invalidateWarehouses }
}
