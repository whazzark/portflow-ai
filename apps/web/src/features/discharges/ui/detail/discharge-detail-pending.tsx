import { Skeleton } from '@/components/ui/skeleton'

export function DischargeDetailPending() {
  return (
    <div aria-label="Loading discharge" className="flex flex-col gap-6 p-4 md:p-6" role="status">
      {/* The header: the way back, the vessel and its status, the facts line. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {/* The section tabs, then the one section shown. */}
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
