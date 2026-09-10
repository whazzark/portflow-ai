import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import {
  RESOURCE_STATUS_LABELS,
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
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
  const isAvailable = truck.status === 'AVAILABLE'
  const lifecycleBlocks = truckLifecycleBlocks(truck, administrator)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceDetailHeader
        archivedMessage="Archived trucks cannot receive new operations."
        name={truck.registration}
        status={truck.status}
      >
        {company?.status === 'ARCHIVED' && <Badge variant="outline">Archived company</Badge>}
      </ResourceDetailHeader>
      <ResourceDetailBody>
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
          <ResourceDetailField label="Truck status" value={RESOURCE_STATUS_LABELS[truck.status]} />
          <ResourceDetailField label="Created" value={formatDateTime(truck.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(truck.updatedAt)} />
        </dl>
        {lifecycleBlocks.some((block) => block.at) && <Separator className="my-6" />}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </ResourceDetailBody>
      {(canAdminister || administrator) && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {canAdminister && isAvailable && <Button onClick={onEdit}>Edit</Button>}
          {administrator && <TruckLifecycleActions className="sm:ml-auto" truck={truck} />}
        </SheetFooter>
      )}
    </div>
  )
}
