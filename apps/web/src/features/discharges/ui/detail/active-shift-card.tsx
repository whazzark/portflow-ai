import { getRouteApi, Link } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  activeShiftSummary,
  counted,
  type NextShift,
} from '@/features/discharges/active-discharge-view'
import { shiftSearch } from '@/features/discharges/discharge-detail-sections'
import { formatShiftDuration, formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { AddShiftSheet } from '@/features/discharges/ui/detail/add-shift-sheet'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { ShiftStatusBadge } from '@/features/discharges/ui/detail/discharge-status-badge'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { formatDateTime } from '@/helpers/dates'

const dischargeRoute = getRouteApi('/_authenticated/discharges/$dischargeId')

type Shift = DischargeDetailDto['shifts'][number]

type ActiveShiftCardProps = {
  discharge: DischargeDetailDto
  /** A preparer may add a shift, the way forward once nothing is planned any more. */
  canAddShifts: boolean
}

function describeNext(next: NextShift | null) {
  if (!next) {
    return 'No further shift planned'
  }
  const { shift, counts } = next

  return [
    `Next: ${formatShiftPeriod(shift)}`,
    `${shift.responsible.firstName} ${shift.responsible.lastName}`,
    [
      counted(counts.trucks, 'truck', 'trucks'),
      counted(counts.warehouseDoors, 'door', 'doors'),
      counted(counts.weighingAreas, 'weighing area', 'weighing areas'),
    ].join(', '),
  ].join(' · ')
}

type ResourceListProps = {
  label: string
  items: Array<{ key: string; content: ReactNode }>
}

/** One kind of resource the shift holds now, named by its count. */
function ResourceList({ label, items }: ResourceListProps) {
  const headingId = useId()
  const name = `${label} (${items.length})`

  return (
    <div className="grid content-start gap-1.5">
      <h3 className="text-muted-foreground text-sm" id={headingId}>
        {name}
      </h3>
      <ul aria-labelledby={headingId} className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {items.map((item) => (
          <li className="min-w-0 break-words" key={item.key}>
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  )
}

function OpenInShifts({ shift }: { shift: Pick<Shift, 'id'> }) {
  return (
    <Link
      className="font-medium text-indicator text-sm underline-offset-4 hover:underline"
      from="/discharges/$dischargeId"
      search={(previous) => ({ ...previous, ...shiftSearch(shift.id) })}
      to="."
    >
      Open in Shifts
    </Link>
  )
}

/**
 * The overview's first card on a started discharge: who is working now and with what, and which
 * shift comes next. Between two shifts it says so, naming the last one worked and the next one.
 */
export function ActiveShiftCard({ discharge, canAddShifts }: ActiveShiftCardProps) {
  const summary = activeShiftSummary(discharge)
  const [adding, setAdding] = useState(false)
  const navigate = dischargeRoute.useNavigate()

  if (summary.state === 'BETWEEN') {
    return (
      <DetailSection title="Current shift">
        <div className="grid gap-2 text-sm">
          <p className="font-medium">No shift is active</p>
          {summary.last && (
            <p className="text-muted-foreground">Last: {formatShiftPeriod(summary.last)}</p>
          )}
          <p className="text-muted-foreground">{describeNext(summary.next)}</p>
          {!summary.next && canAddShifts && (
            <div>
              <Button onClick={() => setAdding(true)} size="sm">
                <PlusIcon aria-hidden="true" />
                Add shift
              </Button>
              <AddShiftSheet
                discharge={discharge}
                onAdded={(shiftId) => {
                  void navigate({
                    search: (previous) => ({ ...previous, ...shiftSearch(shiftId) }),
                  })
                }}
                onOpenChange={setAdding}
                open={adding}
              />
            </div>
          )}
        </div>
      </DetailSection>
    )
  }

  const { shift, position, resources } = summary
  const duration = formatShiftDuration(shift)
  const trucks = shift.trucks.filter((truck) => resources.truckIds.includes(truck.truckId))
  const doors = shift.warehouseDoors.filter((membership) => membership.effectiveTo === null)
  const areas = shift.weighingAreas.filter((membership) => membership.effectiveTo === null)
  // One entry per resource, as the counts are: a resource may have been held over several periods.
  const distinct = <T,>(items: T[], idOf: (item: T) => string) =>
    items.filter((item, index) => items.findIndex((other) => idOf(other) === idOf(item)) === index)

  return (
    <DetailSection actions={<OpenInShifts shift={shift} />} title="Current shift">
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <ShiftStatusBadge status={shift.status} />
            <span className="tabular-nums">
              {[`Shift ${position.index} of ${position.total}`, formatShiftPeriod(shift), duration]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            Started {formatDateTime(shift.actualStartAt)}
          </p>
        </div>
        <dl className="grid gap-1 text-sm">
          <dt className="text-muted-foreground">Responsible</dt>
          <dd className="font-medium">
            {shift.responsible.firstName} {shift.responsible.lastName}
          </dd>
        </dl>
        <div className="grid gap-4 sm:grid-cols-3">
          <ResourceList
            items={distinct(trucks, (truck) => truck.truckId).map((truck) => ({
              key: truck.truckId,
              content: <ReferenceLabel name={truck.registration} status={truck.truckStatus} />,
            }))}
            label="Trucks"
          />
          <ResourceList
            items={distinct(doors, (membership) => membership.warehouseDoor.id).map(
              (membership) => ({
                key: membership.warehouseDoor.id,
                content: (
                  <ReferenceLabel
                    name={membership.warehouseDoor.name}
                    status={membership.warehouseDoor.status}
                  />
                ),
              }),
            )}
            label="Warehouse doors"
          />
          <ResourceList
            items={distinct(areas, (membership) => membership.weighingArea.id).map(
              (membership) => ({
                key: membership.weighingArea.id,
                content: (
                  <ReferenceLabel
                    name={membership.weighingArea.name}
                    status={membership.weighingArea.status}
                  />
                ),
              }),
            )}
            label="Weighing areas"
          />
        </div>
        <p className="border-t pt-3 text-muted-foreground text-sm">{describeNext(summary.next)}</p>
      </div>
    </DetailSection>
  )
}
