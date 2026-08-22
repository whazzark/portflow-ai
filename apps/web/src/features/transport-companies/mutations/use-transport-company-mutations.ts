import { useMutation, useQueryClient } from '@tanstack/react-query'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { tuyauQuery } from '@/libraries/tuyau/client'

export function useTransportCompanyMutations() {
  const queryClient = useQueryClient()

  const invalidateTransportCompanies = async () => {
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: transportCompanyQueries.all().queryKey,
    })
    await queryClient.invalidateQueries({
      exact: true,
      queryKey: transportCompanyQueries.available().queryKey,
    })
  }

  const update = useMutation(
    tuyauQuery.transportCompanies.update.mutationOptions({
      onSuccess: () => invalidateTransportCompanies(),
    }),
  )

  return {
    refreshTransportCompanies: invalidateTransportCompanies,
    update,
  }
}
