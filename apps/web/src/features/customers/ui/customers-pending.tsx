import { Skeleton } from '@/components/ui/skeleton'

export function CustomersPending() {
  return (
    <main
      className="flex flex-col gap-6 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6"
      aria-label="Loading customers"
    >
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="min-h-56 w-full flex-1" />
      </div>
    </main>
  )
}
