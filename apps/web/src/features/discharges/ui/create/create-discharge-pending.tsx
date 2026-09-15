import { Skeleton } from '@/components/ui/skeleton'

/** Shown only while the session is being confirmed; the form itself never waits for its choices. */
export function CreateDischargePending() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <h1 className="font-semibold text-2xl">New discharge</h1>
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-none md:h-[calc(4rem+1px)]" />
    </div>
  )
}
