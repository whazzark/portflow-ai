import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import {
  ResourceDetailField,
  ResourceStatusBadge,
} from '@/components/resource-map/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  CustomerLifecycleActions,
  customerLifecycleBlocks,
} from '@/features/customers/customer-lifecycle'
import type { CustomerDto } from '@/features/customers/types'
import { formatDateTime } from '@/helpers/dates'

type CustomerDetailsProps = {
  canAdminister: boolean
  customer: CustomerDto
  onEdit: () => void
}

export function CustomerDetails({ canAdminister, customer, onEdit }: CustomerDetailsProps) {
  const lifecycleBlocks = customerLifecycleBlocks(customer)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        <SheetTitle>{customer.companyName}</SheetTitle>
        <SheetDescription className="flex items-center gap-2">
          <span className="font-mono text-xs">{customer.code}</span>
          <ResourceStatusBadge status={customer.status} />
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <ResourceDetailField label="Created" value={formatDateTime(customer.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(customer.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </div>
      {canAdminister && customer.status === 'AVAILABLE' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={onEdit}>Edit</Button>
          <CustomerLifecycleActions customer={customer} />
        </SheetFooter>
      )}
      {canAdminister && customer.status === 'ARCHIVED' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:justify-end">
          <CustomerLifecycleActions className="sm:ml-auto" customer={customer} />
        </SheetFooter>
      )}
    </div>
  )
}
