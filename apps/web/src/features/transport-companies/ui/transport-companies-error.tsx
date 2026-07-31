import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Alert className="max-w-lg" variant="destructive">
        <AlertTitle>Unable to load transport companies</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The current collection could not be retrieved. Try again.</span>
          <Button onClick={() => void retry()} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
