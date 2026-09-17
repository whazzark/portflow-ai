import {
  CoffeeIcon,
  DoorOpenIcon,
  ScaleIcon,
  TriangleAlertIcon,
  TruckIcon,
  UserIcon,
} from 'lucide-react'
import {
  type CSSProperties,
  Fragment,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  formatShiftDay,
  formatShiftDuration,
  formatShiftPeriod,
  formatShiftTime,
  shiftResources,
} from '@/features/discharges/discharge-detail-view'
import type { DrawnShiftPeriod } from '@/features/discharges/discharge-preparation-schema'
import {
  blockRowCount,
  DRAW_STEP_MINUTES,
  defaultShiftId,
  drawnPeriod,
  shiftCalendar,
} from '@/features/discharges/shift-calendar'
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
/** The height of a break's badge; a shorter break reads a compact one, spilling over no text. */
const BREAK_BADGE_MIN_PX = 20

const breakLabel = (duration: string) => `${duration} break`

/**
 * How long the responsible rests between two shifts. A compact badge still fits within the padding
 * of the cards around the break, so however short the break, it never covers a shift's text.
 */
function BreakBadge({ compact = false, label }: { compact?: boolean; label: string }) {
  return (
    <Badge
      className={classnames(
        'bg-card text-muted-foreground tabular-nums',
        compact && 'h-4 px-1.5 py-0 text-[11px] [&>svg]:size-2.5!',
      )}
      variant="outline"
    >
      <CoffeeIcon aria-hidden="true" />
      {label}
    </Badge>
  )
}

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
  /** Called with a period drawn over the columns; without it, nothing can be drawn. */
  onDraw?: (period: DrawnShiftPeriod) => void
}

/** The time between two instants, as a shift's times read. */
const formatTimes = (start: number, end: number) =>
  `${formatShiftTime(new Date(start).toISOString())}–${formatShiftTime(new Date(end).toISOString())}`

/**
 * The discharge's shifts over a week at least, one column per day from midnight to midnight, with
 * the breaks between them. On a narrow screen the same shifts stack as a list and no calendar is
 * drawn, so there is one set of controls whatever the width.
 */
export function ShiftCalendar({
  discharge,
  onDraw,
  onSelect,
  selectedShiftId,
}: ShiftCalendarProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const dayArea = useRef<HTMLDivElement>(null)
  // The instants a gesture pressed and has reached so far, while it draws a period.
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null)
  const drawing = draft !== null
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

  useEffect(() => {
    if (!drawing) {
      return
    }
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft(null)
      }
    }
    window.addEventListener('keydown', cancel)

    return () => window.removeEventListener('keydown', cancel)
  }, [drawing])

  if (!calendar) {
    return null
  }

  // Where a pointer stands over the columns, as an instant snapped to the drawing step, and whether
  // it stands within the day rather than over the column headings.
  const pointAt = (event: ReactPointerEvent) => {
    const area = dayArea.current?.getBoundingClientRect()
    if (!area || area.width === 0 || area.height === 0) {
      return null
    }
    const y = event.clientY - area.top
    const column = Math.floor(((event.clientX - area.left) / area.width) * calendar.columns.length)

    return {
      instant: calendar.instantAt(column, (y / area.height) * 100),
      withinDay: y >= 0 && y <= area.height,
    }
  }

  // Drawn with a mouse or a pen only: a finger dragging over the calendar scrolls it, and adds
  // through the section's button like a keyboard does.
  const startDrawing = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !onDraw ||
      event.button !== 0 ||
      event.pointerType === 'touch' ||
      (event.target instanceof Element &&
        event.target.closest('button, [data-slot="tooltip-trigger"]'))
    ) {
      return
    }
    const point = pointAt(event)
    if (!point?.withinDay) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraft({ from: point.instant, to: point.instant })
  }

  const extendDrawing = (event: ReactPointerEvent) => {
    const point = pointAt(event)
    if (draft && point) {
      setDraft({ ...draft, to: point.instant })
    }
  }

  const finishDrawing = (event: ReactPointerEvent) => {
    if (!draft || !onDraw) {
      return
    }
    setDraft(null)
    // A press released where it began lasts as long as the last shift, as the next one added does.
    const last = discharge.shifts.at(-1)
    const lastDuration =
      last?.plannedStartAt && last.plannedEndAt
        ? Date.parse(last.plannedEndAt) - Date.parse(last.plannedStartAt)
        : null
    onDraw(drawnPeriod(draft.from, pointAt(event)?.instant ?? draft.to, lastDuration))
  }

  // Shown a step long at least, so a press still marks where the shift will start.
  const draftPeriod = draft && {
    start: Math.min(draft.from, draft.to),
    end: Math.max(
      draft.from,
      draft.to,
      Math.min(draft.from, draft.to) + DRAW_STEP_MINUTES * 60_000,
    ),
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
        {/* A period drawn over the columns opens the addition with it; a pointer shortcut only, as the
            section's `Add shift` button stays the way to add from a keyboard or a finger. */}
        <div
          className={classnames(
            'md:relative md:min-w-(--days-width) md:flex-1 md:pt-10',
            onDraw && 'md:cursor-crosshair',
            drawing && 'select-none',
          )}
          onPointerCancel={() => setDraft(null)}
          onPointerDown={startDrawing}
          onPointerMove={draft ? extendDrawing : undefined}
          onPointerUp={finishDrawing}
        >
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
            <div
              className="absolute inset-x-0 top-10 h-(--day-height) border-border border-b"
              ref={dayArea}
            >
              {calendar.hourMarks.map((mark) => (
                <div
                  className="absolute inset-x-0 border-border/60 border-t"
                  key={mark.pct}
                  style={{ top: `${mark.pct}%` }}
                />
              ))}
              {calendar.breaks.map((gap) => (
                <div
                  className="absolute w-(--column-width) bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)] bg-muted/40"
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
              .map((segment) => {
                const gap = calendar.breaks.find(
                  (candidate) => candidate.labelled && candidate.shiftId === segment.shift.id,
                )

                return (
                  <Fragment key={segment.shift.id}>
                    {/* The break before a shift, between the cards of the stacked list; the
                        calendar draws it, so there it is only read out. */}
                    {gap && (
                      <li className="flex items-center gap-2 md:sr-only">
                        <span
                          aria-hidden="true"
                          className="h-px flex-1 border-border border-t border-dashed"
                        />
                        <BreakBadge label={breakLabel(gap.duration)} />
                        <span
                          aria-hidden="true"
                          className="h-px flex-1 border-border border-t border-dashed"
                        />
                      </li>
                    )}
                    {/* Shifts back to back keep the same small gap between them as between
                        columns, except where one runs on past midnight. */}
                    <li
                      className={classnames(
                        'md:absolute md:top-(--top) md:left-(--left) md:h-(--height) md:w-(--column-width) md:px-0.5 md:pt-0.5',
                        !segment.continuesToNext && 'md:pb-0.5',
                      )}
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
                  </Fragment>
                )
              })}
          </ul>
          {/* Above the shifts, so a break shorter than its badge still reads its duration, spilling
              only into the padding of the cards around it. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            <div className="absolute inset-x-0 top-10 h-(--day-height)">
              {calendar.breaks
                .filter((gap) => gap.labelled)
                .map((gap) => (
                  <div
                    className="absolute flex w-(--column-width) items-center justify-center"
                    key={`${gap.column}-${gap.topPct}`}
                    style={placement(gap.column, gap.topPct, gap.heightPct)}
                  >
                    {/* Explained on hover only: the list item before the next shift already reads
                        the break to assistive technology, so the badge takes no focus. */}
                    <Tooltip>
                      <TooltipTrigger
                        className="pointer-events-auto cursor-default"
                        render={<span />}
                      >
                        <BreakBadge
                          compact={(gap.heightPct / 100) * 24 * HOUR_HEIGHT_PX < BREAK_BADGE_MIN_PX}
                          label={gap.duration}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="flex-col items-start">
                        <span className="font-medium tabular-nums">
                          Break · {formatTimes(gap.start, gap.end)}
                        </span>
                        <span>Time between the end of a shift and the start of the next one.</span>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
            </div>
          </div>
          {/* Above the shifts, as it may be drawn over one: the form then names the overlap. */}
          {draftPeriod && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden md:block"
            >
              <div className="absolute inset-x-0 top-10 h-(--day-height)">
                {calendar.periodPieces(draftPeriod.start, draftPeriod.end).map((piece, index) => (
                  <div
                    className="absolute w-(--column-width) px-0.5"
                    key={piece.column}
                    style={placement(piece.column, piece.topPct, piece.heightPct)}
                  >
                    <div className="size-full overflow-hidden rounded-md border-2 border-primary border-dashed bg-[color-mix(in_oklab,var(--color-primary)_8%,var(--color-card))] p-2 font-medium text-primary text-xs tabular-nums">
                      {index === 0 && formatTimes(draftPeriod.start, draftPeriod.end)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  // Only a planned shift has gaps; a started one reads `null`.
  const gapCount = shift.readinessGaps?.length ?? 0
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
        // A planned shift still lacking something to start is what to see from afar.
        gapCount > 0 && 'border-warning',
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
          gapCount > 0 && plural(gapCount, 'gap'),
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
          {gapCount > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-warning text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" />
              {plural(gapCount, 'gap')}
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
