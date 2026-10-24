import { Skeleton } from '@/components/ui/skeleton'

export function UsersPending() {
  return (
    <div
      className="flex flex-col gap-4 px-4 py-6 md:h-[calc(100svh-4rem)] md:min-h-0 md:overflow-hidden md:px-8"
      aria-label="Loading users"
      role="status"
    >
      {/* The same frame as the loaded page — search, tabs, role chips, table — so nothing jumps
          when the collection arrives. */}
      <Skeleton className="h-9 w-full md:w-[440px]" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-[30px] w-full max-w-xl rounded-full" />
      <Skeleton className="min-h-56 w-full flex-1 rounded-lg" />
    </div>
  )
}
