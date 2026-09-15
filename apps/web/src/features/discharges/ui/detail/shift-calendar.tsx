import { DoorOpenIcon, ScaleIcon, TriangleAlertIcon, TruckIcon, UserIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useRef } from 'react'

import {
  formatShiftDay,
  formatShiftDuration,
  formatShiftPeriod,
  formatShiftTime,
  shiftResources,
} from '@/features/discharges/discharge-detail-view'
import { blockRowCount, defaultShiftId, shiftCalendar } from '@/features/discharges/shift-calendar'
import { missingTrucks } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import {
  SHIFT_STATUS_LABELS,
  ShiftStatusBadge,
} from '@/features/discharges/ui/detail/discharge-status-badge'
import { classnames } from '@/libraries/shadcn/helpers'

type Shift = DischargeDetailDto['shifts'][number]

/** The narrowest a column gets: wide enough for a shift's times and status badge side by side. */
const MIN_COLUMN_WIDTH_PX = 176
/** Tall enough per hour for a four-hour shift to show every line of its card. */
const HOUR_HEIGHT_PX = 32

// Work under way stands out; what is prepared reads plainly and what is finished recedes. The
// status badge inside carries the meaning, so the colour is never the only signal. Every fill is
// opaque, so the hour lines beneath never show through a shift.
const BLOCK_STATUS_CLASSES = {
  PLANNED: 'bg-card',
  ACTIVE: 'border-primary bg-[color-mix(in_oklab,var(--color-primary)_10%,var(--color-card))]',
  COMPLETED: 'bg-muted text-muted-foreground',
} as const satisfies Record<Shift['status'], string>

/**
 * The chosen shift, marked within its own bounds so it never spills over a neighbour. The padding
 * gives back the thicker border's pixel, so the content holds still when a shift is chosen.
 */
const SELECTED_BLOCK_CLASSES = 'border-2 border-ring p-[7px]'

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
  /** The shift open in the panel; none while the panel is closed. */
  selectedShiftId: string | null
  onSelect: (shiftId: string) => void
}

/**
 * The discharge's shifts over a week at least, one column per day from midnight to midnight, with
 * the breaks between them. On a narrow screen the same shifts stack as a list and no calendar is
 * drawn, so there is one set of controls whatever the width.
 */
export function ShiftCalendar({ discharge, onSelect, selectedShiftId }: ShiftCalendarProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const calendar = shiftCalendar(discharge, discharge.status === 'ACTIVE' ? new Date() : undefined)

  // A shared address may open a shift lying past the visible columns; without one, the shift under
  // way or next to prepare is the one worth finding.
  const shiftInView = selectedShiftId ?? defaultShiftId(discharge.shifts)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only where the page opens, never as shifts are chosen
  useEffect(() => {
    scroller.current
      ?.querySelector(`[data-shift-id="${shiftInView}"]`)
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [])

  if (!calendar) {
    return null
  }

  const continuations = calendar.segments.filter((segment) => !segment.primary)

  return (
    <div className="md:-mx-1 md:overflow-x-auto md:px-1 md:pb-2" ref={scroller}>
      <div
        className="md:flex md:min-w-max"
        style={
          {
            // Resolved by each element placed within the columns, against the columns' own width,
            // so the columns share whatever width the card gives beyond their minimum.
            '--column-width': `calc(100% / ${calendar.columns.length})`,
            '--day-height': `${24 * HOUR_HEIGHT_PX}px`,
            '--days-width': `${calendar.columns.length * MIN_COLUMN_WIDTH_PX}px`,
          } as CSSProperties
        }
      >
        {/* Stays in view while the columns scroll sideways, its fill reaching over the scroller's
            padding so nothing scrolled past shows beside the hours. */}
        <div
          aria-hidden="true"
          className="sticky left-0 z-10 hidden w-14 shrink-0 bg-card pt-10 before:absolute before:inset-y-0 before:-left-1 before:w-1 before:bg-card md:block"
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
        <div className="md:relative md:min-w-(--days-width) md:flex-1 md:pt-10">
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
                <span className="block truncate font-medium">{column.startLabel}</span>
                {column.label && (
                  <span className="block truncate text-muted-foreground">{column.label}</span>
                )}
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
              {/* Beneath the shifts, so it never crosses the text of one planned over it. */}
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
              {continuations.map((segment) => (
                <div
                  className={classnames(
                    'absolute w-(--column-width) px-0.5',
                    !segment.continuesToNext && 'pb-0.5',
                  )}
                  key={`${segment.shift.id}-${segment.column}`}
                  style={placement(segment.column, segment.topPct, segment.heightPct)}
                >
                  <div
                    className={classnames(
                      'size-full overflow-hidden rounded-md border p-2 text-muted-foreground text-xs tabular-nums',
                      BLOCK_STATUS_CLASSES[segment.shift.status],
                      segment.shift.id === selectedShiftId && SELECTED_BLOCK_CLASSES,
                      continuationClasses(segment),
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
                // Shifts back to back keep the same small gap between them as between columns,
                // except where one runs on past midnight.
                <li
                  className={classnames(
                    'md:absolute md:top-(--top) md:left-(--left) md:h-(--height) md:w-(--column-width) md:px-0.5 md:pt-0.5',
                    !segment.continuesToNext && 'md:pb-0.5',
                  )}
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
                    rowCount={blockRowCount((segment.heightPct / 100) * 24 * HOUR_HEIGHT_PX)}
                    selected={segment.shift.id === selectedShiftId}
                    shift={segment.shift}
                  />
                </li>
              ))}
          </ul>
          {/* Above the shifts, to show how far the one under way has gone. */}
          {calendar.now && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden md:block"
            >
              <div className="absolute inset-x-0 top-10 h-(--day-height)">
                <div
                  className="absolute h-0.5 w-(--column-width) bg-destructive"
                  style={placement(calendar.now.column, calendar.now.pct)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type ShiftBlockProps = {
  shift: Shift
  /** How many of the card's lines fit its height on the calendar; a stacked list shows them all. */
  rowCount: number
  selected: boolean
  onSelect: () => void
  className?: string
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** One kind of resource on a card's resource line: its icon and how many the shift uses. */
function ResourceCount({ count, icon: Icon }: { count: number; icon: typeof TruckIcon }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      {count}
    </span>
  )
}

function ShiftBlock({ className, onSelect, rowCount, selected, shift }: ShiftBlockProps) {
  const summaryId = useId()
  const resources = shiftResources(shift)
  const truckCount = resources.truckIds.length
  const duration = formatShiftDuration(shift)
  const lacksTrucks = missingTrucks(shift)
  // A line past what the card's height holds is left out of the calendar, never of the list.
  const row = (index: number) => (index < rowCount ? 'flex' : 'flex md:hidden')

  return (
    <button
      aria-describedby={summaryId}
      aria-label={`Shift ${formatShiftPeriod(shift)}`}
      aria-pressed={selected}
      data-shift-id={shift.id}
      className={classnames(
        // The scroll margin keeps a block scrolled into view clear of the sticky hour gutter.
        'flex size-full items-start overflow-hidden rounded-md border p-2 text-left text-sm outline-none transition-colors hover:border-ring focus-visible:inset-ring-3 focus-visible:inset-ring-ring/50 md:scroll-ml-16',
        BLOCK_STATUS_CLASSES[shift.status],
        // A planned shift nobody has given a truck yet is the gap to see from afar.
        lacksTrucks && 'border-warning',
        selected && SELECTED_BLOCK_CLASSES,
        className,
      )}
      onClick={onSelect}
      type="button"
    >
      {/* The whole summary, whatever the card's height leaves visible. */}
      <span className="sr-only" id={summaryId}>
        {[
          SHIFT_STATUS_LABELS[shift.status],
          duration,
          `${shift.responsible.firstName} ${shift.responsible.lastName}`,
          plural(truckCount, 'truck'),
          plural(resources.warehouseDoors.length, 'warehouse door'),
          plural(resources.weighingAreas.length, 'weighing area'),
          lacksTrucks && 'No truck selected',
        ]
          .filter(Boolean)
          .join(', ')}
      </span>
      <span
        aria-hidden="true"
        className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 md:flex-col md:flex-nowrap md:items-start md:gap-1"
      >
        <span className={classnames(row(0), 'h-5 items-center gap-2 whitespace-nowrap')}>
          {/* Without the calendar, a narrow screen reads the day from the shift itself. */}
          {shift.plannedStartAt && (
            <span className="font-medium md:hidden">
              {formatShiftDay(new Date(shift.plannedStartAt))}
            </span>
          )}
          <span className="font-medium tabular-nums">
            {formatShiftTime(shift.plannedStartAt)}–{formatShiftTime(shift.plannedEndAt)}
          </span>
          {duration && <span className="text-muted-foreground text-xs">· {duration}</span>}
        </span>
        <span className={classnames(row(1), 'h-5 items-center gap-2')}>
          <ShiftStatusBadge status={shift.status} />
          {lacksTrucks && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-warning text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" />
              No truck
            </span>
          )}
        </span>
        <span className={classnames(row(2), 'h-5 max-w-full items-center gap-1.5')}>
          <UserIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {shift.responsible.firstName} {shift.responsible.lastName}
          </span>
        </span>
        {/* Counts only, side by side: the names are the panel's, and a narrow column has no room. */}
        <span className={classnames(row(3), 'h-5 items-center gap-4 tabular-nums')}>
          <ResourceCount count={truckCount} icon={TruckIcon} />
          <ResourceCount count={resources.warehouseDoors.length} icon={DoorOpenIcon} />
          <ResourceCount count={resources.weighingAreas.length} icon={ScaleIcon} />
        </span>
      </span>
    </button>
  )
}
