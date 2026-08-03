import { ResourceDetailField } from '@/components/resource-map/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CustomerDto } from '@/features/customers/types'
import { LifecycleActions } from '@/features/customers/ui/lifecycle-actions'
import { formatDateTime } from '@/helpers/dates'

type CustomerDetailsProps = {
  canAdminister: boolean
  customer: CustomerDto
  onEdit: () => void
}

export function CustomerDetails({ canAdminister, customer, onEdit }: CustomerDetailsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        <SheetTitle>{customer.companyName}</SheetTitle>
        <SheetDescription className="flex items-center gap-2">
          <span className="font-mono text-xs">{customer.code}</span>
          <Badge variant={customer.status === 'ARCHIVED' ? 'outline' : 'secondary'}>
            {customer.status === 'ARCHIVED' ? 'Archived' : 'Available'}
          </Badge>
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <ResourceDetailField label="Created" value={formatDateTime(customer.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(customer.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <section className="flex flex-col gap-3" aria-labelledby="customer-lifecycle-heading">
          <h3 className="font-medium" id="customer-lifecycle-heading">
            Lifecycle
          </h3>
          <dl className="grid gap-4 text-sm">
            <ResourceDetailField
              label="Archived"
              value={customer.archivedAt ? formatDateTime(customer.archivedAt) : null}
            />
            <ResourceDetailField label="Archive comment" value={customer.archiveComment} />
            <ResourceDetailField
              label="Reactivated"
              value={customer.reactivatedAt ? formatDateTime(customer.reactivatedAt) : null}
            />
            <ResourceDetailField
              label="Reactivation comment"
              value={customer.reactivationComment}
            />
          </dl>
        </section>
      </div>
      {canAdminister && customer.status === 'AVAILABLE' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={onEdit}>Edit customer</Button>
          <LifecycleActions customer={customer} />
        </SheetFooter>
      )}
      {canAdminister && customer.status === 'ARCHIVED' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:justify-end">
          <LifecycleActions className="sm:ml-auto" customer={customer} />
        </SheetFooter>
      )}
    </div>
  )
}
