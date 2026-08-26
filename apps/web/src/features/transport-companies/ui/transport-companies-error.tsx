import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ResourceCollectionError } from '@/components/resource-map/resource-map-feedback'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'

type TransportCompaniesErrorProps = {
  onRetry?: () => Promise<unknown>
}

export function TransportCompaniesError({ onRetry }: TransportCompaniesErrorProps) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const retry = async () => {
    if (onRetry) {
      await onRetry()
      return
    }

    queryClient.removeQueries({ queryKey: transportCompanyQueries.all().queryKey })
    await router.invalidate()
  }

  return <ResourceCollectionError label="transport companies" onRetry={() => void retry()} />
}
