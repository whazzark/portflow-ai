import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerForm } from '@/features/customers/ui/customer-form'

type EditCustomerPanelProps = {
  customer: CustomerDto
  onBack: () => void
  onUpdate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
}

export function EditCustomerPanel({
  customer,
  onBack,
  onUpdate,
  onSuccess,
}: EditCustomerPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onBack} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to customer details
        </Button>
        <SheetTitle>Edit customer</SheetTitle>
        <SheetDescription>Update the current Customer identity.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <CustomerForm
          customer={customer}
          onCreate={() => {
            throw new Error('Create is not available while editing')
          }}
          onSuccess={onSuccess}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  )
}
