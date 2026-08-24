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
  const lifecycleTime = isArchived ? truck.archivedAt : truck.reactivatedAt
  const lifecycleActor = isArchived ? truck.archivedBy : truck.reactivatedBy
  const lifecycleComment = isArchived ? truck.archiveComment : truck.reactivationComment

  return (
    <section aria-label="Truck details" className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-5 py-4 md:px-6">
        <h2 className="font-heading font-semibold text-xl">{truck.registration}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={isArchived ? 'outline' : 'secondary'}>
            {isArchived ? 'Archived' : 'Available'}
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
          <ResourceDetailField label="Truck status" value={isArchived ? 'Archived' : 'Available'} />
          <ResourceDetailField label="Created" value={formatDateTime(truck.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(truck.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <section aria-labelledby="truck-lifecycle-heading" className="flex flex-col gap-3">
          <h3 className="font-medium" id="truck-lifecycle-heading">
            {isArchived ? 'Archive context' : 'Latest reactivation context'}
          </h3>
          <dl className="grid gap-4 text-sm">
            <ResourceDetailField
              label={isArchived ? 'Archived at' : 'Reactivated at'}
              value={lifecycleTime ? formatDateTime(lifecycleTime) : null}
            />
            <ResourceDetailField
              label={isArchived ? 'Archived by' : 'Reactivated by'}
              value={lifecycleActor ? formatFullName(lifecycleActor) : null}
            />
            <ResourceDetailField label="Comment" value={lifecycleComment} />
          </dl>
        </section>
      </div>
      {(canAdminister || administrator) && !isArchived && (
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-popover px-5 py-4 md:px-6">
          {canAdminister && <Button onClick={onEdit}>Edit truck</Button>}
          {administrator && <TruckLifecycleActions truck={truck} />}
        </footer>
      )}
    </section>
  )
}
