import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ResourceCollectionError } from '@/components/resource/resource-feedback'
import { userQueries } from '@/features/users/queries/user-queries'

export function UsersError() {
  const queryClient = useQueryClient()
  const router = useRouter()

  // The failed query has to be dropped before the loader re-runs, or the retry replays the cached
  // rejection instead of requesting the latest collection. The session is untouched, so a recovered
  // failure never sends the administrator back to sign in.
  const retry = async () => {
    queryClient.removeQueries({ queryKey: userQueries.list().queryKey })
    await router.invalidate()
  }

  return <ResourceCollectionError label="users" onRetry={() => void retry()} />
}
