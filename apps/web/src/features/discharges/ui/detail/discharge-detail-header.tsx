import type { ReactNode, Ref } from 'react'

import { formatTonnes } from '@/features/discharges/discharge-detail-view'
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
}

/** What stays in view whichever section is open: which discharge this is, and where it stands. */
export function DischargeDetailHeader({
  discharge,
  actions,
  headingRef,
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
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground text-sm">
            <div className="flex items-baseline gap-1.5">
              <dt>Dock</dt>
              <dd className="font-medium text-foreground">
                <ReferenceLabel name={discharge.dock.name} status={discharge.dock.status} />
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>Expected start</dt>
              <dd className="font-medium text-foreground">
                {formatDateTime(discharge.expectedStartAt)}
              </dd>
            </div>
            {discharge.startedAt && (
              <div className="flex items-baseline gap-1.5">
                <dt>Started</dt>
                <dd className="font-medium text-foreground">
                  {formatDateTime(discharge.startedAt)}
                  {discharge.startedBy &&
                    ` by ${discharge.startedBy.firstName} ${discharge.startedBy.lastName}`}
                </dd>
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <dt>Expected tonnage</dt>
              <dd className="font-medium text-foreground tabular-nums">
                {formatTonnes(discharge.expectedTonnage)}
              </dd>
            </div>
          </dl>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
