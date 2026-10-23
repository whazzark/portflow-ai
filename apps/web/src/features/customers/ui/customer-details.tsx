import { ContactIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ResourceLifecycleHistory } from '@/components/lifecycle/resource-lifecycle-history'
import { RESOURCE_STATUS_LABELS } from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  CustomerLifecycleActions,
  customerLifecycleBlocks,
} from '@/features/customers/customer-lifecycle'
import type { CustomerDto } from '@/features/customers/types'
import { formatDateTime } from '@/helpers/dates'
import { classnames } from '@/libraries/shadcn/helpers'

type CustomerDetailsProps = {
  canAdminister: boolean
  customer: CustomerDto
  onEdit: () => void
}

/** One term and its value in the summary grid. */
function SummaryField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-sm tabular-nums">{children}</dd>
    </div>
  )
}

export function CustomerDetails({ canAdminister, customer, onEdit }: CustomerDetailsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 flex-row items-start gap-3.5 border-b px-6 py-5 pr-14">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        >
          <ContactIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <SheetTitle className="text-lg">{customer.companyName}</SheetTitle>
          <SheetDescription className="font-medium font-mono text-[13px] tracking-wide">
            {customer.code}
          </SheetDescription>
        </div>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <dl className="grid grid-cols-2 gap-5">
          <SummaryField label="Status">
            <span
              aria-hidden="true"
              className={classnames(
                'size-2 shrink-0 rounded-full',
                customer.status === 'AVAILABLE' ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
            {RESOURCE_STATUS_LABELS[customer.status]}
          </SummaryField>
          <SummaryField label="Customer code">
            <span className="font-medium font-mono tracking-wide">{customer.code}</span>
          </SummaryField>
          <SummaryField label="Created">{formatDateTime(customer.createdAt)}</SummaryField>
          <SummaryField label="Last updated">{formatDateTime(customer.updatedAt)}</SummaryField>
        </dl>
        <Separator />
        <ResourceLifecycleHistory blocks={customerLifecycleBlocks(customer)} />
      </div>
      {canAdminister && customer.status === 'AVAILABLE' && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={onEdit} variant="outline">
            Edit
          </Button>
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
