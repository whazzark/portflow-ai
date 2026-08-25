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
  const archive = useMutation(
    tuyauQuery.trucks.archive.mutationOptions({
      onSuccess: () => invalidateTrucks(),
    }),
  )
  const archiveMany = useMutation(tuyauQuery.trucks.archiveMany.mutationOptions())

  const reactivate = useMutation(
    tuyauQuery.trucks.reactivate.mutationOptions({
      onSuccess: () => invalidateTrucks(),
    }),
  )
  const reactivateMany = useMutation(tuyauQuery.trucks.reactivateMany.mutationOptions())

  const suspend = useMutation(
    tuyauQuery.trucks.suspend.mutationOptions({
      onSuccess: () => invalidateTrucks(),
    }),
  )

  const update = useMutation(
    tuyauQuery.trucks.update.mutationOptions({
      onSuccess: () => invalidateTrucks(),
    }),
  )

  return {
    archive,
    archiveMany,
    create,
    reactivate,
    reactivateMany,
    suspend,
    update,
    refreshTrucks: invalidateTrucks,
  }
}
