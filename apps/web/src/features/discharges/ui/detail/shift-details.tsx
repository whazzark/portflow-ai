import { ResourceDetailBody, ResourceDetailField } from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  formatShiftDuration,
  formatShiftPeriod,
  sharedResourcePeriod,
  shiftResources,
} from '@/features/discharges/discharge-detail-view'
import { heldPoolEntries } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ShiftStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { ShiftReadiness } from '@/features/discharges/ui/detail/shift-readiness'
import { ShiftResourceGroup } from '@/features/discharges/ui/detail/shift-resource-group'
import { formatDateTime } from '@/helpers/dates'

type Shift = DischargeDetailDto['shifts'][number]

type ShiftDetailsProps = {
  discharge: DischargeDetailDto
  shift: Shift
  /** A preparer on a planned discharge may correct a planned shift. */
  canCorrect: boolean
  onEdit: () => void
  onClose: () => void
}

/** Everything the open shift is planned with and uses, in the shift panel. */
export function ShiftDetails({ canCorrect, discharge, onClose, onEdit, shift }: ShiftDetailsProps) {
  const canEdit = canCorrect && shift.status === 'PLANNED'
  // A finished shift's resources have all ended, so it counts those it used.
  const resources = shiftResources(shift)
  const { trucksSince, allResourcesSince } = sharedResourcePeriod(shift, discharge.status)
  // Shifts come in planned order, so its rank there is its place in the discharge.
  const position = discharge.shifts.findIndex((candidate) => candidate.id === shift.id) + 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        {/* A shift is known to users by its planned period, never by an internal number. */}
        <SheetTitle>{formatShiftPeriod(shift)}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <ShiftStatusBadge status={shift.status} />
          <span>
            Shift {position} of {discharge.shifts.length} · {discharge.vesselName}
          </span>
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
            value={shift.plannedStartAt && formatDateTime(shift.plannedStartAt)}
          />
          <ResourceDetailField
            label="Planned end"
            value={shift.plannedEndAt && formatDateTime(shift.plannedEndAt)}
          />
          {shift.actualStartAt && (
            <>
              <ResourceDetailField
                label="Actual start"
                value={formatDateTime(shift.actualStartAt)}
              />
              {/* The user who started the shift, who need not be its responsible. */}
              <ResourceDetailField
                label="Started by"
                value={
                  shift.startedBy && `${shift.startedBy.firstName} ${shift.startedBy.lastName}`
                }
              />
            </>
          )}
        </dl>
        {shift.readinessGaps && (
          <div className="mt-8">
            <ShiftReadiness
              canCorrect={canEdit}
              gaps={shift.readinessGaps}
              holdsTrucks={heldPoolEntries(discharge).length > 0}
            />
          </div>
        )}
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
            sharedPeriod={
              trucksSince &&
              `All ${allResourcesSince ? 'resources' : 'trucks'} since ${formatDateTime(trucksSince)}`
            }
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
      {shift.status === 'COMPLETED' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">A completed shift cannot be changed</p>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </SheetFooter>
      )}
    </div>
  )
}
