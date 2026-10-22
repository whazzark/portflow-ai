import { DoorOpenIcon, ScaleIcon, TriangleAlertIcon, TruckIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { shiftsSummary } from '@/features/discharges/shift-calendar'
import type { DischargeDetailDto } from '@/features/discharges/types'

/** The hatching an inter-shift break is drawn with, on the calendar and in its legend. */
export const BREAK_HATCH_CLASSES =
  'bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)] bg-muted/40'

function LegendItem({ children, mark }: { children: ReactNode; mark: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      {mark}
      {children}
    </li>
  )
}

/**
 * What the shifts amount to, above the calendar, with the gaps still to close in amber, then what
 * the calendar's marks mean. The legend is the calendar's, so a narrow screen showing a list leaves
 * it out.
 */
export function ShiftCalendarSummary({ discharge }: { discharge: DischargeDetailDto }) {
  const summary = shiftsSummary(discharge)
  if (!summary) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
      <p className="tabular-nums">
        <span className="text-foreground">{summary.text}</span>
        {summary.gapCount > 0 && (
          <>
            {' · '}
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
              {summary.gapCount} gap{summary.gapCount === 1 ? '' : 's'}
            </span>
          </>
        )}
      </p>
      <ul
        aria-label="Legend"
        className="hidden flex-wrap items-center gap-x-4 gap-y-1 md:ml-auto md:flex"
      >
        <LegendItem
          mark={<span aria-hidden="true" className="w-4 border-primary border-t-2 border-dashed" />}
        >
          Expected start
        </LegendItem>
        <LegendItem
          mark={
            <span
              aria-hidden="true"
              className={`h-3 w-4 rounded-xs border border-border ${BREAK_HATCH_CLASSES}`}
            />
          }
        >
          Inter-shift break
        </LegendItem>
        <LegendItem mark={<TruckIcon aria-hidden="true" className="size-3.5" />}>Trucks</LegendItem>
        <LegendItem mark={<DoorOpenIcon aria-hidden="true" className="size-3.5" />}>
          Doors
        </LegendItem>
        <LegendItem mark={<ScaleIcon aria-hidden="true" className="size-3.5" />}>
          Weighing areas
        </LegendItem>
      </ul>
    </div>
  )
}
