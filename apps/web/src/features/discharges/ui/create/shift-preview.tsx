import { useId } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatShiftDay,
  formatShiftPeriod,
  formatShiftTime,
} from '@/features/discharges/discharge-detail-view'
import {
  formatPreviewDay,
  type PreviewOccupancy,
  shiftPreview,
} from '@/features/discharges/shift-preview'
import { classnames } from '@/libraries/shadcn/helpers'

/** A day is never drawn narrower than this, so a long discharge scrolls inside the box instead. */
const MIN_DAY_REM = 5.5

type ShiftPreviewProps = {
  dockName: string
  vesselName: string
  expectedStartAt: string
  shifts: Array<{ plannedStartAt: string; plannedEndAt: string }>
  occupancy: {
    data: PreviewOccupancy[] | undefined
    loading: boolean
    /** Present when the occupancy failed to load. */
    onRetry?: () => void
  }
}

/** An instant as the preview's summary reads it: `Tue 22 Sept, 06:00`. */
function formatInstant(iso: string) {
  return `${formatShiftDay(new Date(iso))}, ${formatShiftTime(iso)}`
}

function placed({ leftPct, widthPct }: { leftPct: number; widthPct: number }) {
  return { left: `${leftPct}%`, width: `${widthPct}%` }
}

/**
 * Where the shifts being planned fall against the dock they need: the other discharges holding the
 * dock, when it frees up, the expected start, and each shift with the breaks between them. It only
 * informs: nothing here validates or holds the creation back.
 */
export function ShiftPreview({
  dockName,
  vesselName,
  expectedStartAt,
  shifts,
  occupancy,
}: ShiftPreviewProps) {
  const titleId = useId()
  const failed = occupancy.onRetry !== undefined
  const preview = shiftPreview({
    expectedStartAt,
    shifts,
    occupancy: occupancy.data && !failed ? occupancy.data : null,
  })
  const name = vesselName.trim()
  const unscheduledLabels = preview.unscheduled.map((number) => `Shift ${number} · no period yet`)
  // With no shift placed yet, the unplaced ones wait at the expected start, where they will begin;
  // otherwise they are named under the timeline.
  const inlineUnscheduled =
    unscheduledLabels.length > 0 && preview.shifts.length === 0 && preview.expectedStart !== null

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 text-card-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-semibold text-sm" id={titleId}>
            Shift preview
          </h2>
          <p className="text-muted-foreground text-sm">
            {[
              dockName,
              preview.freeFrom && `free from ${formatInstant(preview.freeFrom)}`,
              preview.expectedStart && `expected start ${formatInstant(preview.expectedStart.at)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <ul aria-label="Legend" className="flex flex-wrap gap-4 text-muted-foreground text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-3.5 rounded-sm border bg-muted" />
            Other discharge
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-3.5 rounded-sm border-[1.5px] border-primary border-dashed bg-primary/10"
            />
            Planned shift
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 border-primary border-l-2 border-dashed" />
            Expected start
          </li>
        </ul>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[minmax(7rem,11rem)_1fr]">
          <div className="flex flex-col pt-6">
            <div className="flex h-12 flex-col justify-center gap-0.5 border-t pr-3">
              <span className="font-semibold text-sm">Dock</span>
              <span className="truncate text-muted-foreground text-xs">{dockName}</span>
            </div>
            <div className="flex h-12 flex-col justify-center gap-0.5 border-t pr-3">
              <span className="truncate font-semibold text-sm">{name || 'This discharge'}</span>
              <span className="truncate text-muted-foreground text-xs">
                {preview.summary
                  ? `${preview.summary.count} ${preview.summary.count === 1 ? 'shift' : 'shifts'} · ${preview.summary.duration}`
                  : name && 'This discharge'}
              </span>
            </div>
          </div>

          <div className="relative" style={{ minWidth: `${preview.days.length * MIN_DAY_REM}rem` }}>
            <div aria-hidden="true" className="flex h-6 items-center">
              {preview.days.map((day) => (
                <span className="flex-1 pl-2 text-muted-foreground text-xs" key={day.start}>
                  {day.label}
                </span>
              ))}
            </div>

            <div className="relative h-12 border-t">
              <DayLines count={preview.days.length} />
              {occupancy.loading ? (
                <Skeleton className="absolute inset-x-0 top-2.5 h-7" />
              ) : failed ? (
                <Alert className="absolute inset-x-1 top-1 flex items-center justify-between gap-3 py-1.5">
                  <AlertDescription>Dock occupancy is unavailable.</AlertDescription>
                  <Button onClick={occupancy.onRetry} size="sm" type="button" variant="outline">
                    Retry
                  </Button>
                </Alert>
              ) : (
                <ul aria-label="Dock occupancy" className="absolute inset-0">
                  {preview.occupancies.map((item) => (
                    <li
                      className={classnames(
                        'absolute top-2.5 flex h-7 items-center gap-1.5 overflow-hidden whitespace-nowrap border bg-muted px-2.5 text-xs',
                        item.clippedStart ? 'border-l-0' : 'rounded-l-md',
                        item.clippedEnd ? 'border-r-0' : 'rounded-r-md',
                      )}
                      key={item.discharge.id}
                      style={placed(item)}
                      title={`${item.discharge.vesselName}, until ${formatInstant(item.endAt)}`}
                    >
                      <span className="font-semibold">{item.discharge.vesselName}</span>
                      <span className="text-muted-foreground">
                        until {formatPreviewDay(item.endAt)}, {formatShiftTime(item.endAt)}
                      </span>
                    </li>
                  ))}
                  {preview.freeGaps.map((gap) => (
                    <li
                      className="absolute top-2.5 flex h-7 items-center justify-center overflow-hidden whitespace-nowrap text-success text-xs"
                      key={gap.leftPct}
                      style={placed(gap)}
                    >
                      Dock free
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative h-12 border-t">
              <DayLines count={preview.days.length} />
              {preview.breaks.map((gap) => (
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 h-5 bg-[repeating-linear-gradient(135deg,var(--color-border)_0_1px,transparent_1px_6px)]"
                  data-testid="shift-break"
                  key={gap.leftPct}
                  style={placed(gap)}
                />
              ))}
              <ul aria-label="Planned shifts of this discharge" className="absolute inset-0">
                {preview.shifts.map((block) => (
                  <li
                    aria-label={`Shift ${block.number}, ${formatShiftPeriod({ plannedStartAt: block.startAt, plannedEndAt: block.endAt })}`}
                    className="absolute top-2.5 flex h-7 min-w-5 items-center justify-center overflow-hidden rounded-sm border-[1.5px] border-primary border-dashed bg-primary/15 font-semibold text-xs tabular-nums"
                    key={block.number}
                    style={placed(block)}
                    title={`Shift ${block.number}`}
                  >
                    <span aria-hidden="true">{block.number}</span>
                  </li>
                ))}
                {inlineUnscheduled && preview.expectedStart && (
                  <li
                    className="absolute top-2.5 flex h-7 items-center gap-2 whitespace-nowrap text-xs"
                    style={{ left: `${preview.expectedStart.leftPct}%` }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-7 w-8 rounded-sm border-[1.5px] border-primary border-dashed bg-primary/10"
                    />
                    {unscheduledLabels.join(', ')}
                  </li>
                )}
              </ul>
            </div>

            {preview.expectedStart && (
              <div
                aria-label={`Expected start ${formatInstant(preview.expectedStart.at)}`}
                className="pointer-events-none absolute top-0 bottom-0"
                role="img"
                style={{ left: `${preview.expectedStart.leftPct}%` }}
              >
                <span className="absolute top-0 left-0 flex h-4.5 items-center whitespace-nowrap rounded-r-sm bg-primary px-1.5 font-semibold text-[0.6875rem] text-primary-foreground">
                  Expected start {formatShiftTime(preview.expectedStart.at)}
                </span>
                <span className="absolute top-4.5 bottom-0 left-0 border-primary border-l-2 border-dashed" />
              </div>
            )}
          </div>
        </div>
      </div>

      {unscheduledLabels.length > 0 && !inlineUnscheduled && (
        <p className="text-muted-foreground text-xs">{unscheduledLabels.join(', ')}</p>
      )}
    </section>
  )
}

function DayLines({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one line per day, in order
        <span className="flex-1 border-l" key={index} />
      ))}
    </div>
  )
}
