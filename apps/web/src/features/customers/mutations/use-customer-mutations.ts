import { useMutation, useQueryClient } from '@tanstack/react-query'
import { customerQueries } from '@/features/customers/queries/customer-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const invalidateCustomers = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: customerQueries.list().queryKey,
    })
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: customerQueries.available().queryKey,
    })
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
  const archiveMany = useMutation(tuyauQuery.customers.archiveMany.mutationOptions())
  const reactivateMany = useMutation(tuyauQuery.customers.reactivateMany.mutationOptions())

  return {
    archive,
    archiveMany,
    create,
    reactivate,
    reactivateMany,
    refreshCustomers: invalidateCustomers,
    update,
  }
}
