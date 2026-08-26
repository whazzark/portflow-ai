import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerForm } from '@/features/customers/ui/customer-form'

type CreateCustomerPanelProps = {
  onCreate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
}

export function CreateCustomerPanel({ onCreate, onSuccess }: CreateCustomerPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create customer</SheetTitle>
        <SheetDescription>Add a reusable customer reference for the site.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <CustomerForm
          onCreate={onCreate}
          onSuccess={onSuccess}
          onUpdate={() => {
            throw new Error('Update is not available while creating')
          }}
        />
      </div>
    </div>
  )
}
