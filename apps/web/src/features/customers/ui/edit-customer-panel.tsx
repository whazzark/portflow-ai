import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerForm } from '@/features/customers/ui/customer-form'

type EditCustomerPanelProps = {
  customer: CustomerDto
  customers: CustomerDto[]
  /** Leaves the edit for the customer's details, saving nothing. */
  onBack: () => void
  onUpdate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
}

export function EditCustomerPanel({
  customer,
  customers,
  onBack,
  onUpdate,
  onSuccess,
}: EditCustomerPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14">
        <Button className="-ml-2 self-start" onClick={onBack} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle className="text-lg">Edit customer</SheetTitle>
        <SheetDescription>
          {customer.companyName} · {customer.code}
        </SheetDescription>
      </SheetHeader>
      <CustomerForm
        customer={customer}
        customers={customers}
        onCreate={() => {
          throw new Error('Create is not available while editing')
        }}
        onSuccess={onSuccess}
        onUpdate={onUpdate}
      />
    </div>
  )
}
