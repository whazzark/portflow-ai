import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function CustomersError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <Alert className="max-w-lg" variant="destructive">
        <AlertTitle>Unable to load customers</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>Refresh the page and try again.</span>
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
