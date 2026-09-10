import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import { ResourceDetailField } from '@/components/resource/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TruckLifecycleActions, truckLifecycleBlocks } from '@/features/trucks/truck-lifecycle'
import type { TruckDto } from '@/features/trucks/types'
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
  const lifecycleBlocks = truckLifecycleBlocks(truck, administrator)

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
            label="Transport company status"
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
        {lifecycleBlocks.some((block) => block.at) && <Separator className="my-6" />}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
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
