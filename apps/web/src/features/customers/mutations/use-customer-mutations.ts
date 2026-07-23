import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const invalidateCustomers = async (customerId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tuyauQuery.customers.index.queryKey() }),
      queryClient.invalidateQueries({ queryKey: tuyauQuery.customers.available.queryKey() }),
      ...(customerId
        ? [
            queryClient.invalidateQueries({
              queryKey: tuyauQuery.customers.show.queryKey({ params: { id: customerId } }),
            }),
          ]
        : []),
    ])
  }

  const create = useMutation(
    tuyauQuery.customers.store.mutationOptions({
      onSuccess: () => invalidateCustomers(),
    }),
  )
  const update = useMutation(
    tuyauQuery.customers.update.mutationOptions({
      onSuccess: (_data, variables) => invalidateCustomers(String(variables.params.id)),
    }),
  )
  const archive = useMutation(
    tuyauQuery.customers.archive.mutationOptions({
      onSuccess: (_data, variables) => invalidateCustomers(String(variables.params.id)),
    }),
  )
  const reactivate = useMutation(
    tuyauQuery.customers.reactivate.mutationOptions({
      onSuccess: (_data, variables) => invalidateCustomers(String(variables.params.id)),
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
