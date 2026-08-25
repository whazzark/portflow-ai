import { ResourceDetailField } from '@/components/resource-map/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { TruckLifecycleActions } from '@/features/trucks/ui/truck-lifecycle-actions'
import { formatFullName } from '@/features/users/helpers/name'
import { formatDateTime } from '@/helpers/dates'

function formatCapacity(capacityTonnes: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(capacityTonnes)} t`
}

export function TruckDetails({
  administrator = false,
  truck,
  company,
  canAdminister,
  onEdit,
}: {
  administrator?: boolean
  truck: TruckDto
  company?: TransportCompanyDto
  canAdminister: boolean
  onEdit: () => void
}) {
  const isArchived = truck.status === 'ARCHIVED'
  const isSuspended = truck.status === 'SUSPENDED'
  const isAvailable = truck.status === 'AVAILABLE'
  const statusLabel = isArchived ? 'Archived' : isSuspended ? 'Suspended' : 'Available'
  // Every block the truck actually carries, newest first, rather than the single block its current
  // status implies. A truck that has just been returned to service is AVAILABLE and needs to show
  // both the return and the suspension it ended; deriving one block from the status could only ever
  // show one of them, and for an available truck it would show neither.
  const lifecycleBlocks = [
    {
      key: 'archive',
      heading: 'Archive context',
      timeLabel: 'Archived at',
      actorLabel: 'Archived by',
      time: truck.archivedAt,
      actor: truck.archivedBy,
      comment: truck.archiveComment,
    },
    {
      key: 'reactivation',
      heading: 'Reactivation context',
      timeLabel: 'Reactivated at',
      actorLabel: 'Reactivated by',
      time: truck.reactivatedAt,
      actor: truck.reactivatedBy,
      comment: truck.reactivationComment,
    },
    {
      key: 'suspension',
      heading: 'Suspension context',
      timeLabel: 'Suspended at',
      actorLabel: 'Suspended by',
      time: truck.suspendedAt,
      actor: truck.suspendedBy,
      comment: truck.suspensionComment,
    },
    {
      key: 'return-to-service',
      heading: 'Return to service context',
      timeLabel: 'Returned to service at',
      actorLabel: 'Returned to service by',
      time: truck.returnedToServiceAt,
      actor: truck.returnedToServiceBy,
      comment: truck.returnToServiceComment,
    },
  ]
    .filter((block) => block.time !== null)
    .sort((left, right) => Date.parse(right.time ?? '') - Date.parse(left.time ?? ''))

  return (
    <section aria-label="Truck details" className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-5 py-4 md:px-6">
        <h2 className="font-heading font-semibold text-xl">{truck.registration}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={isArchived ? 'outline' : isSuspended ? 'destructive' : 'secondary'}>
            {statusLabel}
          </Badge>
          {company?.status === 'ARCHIVED' && <Badge variant="outline">Archived company</Badge>}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-6">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <ResourceDetailField label="Registration" value={truck.registration} />
          <ResourceDetailField label="Vehicle model" value={truck.vehicleModel} />
          <ResourceDetailField label="Capacity" value={formatCapacity(truck.capacityTonnes)} />
          <ResourceDetailField label="Current transport company" value={company?.name} />
          <ResourceDetailField
            label="Transport-company status"
            value={
              company
                ? company.status === 'ARCHIVED'
                  ? 'Archived company'
                  : 'Available company'
                : null
            }
          />
          <ResourceDetailField label="Truck status" value={statusLabel} />
          <ResourceDetailField label="Created" value={formatDateTime(truck.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(truck.updatedAt)} />
        </dl>
        {lifecycleBlocks.map((block) => (
          <div key={block.key}>
            <Separator className="my-6" />
            <section
              aria-labelledby={`truck-lifecycle-${block.key}-heading`}
              className="flex flex-col gap-3"
            >
              <h3 className="font-medium" id={`truck-lifecycle-${block.key}-heading`}>
                {block.heading}
              </h3>
              <dl className="grid gap-4 text-sm">
                <ResourceDetailField
                  label={block.timeLabel}
                  value={block.time ? formatDateTime(block.time) : null}
                />
                {administrator && (
                  <ResourceDetailField
                    label={block.actorLabel}
                    value={block.actor ? formatFullName(block.actor) : null}
                  />
                )}
                <ResourceDetailField label="Comment" value={block.comment} />
              </dl>
            </section>
          </div>
        ))}
      </div>
      {(canAdminister || administrator) && (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-popover px-5 py-4 md:px-6">
          {canAdminister && isAvailable && <Button onClick={onEdit}>Edit</Button>}
          {administrator && <TruckLifecycleActions truck={truck} />}
        </footer>
      )}
    </section>
  )
}
