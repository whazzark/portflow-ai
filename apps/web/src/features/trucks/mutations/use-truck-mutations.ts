import { useMutation, useQueryClient } from '@tanstack/react-query'

import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useTruckMutations() {
  const queryClient = useQueryClient()

  const invalidateTrucks = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: truckQueries.all().queryKey,
    })
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: truckQueries.available().queryKey,
    })
  }

  const create = useMutation(
    tuyauQuery.trucks.store.mutationOptions({
      onSuccess: () => invalidateTrucks(),
    }),
  )

  return {
    create,
    refreshTrucks: invalidateTrucks,
  }
}
