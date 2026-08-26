import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { ResourceCollectionError } from '@/components/resource-map/resource-map-feedback'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { truckQueries } from '@/features/trucks/queries/truck-queries'

type TrucksErrorProps = {
  onRetry?: () => Promise<unknown>
}

export function TrucksError({ onRetry }: TrucksErrorProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const user = useAuthenticatedUser()

  const retry = async () => {
    if (onRetry) {
      await onRetry()
      return
    }

    const queryKeys = isAdministrator(user)
      ? [truckQueries.all().queryKey]
      : [truckQueries.available().queryKey, truckQueries.suspended().queryKey]
    for (const queryKey of queryKeys) {
      queryClient.removeQueries({ queryKey })
    }
    await router.invalidate()
  }

  // The truck directory sits inside the transport-resources page, which already owns the
  // `main` landmark.
  return <ResourceCollectionError label="trucks" onRetry={() => void retry()} render="div" />
}
