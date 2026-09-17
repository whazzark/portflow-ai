import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { useId } from 'react'

import { buttonVariants } from '@/components/ui/button'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'

type Shift = DischargeDetailDto['shifts'][number]
type ReadinessGap = NonNullable<Shift['readinessGaps']>[number]

export const READINESS_GAP_LABELS: Record<ReadinessGap, string> = {
  NO_USABLE_TRUCK: 'No usable truck',
  NO_USABLE_WAREHOUSE_DOOR: 'No usable warehouse door',
  NO_USABLE_WEIGHING_AREA: 'No usable weighing area',
  RESPONSIBLE_NOT_ELIGIBLE: 'Responsible is no longer eligible',
}

export const NOTHING_MISSING =
  'Nothing missing among trucks, warehouse doors, weighing areas, and responsible.'

type ShiftReadinessProps = {
  gaps: ReadinessGap[]
  /** A preparer on a planned discharge may fill a gap, through the panel's `Edit` or the pool. */
  canCorrect: boolean
  /** Whether the discharge holds a truck the correction could select. */
  holdsTrucks: boolean
}

/**
 * What a planned shift still lacks to start, as facts: it never says the shift is ready, since
 * whether it may start is decided when it starts.
 */
export function ShiftReadiness({ canCorrect, gaps, holdsTrucks }: ShiftReadinessProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <h3 className="font-medium text-sm" id={headingId}>
        Readiness
      </h3>
      {gaps.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          <CircleCheckIcon aria-hidden="true" className="size-4 shrink-0" />
          {NOTHING_MISSING}
        </p>
      ) : (
        <>
          <ul aria-labelledby={headingId} className="grid gap-1.5 text-sm">
            {gaps.map((gap) => (
              <li className="inline-flex items-center gap-2" key={gap}>
                <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
                {READINESS_GAP_LABELS[gap]}
              </li>
            ))}
          </ul>
          {/* A shift's trucks come from the pool, so an empty pool is filled there first. The
              correction itself stays in the panel footer. */}
          {canCorrect && !holdsTrucks && gaps.includes('NO_USABLE_TRUCK') && (
            <div className="flex flex-wrap gap-2">
              <DischargeTabLink
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
                tab="truck-pool"
              >
                Go to truck pool
              </DischargeTabLink>
            </div>
          )}
        </>
      )}
    </section>
  )
}
