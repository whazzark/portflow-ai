import { useQuery } from '@tanstack/react-query'
import { type CSSProperties, useEffect, useState } from 'react'

import { dischargePeriod, formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  activeDockTimeline,
  type TimelineBlock,
  type TimelineBlockState,
} from '@/features/discharges/dock-timeline'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

type DockTimelineCardProps = {
  discharge: DischargeDetailDto
}

/** Wide enough per day for a shift's hours to read, so a long discharge scrolls inside the card. */
const DAY_MIN_WIDTH_PX = 168

const STATE_LABELS = {
  COMPLETED: 'Completed',
  ACTIVE: 'In progress',
  PLANNED: 'Planned',
  OCCUPANCY: 'Occupied',
} as const satisfies Record<TimelineBlockState, string>

// As the shift calendar draws them: work under way stands out, what is prepared reads plainly, and
// what is finished recedes. Every block also says its state in words, so colour is never the only
// signal; another discharge's occupancy is hatched, as an inter-shift break is.
const STATE_CLASSES = {
  COMPLETED: 'bg-muted text-muted-foreground',
  ACTIVE:
    'border-primary bg-[color-mix(in_oklab,var(--color-primary)_18%,var(--color-card))] font-medium',
  PLANNED: 'border-dashed bg-card',
  OCCUPANCY:
    'bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)] bg-muted/40 text-muted-foreground',
} as const satisfies Record<TimelineBlockState, string>

const pad = (value: number) => String(value).padStart(2, '0')
const hour = (iso: string) => pad(new Date(iso).getHours())
const nowLabel = (iso: string) => {
  const date = new Date(iso)

  return `Now ${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function blockName(block: TimelineBlock, period: string) {
  return [STATE_LABELS[block.state], period, block.overrun && 'past its planned end']
    .filter(Boolean)
    .join(', ')
}

/**
 * The current time once the page runs in the browser, and `null` while it is rendered on the server,
 * so the two renderings agree before now is drawn.
 */
function useNow() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
  }, [])

  return now
}

/**
 * Where a started discharge stands on its dock: its shifts behind and ahead of now, the breaks
 * between them, and the other discharges holding the same dock. Read-only.
 */
export function DockTimelineCard({ discharge }: DockTimelineCardProps) {
  const occupancyQuery = useQuery(dischargeQueries.dockOccupancy(discharge.dock.id))
  // Without the dock's occupancy, the discharge's own lane still says where it stands.
  const occupancy = occupancyQuery.data?.data ?? []
  const now = useNow()
  const timeline = activeDockTimeline(discharge, occupancy, now)
  const span = (from: string, to: string): CSSProperties => {
    const left = Math.max(0, timeline.offset(from))
    const right = Math.min(100, timeline.offset(to))

    return { left: `${left}%`, width: `${Math.max(right - left, 0)}%` }
  }
  const shiftsById = new Map(discharge.shifts.map((shift) => [shift.id, shift]))
  const completed = discharge.shifts.filter((shift) => shift.status === 'COMPLETED').length
  const { to: plannedUntil } = dischargePeriod(discharge)
  const startedBy = discharge.startedBy
    ? ` by ${discharge.startedBy.firstName} ${discharge.startedBy.lastName}`
    : ''

  return (
    <DetailSection title={`Dock timeline · ${discharge.dock.name}`}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-sm">
          <div className="grid gap-1">
            <p>
              Started {formatDateTime(discharge.startedAt)}
              {startedBy} · planned until {formatDateTime(plannedUntil)}
            </p>
            <dl className="flex items-baseline gap-1.5 text-muted-foreground">
              <dt>Shifts</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {completed} of {discharge.shifts.length} completed
              </dd>
            </dl>
          </div>
          <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            {(['COMPLETED', 'ACTIVE', 'PLANNED'] as const).map((state) => (
              <li className="inline-flex items-center gap-1.5" key={state}>
                <span
                  aria-hidden="true"
                  className={classnames('size-3 rounded-sm border', STATE_CLASSES[state])}
                />
                {STATE_LABELS[state]}
              </li>
            ))}
          </ul>
        </div>
        {/* Scrolls inside the card, never the page, on a narrow screen. */}
        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div
            className="relative grid gap-2"
            style={{ minWidth: `${timeline.days.length * DAY_MIN_WIDTH_PX}px` }}
          >
            <ol
              aria-hidden="true"
              className="relative ml-40 flex h-5 text-muted-foreground text-xs"
            >
              {timeline.days.map((day, index) => {
                const next = timeline.days[index + 1]?.start ?? timeline.window.to

                return (
                  <li
                    className="absolute whitespace-nowrap border-l pl-1"
                    key={day.start}
                    style={span(day.start, next)}
                  >
                    {day.label}
                  </li>
                )
              })}
            </ol>
            <ul aria-label="Discharges on the dock" className="grid gap-2">
              {timeline.lanes.map((lane) => (
                <li
                  aria-label={lane.discharge.vesselName}
                  className="flex items-stretch gap-2"
                  key={lane.discharge.id}
                >
                  <span
                    className={classnames(
                      'w-38 shrink-0 truncate py-2 text-sm',
                      lane.discharge.isCurrent ? 'font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {lane.discharge.vesselName}
                  </span>
                  <div className="relative h-10 min-w-0 flex-1 rounded-md bg-muted/30">
                    {lane.breaks.map((pause) => (
                      <div
                        aria-hidden="true"
                        className="absolute inset-y-1 bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]"
                        key={`${pause.from}-${pause.to}`}
                        style={span(pause.from, pause.to)}
                      />
                    ))}
                    <ol
                      aria-label={
                        lane.discharge.isCurrent
                          ? `Shifts of ${lane.discharge.vesselName}`
                          : `Occupancy of ${lane.discharge.vesselName}`
                      }
                    >
                      {lane.blocks.map((block) => {
                        const shift = block.shiftId ? shiftsById.get(block.shiftId) : undefined
                        const period = shift
                          ? formatShiftPeriod(shift)
                          : `${formatDateTime(block.from)} – ${formatDateTime(block.to)}`

                        return (
                          <li
                            aria-label={blockName(block, period)}
                            className={classnames(
                              'absolute inset-y-1 flex items-center overflow-hidden rounded-sm border px-1 text-xs tabular-nums',
                              STATE_CLASSES[block.state],
                              block.overrun && 'border-r-2 border-r-warning',
                            )}
                            key={block.shiftId ?? `${block.from}-${block.to}`}
                            style={span(block.from, block.to)}
                            title={blockName(block, period)}
                          >
                            <span aria-hidden="true" className="truncate">
                              {block.state === 'OCCUPANCY'
                                ? lane.discharge.vesselName
                                : `${hour(block.from)}–${hour(block.to)}`}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </li>
              ))}
            </ul>
            {timeline.now && (
              <div className="pointer-events-none absolute inset-y-0 right-0 left-40">
                <div
                  className="absolute inset-y-0 w-0.5 bg-destructive"
                  style={{ left: `${timeline.offset(timeline.now)}%` }}
                >
                  <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded-sm bg-card px-1 font-medium text-destructive text-xs tabular-nums">
                    {nowLabel(timeline.now)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DetailSection>
  )
}
