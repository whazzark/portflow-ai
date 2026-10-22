import { Link } from '@tanstack/react-router'
import { TriangleAlertIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

import { tabSearch } from '@/features/discharges/discharge-detail-sections'
import { formatShiftDuration, formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
  type DockTimeline,
  dockTimeline,
  type TimelineOccupation,
} from '@/features/discharges/dock-timeline'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { DischargeStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

/** The Preparation card's Dock row brings focus here. */
export const DOCK_TIMELINE_ID = 'dock-timeline'

const iso = (instant: number) => new Date(instant).toISOString()

/** A gap's or a period's length, as a shift's length is written. */
function duration(startAt: number, endAt: number) {
  return formatShiftDuration({ plannedStartAt: iso(startAt), plannedEndAt: iso(endAt) })
}

function occupationPeriod(occupation: TimelineOccupation) {
  if (occupation.pointOnly) {
    return `Expected ${formatDateTime(iso(occupation.startAt))} · no shift planned`
  }
  if (occupation.endAt === null) {
    return `Since ${formatDateTime(iso(occupation.startAt))} · continues`
  }

  return formatShiftPeriod({
    plannedStartAt: iso(occupation.startAt),
    plannedEndAt: iso(occupation.endAt),
  })
}

/** Placed by its share of the span, so the strip stays proportional at any width. */
function placed(from: number, to = from): CSSProperties {
  return { left: `${from * 100}%`, width: `${Math.max(to - from, 0) * 100}%` }
}

function Strip({ timeline }: { timeline: DockTimeline }) {
  return (
    // Drawn for the eye only: the lists beside it say the same in words, links included.
    <div aria-hidden="true" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="relative grid min-w-[36rem] gap-2 py-6">
        <div className="relative h-7 rounded-md bg-muted">
          {timeline.occupations
            .filter((occupation) => !occupation.outsideSpan)
            .map((occupation) => (
              <div
                className={classnames(
                  'absolute inset-y-0 truncate rounded-md border px-2 text-xs leading-7',
                  occupation.pointOnly && 'min-w-1 px-0',
                  occupation.overlapsPlannedPeriod
                    ? 'border-warning bg-warning/15 text-foreground'
                    : 'border-border bg-background text-muted-foreground',
                  occupation.clippedStart && 'rounded-l-none',
                  occupation.clippedEnd && 'rounded-r-none',
                )}
                key={occupation.dischargeId}
                style={placed(occupation.from, occupation.to)}
              >
                {occupation.pointOnly ? null : occupation.vesselName}
              </div>
            ))}
        </div>
        <div className="relative h-7">
          {timeline.gaps.map((gap) => (
            <div
              className="absolute inset-y-1 truncate border-muted-foreground/40 border-y border-dashed text-center text-muted-foreground text-xs leading-5"
              key={gap.startAt}
              style={placed(gap.from, gap.to)}
            >
              {duration(gap.startAt, gap.endAt)}
            </div>
          ))}
          {timeline.shifts.map((shift) => (
            <div
              className="absolute inset-y-0 rounded-md bg-primary"
              key={shift.id}
              style={placed(shift.from, shift.to)}
            />
          ))}
        </div>
        <Marker label="Expected start" position={timeline.expectedStart.position} />
        {timeline.now.kind === 'INSIDE' && (
          <Marker emphasis label="Now" position={timeline.now.position} />
        )}
      </div>
    </div>
  )
}

function Marker({
  label,
  position,
  emphasis = false,
}: {
  label: string
  position: number
  emphasis?: boolean
}) {
  return (
    <div className="absolute inset-y-0 w-px" style={{ left: `${position * 100}%` }}>
      <div className={classnames('h-full w-px', emphasis ? 'bg-indicator' : 'bg-foreground/40')} />
      <span
        className={classnames(
          'absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs',
          emphasis ? 'font-medium text-indicator' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

/**
 * How the dock of a planned discharge is promised around its plan: the other discharges holding or
 * expecting it, now, the expected start, this discharge's shifts, and the gaps between them. It reads
 * the plan and passes no verdict: whether a held dock blocks the start is the start check's to say.
 */
export function DockTimelineCard({
  discharge,
  now,
}: {
  discharge: DischargeDetailDto
  now: number
}) {
  const timeline = dockTimeline(discharge, now)

  return (
    <DetailSection id={DOCK_TIMELINE_ID} title={`Dock ${discharge.dock.name}`}>
      <div className="grid gap-4">
        <Strip timeline={timeline} />

        {timeline.dockFree && (
          <p className="text-muted-foreground">The dock is free over this period.</p>
        )}
        {timeline.occupations.length > 0 && (
          <ul aria-label="Other discharges on this dock" className="grid gap-2">
            {timeline.occupations.map((occupation) => (
              <li
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
                key={occupation.dischargeId}
              >
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  from="/discharges/$dischargeId"
                  params={{ dischargeId: occupation.dischargeId }}
                  // The list state the way back restores is kept, as between two sections.
                  search={(previous) => ({ ...previous, ...tabSearch('overview') })}
                  to="/discharges/$dischargeId"
                >
                  {occupation.vesselName}
                </Link>
                <DischargeStatusBadge status={occupation.status} />
                <span className="text-muted-foreground">{occupationPeriod(occupation)}</span>
                {occupation.outsideSpan && (
                  <span className="text-muted-foreground">
                    {occupation.outsideSpan === 'BEFORE'
                      ? 'Ends before this period'
                      : 'Starts after this period'}
                  </span>
                )}
                {occupation.overlapsPlannedPeriod && (
                  <span className="inline-flex items-center gap-1.5">
                    <TriangleAlertIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-warning"
                    />
                    Overlaps this plan
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <ol aria-label="This discharge on the dock" className="grid gap-1 text-muted-foreground">
          {timeline.now.kind === 'INSIDE' ? (
            <li className="sr-only">Now, {formatDateTime(iso(timeline.now.at))}</li>
          ) : (
            <li>
              {timeline.now.kind === 'BEFORE'
                ? 'Now is before this period.'
                : 'Now is after this period.'}
            </li>
          )}
          <li className="sr-only">
            Expected start, {formatDateTime(iso(timeline.expectedStart.at))}
          </li>
          {timeline.shifts.length > 0 ? (
            timeline.shifts.map((shift, index) => {
              // Named once, before the first shift that closes it, however many start together.
              const gap =
                timeline.shifts[index - 1]?.startAt === shift.startAt
                  ? undefined
                  : timeline.gaps.find((candidate) => candidate.endAt === shift.startAt)

              return [
                gap && (
                  <li key={`gap-${gap.startAt}`}>
                    Gap of {duration(gap.startAt, gap.endAt)} before the next shift
                  </li>
                ),
                <li className="sr-only" key={shift.id}>
                  Shift{' '}
                  {formatShiftPeriod({
                    plannedStartAt: iso(shift.startAt),
                    plannedEndAt: iso(shift.endAt),
                  })}
                </li>,
              ]
            })
          ) : (
            <li>No shift planned</li>
          )}
        </ol>
      </div>
    </DetailSection>
  )
}
