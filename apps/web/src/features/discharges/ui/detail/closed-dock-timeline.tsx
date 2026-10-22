import {
  closedDockTimeline,
  closedRecordPeriod,
} from '@/features/discharges/closed-discharge-record'
import { formatShiftDay } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { formatDateTime } from '@/helpers/dates'

const percent = (fraction: number) => `${fraction * 100}%`

// Room for each day's label, so a long discharge scrolls rather than crowding its days together.
const DAY_WIDTH_REM = 6
const MIN_WIDTH_REM = 36

/**
 * A closed discharge's shifts on the days it ran, drawn once: nothing moves, no now, no planning.
 * The strip is for the eye; the same shifts are listed for assistive technologies.
 */
export function ClosedDockTimeline({ discharge }: { discharge: DischargeDetailDto }) {
  const timeline = closedDockTimeline(discharge)

  if (!timeline) {
    return null
  }

  const { startAt } = closedRecordPeriod(discharge)
  const minWidth = `${Math.max(timeline.days.length * DAY_WIDTH_REM, MIN_WIDTH_REM)}rem`

  return (
    <DetailSection title={`Dock timeline · ${discharge.dock.name}`}>
      {/* Scrolls within itself on a narrow screen, so a long discharge never widens the page. */}
      <div aria-hidden="true" className="overflow-x-auto">
        <div className="relative grid gap-1 pb-1" style={{ minWidth }}>
          <div className="relative h-5 text-muted-foreground text-xs">
            {timeline.days.map((day) => (
              <span
                className="absolute top-0 border-l pl-1"
                key={day.date.toISOString()}
                style={{ left: percent(day.offset) }}
              >
                {formatShiftDay(day.date)}
              </span>
            ))}
          </div>
          <div className="relative h-10 rounded-md bg-muted">
            {timeline.days.slice(1).map((day) => (
              <span
                className="absolute inset-y-0 border-background border-l"
                key={day.date.toISOString()}
                style={{ left: percent(day.offset) }}
              />
            ))}
            {timeline.blocks.map((block) => (
              <span
                className="absolute inset-y-1 rounded-sm bg-primary/80"
                key={block.shiftId}
                style={{ left: percent(block.offset), width: percent(block.width) }}
                title={block.label}
              />
            ))}
            {timeline.startedMarker !== null && (
              <span
                className="absolute -inset-y-1 border-foreground border-l-2"
                style={{ left: percent(timeline.startedMarker) }}
              />
            )}
          </div>
          {timeline.startedMarker !== null && (
            <div className="relative h-5 text-muted-foreground text-xs">
              <span className="absolute top-0" style={{ left: percent(timeline.startedMarker) }}>
                Started
              </span>
            </div>
          )}
        </div>
      </div>
      {startAt && timeline.startedMarker !== null && (
        <p className="sr-only">Started {formatDateTime(startAt)}</p>
      )}
      <ul aria-label="Shifts on the timeline" className="sr-only">
        {timeline.blocks.map((block) => (
          <li key={block.shiftId}>Shift {block.label}</li>
        ))}
      </ul>
    </DetailSection>
  )
}
