import type { ReactNode, Ref } from 'react'

import {
  formatShiftPeriod,
  formatTonnes,
  plannedPeriod,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { BackToDischargesLink } from '@/features/discharges/ui/detail/back-to-discharges-link'
import { DischargeStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { formatDateTime } from '@/helpers/dates'

type DischargeDetailHeaderProps = {
  discharge: DischargeDetailDto
  /** Actions on the whole discharge, such as starting it, beside its name. */
  actions?: ReactNode
  /** Where focus goes when an action removes itself, as starting the discharge does. */
  headingRef?: Ref<HTMLHeadingElement>
  /** The vessel comment, under the facts; the page passes it only where the overview is open. */
  comment?: string | null
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  )
}

/**
 * A planned discharge is read by when it is planned to work, not only when it is expected: the span
 * of its shifts, or its expected start while no shift says more.
 */
function PlannedPeriod({ discharge }: { discharge: DischargeDetailDto }) {
  const period = plannedPeriod(discharge.shifts)

  if (!period) {
    return (
      <>
        {formatDateTime(discharge.expectedStartAt)}{' '}
        <span className="font-normal text-muted-foreground">· No shift planned</span>
      </>
    )
  }

  return <>{formatShiftPeriod(period)}</>
}

/** What stays in view whichever section is open: which discharge this is, and where it stands. */
export function DischargeDetailHeader({
  discharge,
  actions,
  headingRef,
  comment,
}: DischargeDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <BackToDischargesLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          {/* Visible, unlike the list's: the breadcrumb names the vessel, but only the heading
              carries the discharge's status beside it. */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-semibold text-2xl outline-none" ref={headingRef} tabIndex={-1}>
              {discharge.vesselName}
            </h1>
            <DischargeStatusBadge status={discharge.status} />
          </div>
          {/* Labelled on screen: a bare dock name or tonnage does not say what it is at a glance.
              The values carry the weight, so the eye lands on them rather than on the labels. */}
          <dl
            aria-label="Discharge facts"
            className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-sm"
          >
            <Fact label="Dock">
              <ReferenceLabel name={discharge.dock.name} status={discharge.dock.status} />
            </Fact>
            {discharge.status === 'PLANNED' ? (
              <>
                <Fact label="Planned period">
                  <PlannedPeriod discharge={discharge} />
                </Fact>
                <Fact label="IMO">
                  {discharge.vesselImo ?? (
                    <span className="font-normal text-muted-foreground italic">Not specified</span>
                  )}
                </Fact>
              </>
            ) : (
              <>
                <Fact label="Expected start">{formatDateTime(discharge.expectedStartAt)}</Fact>
                {discharge.startedAt && (
                  <Fact label="Started">
                    {formatDateTime(discharge.startedAt)}
                    {discharge.startedBy &&
                      ` by ${discharge.startedBy.firstName} ${discharge.startedBy.lastName}`}
                  </Fact>
                )}
              </>
            )}
            <Fact label="Expected tonnage">
              <span className="tabular-nums">{formatTonnes(discharge.expectedTonnage)}</span>
            </Fact>
          </dl>
          {comment && <p className="max-w-prose text-muted-foreground text-sm">{comment}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
