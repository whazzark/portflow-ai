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
  const update = useMutation(
    tuyauQuery.weighingAreas.update.mutationOptions({
      onSuccess: () => invalidateWeighingAreas(),
    }),
  )
  const archive = useMutation(
    tuyauQuery.weighingAreas.archive.mutationOptions({
      onSuccess: () => invalidateWeighingAreas(),
    }),
  )
  const archiveMany = useMutation(tuyauQuery.weighingAreas.archiveMany.mutationOptions())

  return {
    archive,
    archiveMany,
    create,
    refreshWeighingAreas: invalidateWeighingAreas,
    update,
  }
}
