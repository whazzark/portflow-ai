import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { ResourceCollectionError } from '@/components/resource/resource-feedback'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'

export function DischargesError() {
  const queryClient = useQueryClient()
  const router = useRouter()

  // The failed query has to be dropped before the loader re-runs, or the retry replays the cached
  // rejection instead of requesting the collection again.
  const retry = async () => {
    queryClient.removeQueries({ queryKey: dischargeQueries.all().queryKey })
    await router.invalidate()
  }

  return <ResourceCollectionError label="discharges" onRetry={() => void retry()} />
}
