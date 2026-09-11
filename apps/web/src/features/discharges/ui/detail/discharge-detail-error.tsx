import { useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useRouter } from '@tanstack/react-router'

import { ResourceCollectionError } from '@/components/resource/resource-feedback'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

export function DischargeDetailError() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { dischargeId } = dischargeRoute.useParams()

  // As on the list: the failed query is dropped first, or the loader would replay the cached
  // rejection instead of asking again.
  const retry = async () => {
    queryClient.removeQueries({ queryKey: dischargeQueries.detail(dischargeId).queryKey })
    await router.invalidate()
  }

  return <ResourceCollectionError label="discharge" onRetry={() => void retry()} />
}
