import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { dockQueries } from '@/features/docks/queries/dock-queries'

export function CheckpointsError() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Alert className="max-w-lg" variant="destructive">
        <AlertTitle>Unable to load checkpoints</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The checkpoint collection could not be loaded. Try again.</span>
          <Button
            onClick={async () => {
              queryClient.removeQueries({ queryKey: dockQueries.list().queryKey })
              await router.invalidate()
            }}
            variant="outline"
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
