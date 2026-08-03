import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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

    const query = isAdministrator(user) ? truckQueries.all() : truckQueries.available()
    queryClient.removeQueries({ queryKey: query.queryKey })
    await router.invalidate()
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Alert className="max-w-lg" variant="destructive">
        <AlertTitle>Unable to load trucks</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The current collection could not be retrieved. Try again.</span>
          <Button onClick={() => void retry()} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
