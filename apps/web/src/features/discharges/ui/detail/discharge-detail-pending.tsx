import { Skeleton } from '@/components/ui/skeleton'

export function DischargeDetailPending() {
  return (
    <div aria-label="Loading discharge" className="flex flex-col gap-6 p-4 md:p-6" role="status">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-8 w-72" />
      {/* One block per card: overview, product lots, shifts, truck pool. */}
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
