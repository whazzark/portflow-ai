import type { ReactNode } from 'react'

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { splitPeriods } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { ShiftStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { EffectivePeriod } from '@/features/discharges/ui/detail/effective-period'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { formatDateTime } from '@/helpers/dates'

type Shift = DischargeDetailDto['shifts'][number]
type Period = { id: string; effectiveFrom: string | null; effectiveTo: string | null }

type ResourceGroupProps<T extends Period> = {
  dischargeStatus: DischargeDetailDto['status']
  label: string
  periods: T[]
  renderResource: (period: T) => ReactNode
}

function ResourceGroup<T extends Period>({
  dischargeStatus,
  label,
  periods,
  renderResource,
}: ResourceGroupProps<T>) {
  const { inEffect, ended } = splitPeriods(periods, dischargeStatus)

  return (
    <div className="grid content-start gap-1">
      <h4 className="text-muted-foreground">{label}</h4>
      {periods.length > 0 ? (
        <ul aria-label={label} className="grid gap-1">
          {[...inEffect, ...ended].map((period) => (
            <li className="grid gap-0.5" key={period.id}>
              {renderResource(period)}
              <EffectivePeriod dischargeStatus={dischargeStatus} period={period} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">None selected</p>
      )}
    </div>
  )
}

function plannedPeriod(shift: Shift) {
  return `${formatDateTime(shift.plannedStartAt)} – ${formatDateTime(shift.plannedEndAt)}`
}

type DischargeShiftsCardProps = {
  discharge: DischargeDetailDto
}

export function DischargeShiftsCard({ discharge }: DischargeShiftsCardProps) {
  return (
    <DetailSection title="Shifts">
      {discharge.shifts.length > 0 ? (
        <div className="grid gap-4">
          {discharge.shifts.map((shift) => (
            // A shift is known to users by its planned period, never by an internal number.
            <article
              aria-label={`Shift ${plannedPeriod(shift)}`}
              className="grid gap-3 rounded-lg border p-4"
              key={shift.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{plannedPeriod(shift)}</h3>
                  <ShiftStatusBadge status={shift.status} />
                </div>
                <span>
                  <span className="text-muted-foreground">Responsible: </span>
                  {shift.responsible.firstName} {shift.responsible.lastName}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ResourceGroup
                  dischargeStatus={discharge.status}
                  label="Trucks"
                  periods={shift.trucks}
                  renderResource={(truck) => (
                    <ReferenceLabel name={truck.registration} status={truck.truckStatus} />
                  )}
                />
                <ResourceGroup
                  dischargeStatus={discharge.status}
                  label="Warehouse doors"
                  periods={shift.warehouseDoors}
                  renderResource={(membership) => (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <ReferenceLabel
                        name={membership.warehouse.name}
                        status={membership.warehouse.status}
                      />
                      {' › '}
                      <ReferenceLabel
                        name={membership.warehouseDoor.name}
                        status={membership.warehouseDoor.status}
                      />
                    </span>
                  )}
                />
                <ResourceGroup
                  dischargeStatus={discharge.status}
                  label="Weighing areas"
                  periods={shift.weighingAreas}
                  renderResource={(membership) => (
                    <ReferenceLabel
                      name={membership.weighingArea.name}
                      status={membership.weighingArea.status}
                    />
                  )}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No shifts planned</EmptyTitle>
            <EmptyDescription>No shift has been prepared for this discharge yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </DetailSection>
  )
}
