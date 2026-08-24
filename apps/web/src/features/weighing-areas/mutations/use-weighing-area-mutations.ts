import { useMutation, useQueryClient } from '@tanstack/react-query'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useWeighingAreaMutations() {
  const queryClient = useQueryClient()

  const invalidateWeighingAreas = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: weighingAreaQueries.list().queryKey,
    })
  }

  const create = useMutation(
    tuyauQuery.weighingAreas.store.mutationOptions({
      onSuccess: () => invalidateWeighingAreas(),
    }),
  )

  return {
    create,
    refreshWeighingAreas: invalidateWeighingAreas,
  }
}
