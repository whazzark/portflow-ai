import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ResourceMapPending({ label }: { label: string }) {
  return (
    <main aria-label={`Loading ${label}`} className="flex min-h-0 flex-1 overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
    </main>
  )
}

/** The one wording every collection uses when it fails to load, map-backed or not. */
export function ResourceCollectionError({
  label,
  onRetry,
  render = 'main',
}: {
  label: string
  onRetry: () => void
  /** A collection embedded in a page that already owns the landmark renders a plain `div`. */
  render?: 'main' | 'div'
}) {
  const Frame = render
  return (
    <Frame className="flex min-h-full items-center justify-center p-6">
      <Alert className="max-w-lg" variant="destructive">
        <AlertTitle>Unable to load {label}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>The {label} collection could not be loaded. Try again.</span>
          <Button onClick={onRetry} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </Frame>
  )
}
