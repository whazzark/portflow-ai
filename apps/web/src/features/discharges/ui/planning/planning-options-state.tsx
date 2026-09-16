import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'

type PlanningOptionsStateProps<Option> = {
  state: PreparationOptions<Option>
  /** Shown when the options failed to load, as `Unable to load the …`. */
  noun: string
  children: ReactNode
}

/** A planning list while its options load, after they failed, or once they are there. */
export function PlanningOptionsState<Option>({
  children,
  noun,
  state,
}: PlanningOptionsStateProps<Option>) {
  if (state.onRetry) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="alert">
        <p>Unable to load the {noun}</p>
        <Button onClick={state.onRetry} size="sm" type="button" variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  if (state.loading) {
    return (
      <div aria-busy="true" aria-label={`Loading the ${noun}`} className="grid gap-2" role="status">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-3/5" />
      </div>
    )
  }

  return children
}
