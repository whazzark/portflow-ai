import { useMutation, useQueryClient } from '@tanstack/react-query'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useWarehouseMutations() {
  const queryClient = useQueryClient()

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

  return { create, refreshWarehouses: invalidateWarehouses }
}
