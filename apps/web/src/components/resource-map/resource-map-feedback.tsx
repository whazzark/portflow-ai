import { Skeleton } from '@/components/ui/skeleton'

export function ResourceMapPending({ label }: { label: string }) {
  return (
    <main aria-label={`Loading ${label}`} className="flex min-h-0 flex-1 overflow-hidden">
      <Skeleton className="h-full w-full rounded-none" />
    </main>
  )
}
