import { Skeleton } from '@/components/ui/skeleton'

export function ResourceMapPending({ label }: { label: string }) {
  return (
    <div
      aria-label={`Loading ${label}`}
      className="flex min-h-0 flex-1 overflow-hidden"
      role="status"
    >
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  )
}
