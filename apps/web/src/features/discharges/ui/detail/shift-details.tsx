import { TriangleAlertIcon } from 'lucide-react'

import { ResourceDetailBody, ResourceDetailField } from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  formatPlannedTime,
  formatShiftDuration,
  formatShiftPeriod,
  shiftResources,
} from '@/features/discharges/discharge-detail-view'
import { missingTrucks } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ShiftStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { ShiftResourceGroup } from '@/features/discharges/ui/detail/shift-resource-group'

type Shift = DischargeDetailDto['shifts'][number]

type ShiftDetailsProps = {
  discharge: DischargeDetailDto
  shift: Shift
  /** A preparer on a planned discharge may correct a planned shift. */
  canCorrect: boolean
  onEdit: () => void
}

/** Everything the open shift is planned with and uses, in the shift panel. */
export function ShiftDetails({ canCorrect, discharge, onEdit, shift }: ShiftDetailsProps) {
  const canEdit = canCorrect && shift.status === 'PLANNED'
  // A finished shift's resources have all ended, so it counts those it used.
  const resources = shiftResources(shift)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        {/* A shift is known to users by its planned period, never by an internal number. */}
        <SheetTitle>Shift {formatShiftPeriod(shift)}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <ShiftStatusBadge status={shift.status} />
          {missingTrucks(shift) && (
            <span className="inline-flex items-center gap-1">
              <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
              No truck selected
            </span>
          )}
        </SheetDescription>
      </SheetHeader>
      <ResourceDetailBody>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <ResourceDetailField
            label="Responsible"
            value={`${shift.responsible.firstName} ${shift.responsible.lastName}`}
          />
          <ResourceDetailField label="Duration" value={formatShiftDuration(shift)} />
          <ResourceDetailField
            label="Planned start"
            value={shift.plannedStartAt && formatPlannedTime(shift.plannedStartAt)}
          />
          <ResourceDetailField
            label="Planned end"
            value={shift.plannedEndAt && formatPlannedTime(shift.plannedEndAt)}
          />
        </dl>
        <div className="mt-8 grid gap-6">
          <ShiftResourceGroup
            count={resources.weighingAreas.length}
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
          <ShiftResourceGroup
            count={resources.warehouseDoors.length}
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
          <ShiftResourceGroup
            count={resources.truckIds.length}
            dischargeStatus={discharge.status}
            label="Trucks"
            periods={shift.trucks}
            renderResource={(truck) => (
              <ReferenceLabel name={truck.registration} status={truck.truckStatus} />
            )}
          />
        </div>
      </ResourceDetailBody>
      {canEdit && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:justify-end">
          <Button onClick={onEdit}>Edit</Button>
        </SheetFooter>
      )}
    </div>
  )
}
