import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useTransportCompanyMutations() {
  const queryClient = useQueryClient()

  const invalidateTransportCompanies = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        exact: true,
        queryKey: transportCompanyQueries.all().queryKey,
      }),
      queryClient.invalidateQueries({
        exact: true,
        queryKey: transportCompanyQueries.available().queryKey,
      }),
    ])
  }

  const create = useMutation(
    tuyauQuery.transportCompanies.store.mutationOptions({
      onSuccess: () => invalidateTransportCompanies(),
    }),
  )
  const update = useMutation(
    tuyauQuery.transportCompanies.update.mutationOptions({
      onSuccess: () => invalidateTransportCompanies(),
    }),
  )

  return {
    create,
    refreshTransportCompanies: invalidateTransportCompanies,
    update,
  }
}
