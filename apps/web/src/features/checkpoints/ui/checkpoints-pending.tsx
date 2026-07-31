import { Skeleton } from '@/components/ui/skeleton'

export function CheckpointsPending() {
  return (
    <main aria-label="Loading checkpoints" className="flex min-h-0 flex-1 overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
    </main>
  )
}
