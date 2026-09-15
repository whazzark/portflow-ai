import { TriangleAlertIcon, TruckIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef } from 'react'

import {
  formatShiftDay,
  formatShiftPeriod,
  formatShiftTime,
} from '@/features/discharges/discharge-detail-view'
import { shiftCalendar } from '@/features/discharges/shift-calendar'
import { currentTruckIds } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ShiftStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { classnames } from '@/libraries/shadcn/helpers'

type Shift = DischargeDetailDto['shifts'][number]

/** Wide enough for a shift's times and status badge side by side. */
const COLUMN_WIDTH_PX = 176
/** Tall enough per hour for an eight-hour shift to show its times, responsible, and trucks. */
const HOUR_HEIGHT_PX = 28

// Work under way stands out; what is prepared reads plainly and what is finished recedes. The
// status badge inside carries the meaning, so the colour is never the only signal.
const BLOCK_STATUS_CLASSES = {
  PLANNED: 'bg-card',
  ACTIVE: 'border-primary bg-primary/10',
  COMPLETED: 'bg-muted text-muted-foreground',
} as const satisfies Record<Shift['status'], string>

/** A shift cut at a column edge squares the edges it continues through. */
function continuationClasses(segment: {
  continuesFromPrevious: boolean
  continuesToNext: boolean
}) {
  return classnames(
    segment.continuesFromPrevious && 'rounded-t-none border-t-0',
    segment.continuesToNext && 'rounded-b-none border-b-0',
  )
}

/** Placed within the calendar's day area: its column, and its offset down that column. */
function placement(column: number, topPct: number, heightPct?: number): CSSProperties {
  return {
    left: `calc(${column} * var(--column-width))`,
    top: `${topPct}%`,
    ...(heightPct !== undefined && { height: `${heightPct}%` }),
  }
}

type ShiftCalendarProps = {
  discharge: DischargeDetailDto
  selectedShiftId: string
  onSelect: (shiftId: string) => void
}

/**
 * The discharge's shifts in columns of 24 hours from the hour it is expected to start, with the
 * breaks between them. On a narrow screen the same shifts stack as a list and no calendar is
 * drawn, so there is one set of controls whatever the width.
 */
export function ShiftCalendar({ discharge, onSelect, selectedShiftId }: ShiftCalendarProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const calendar = shiftCalendar(discharge, discharge.status === 'ACTIVE' ? new Date() : undefined)

  // A shared address may open a shift lying past the visible columns.
  useEffect(() => {
    scroller.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])

  if (!calendar) {
    return null
  }

  const continuations = calendar.segments.filter((segment) => !segment.primary)

  return (
    <div className="md:-mx-1 md:overflow-x-auto md:px-1 md:pb-2" ref={scroller}>
      <div
        className="md:flex md:w-max"
        style={
          {
            '--column-width': `${COLUMN_WIDTH_PX}px`,
            '--day-height': `${24 * HOUR_HEIGHT_PX}px`,
            '--days-width': `${calendar.columns.length * COLUMN_WIDTH_PX}px`,
          } as CSSProperties
        }
      >
        {/* Stays in view while the columns scroll sideways. */}
        <div
          aria-hidden="true"
          className="sticky left-0 z-10 hidden w-14 shrink-0 bg-card pt-10 md:block"
        >
          <div className="relative h-(--day-height)">
            {calendar.hourMarks.map((mark) => (
              <span
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
                key={mark.pct}
                style={{ top: `${mark.pct}%` }}
              >
                {mark.label}
              </span>
            ))}
          </div>
        </div>
        <div className="md:relative md:w-(--days-width) md:pt-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            {calendar.columns.map((column) => (
              <div
                className={classnames(
                  'absolute inset-y-0 w-(--column-width) px-2 text-xs',
                  column.index > 0 && 'border-border border-l',
                )}
                key={column.index}
                style={{ left: `calc(${column.index} * var(--column-width))` }}
              >
                <span className="block truncate font-medium">{column.label}</span>
                <span className="block truncate text-muted-foreground">{column.startLabel}</span>
              </div>
            ))}
            <div className="absolute inset-x-0 top-10 h-(--day-height) border-border border-b">
              {calendar.hourMarks.map((mark) => (
                <div
                  className="absolute inset-x-0 border-border/60 border-t"
                  key={mark.pct}
                  style={{ top: `${mark.pct}%` }}
                />
              ))}
              {calendar.breaks.map((gap) => (
                <div
                  className="absolute w-(--column-width) bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]"
                  key={`${gap.column}-${gap.topPct}`}
                  style={placement(gap.column, gap.topPct, gap.heightPct)}
                />
              ))}
              {continuations.map((segment) => (
                <div
                  className="absolute w-(--column-width) px-0.5"
                  key={`${segment.shift.id}-${segment.column}`}
                  style={placement(segment.column, segment.topPct, segment.heightPct)}
                >
                  <div
                    className={classnames(
                      'size-full overflow-hidden rounded-md border p-2 text-muted-foreground text-xs tabular-nums',
                      BLOCK_STATUS_CLASSES[segment.shift.status],
                      continuationClasses(segment),
                      segment.shift.id === selectedShiftId && 'ring-2 ring-ring',
                    )}
                  >
                    {formatShiftTime(segment.shift.plannedStartAt)}–
                    {formatShiftTime(segment.shift.plannedEndAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <ul
            aria-label="Shift calendar"
            className="grid gap-2 md:relative md:block md:h-(--day-height)"
          >
            {calendar.segments
              .filter((segment) => segment.primary)
              .map((segment) => (
                <li
                  className="md:absolute md:top-(--top) md:left-(--left) md:h-(--height) md:w-(--column-width) md:px-0.5"
                  key={segment.shift.id}
                  style={
                    {
                      '--left': `calc(${segment.column} * var(--column-width))`,
                      '--top': `${segment.topPct}%`,
                      '--height': `${segment.heightPct}%`,
                    } as CSSProperties
                  }
                >
                  <ShiftBlock
                    className={continuationClasses(segment)}
                    onSelect={() => onSelect(segment.shift.id)}
                    selected={segment.shift.id === selectedShiftId}
                    shift={segment.shift}
                  />
                </li>
              ))}
          </ul>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            <div className="absolute inset-x-0 top-10 h-(--day-height)">
              {calendar.expectedStart && (
                <div
                  className="absolute w-(--column-width) border-primary border-t-2 border-dashed"
                  style={placement(calendar.expectedStart.column, calendar.expectedStart.pct)}
                >
                  <span className="absolute right-1 bottom-0.5 rounded-sm bg-card px-1 text-primary text-xs">
                    Expected start
                  </span>
                </div>
              )}
              {calendar.now && (
                <div
                  className="absolute h-0.5 w-(--column-width) bg-destructive"
                  style={placement(calendar.now.column, calendar.now.pct)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type ShiftBlockProps = {
  shift: Shift
  selected: boolean
  onSelect: () => void
  className?: string
}

function ShiftBlock({ className, onSelect, selected, shift }: ShiftBlockProps) {
  const summaryId = useId()
  // A finished shift's trucks have all ended, so it counts the trucks it used rather than none.
  const truckCount =
    shift.status === 'COMPLETED'
      ? new Set(shift.trucks.map((truck) => truck.truckId)).size
      : currentTruckIds(shift).size
  // The same gap the preparation summary counts: a planned shift nobody has given a truck yet.
  const missingTrucks = shift.status === 'PLANNED' && truckCount === 0

  return (
    <button
      aria-describedby={summaryId}
      aria-label={`Shift ${formatShiftPeriod(shift)}`}
      aria-pressed={selected}
      className={classnames(
        // The scroll margin keeps a block scrolled into view clear of the sticky hour gutter.
        'size-full overflow-hidden rounded-md border p-2 text-left text-sm outline-none transition-colors hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:scroll-ml-16',
        BLOCK_STATUS_CLASSES[shift.status],
        selected && 'ring-2 ring-ring',
        className,
      )}
      onClick={onSelect}
      type="button"
    >
      <span
        className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:flex-nowrap md:items-start md:gap-1"
        id={summaryId}
      >
        <span className="flex items-center gap-2">
          {/* Without the calendar, a narrow screen reads the day from the shift itself. */}
          {shift.plannedStartAt && (
            <span className="whitespace-nowrap font-medium md:hidden">
              {formatShiftDay(new Date(shift.plannedStartAt))}
            </span>
          )}
          <span className="whitespace-nowrap font-medium tabular-nums">
            {formatShiftTime(shift.plannedStartAt)}–{formatShiftTime(shift.plannedEndAt)}
          </span>
          <ShiftStatusBadge status={shift.status} />
        </span>
        <span className="max-w-full truncate">
          {shift.responsible.firstName} {shift.responsible.lastName}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <TruckIcon aria-hidden="true" className="size-4 shrink-0" />
          <span aria-hidden="true">{truckCount}</span>
          {missingTrucks ? (
            <>
              <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
              <span className="sr-only">No truck selected</span>
            </>
          ) : (
            <span className="sr-only">{truckCount === 1 ? '1 truck' : `${truckCount} trucks`}</span>
          )}
        </span>
      </span>
    </button>
  )
}
