import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const invalidateCustomers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tuyauQuery.customers.index.queryKey() }),
      queryClient.invalidateQueries({ queryKey: tuyauQuery.customers.available.queryKey() }),
    ])
  }

  const create = useMutation(
    tuyauQuery.customers.store.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const update = useMutation(
    tuyauQuery.customers.update.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const archive = useMutation(
    tuyauQuery.customers.archive.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const reactivate = useMutation(
    tuyauQuery.customers.reactivate.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const archiveMany = useMutation(
    tuyauQuery.customers.archiveMany.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const reactivateMany = useMutation(
    tuyauQuery.customers.reactivateMany.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )

  return { archive, archiveMany, create, reactivate, reactivateMany, update }
}
