import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerForm } from '@/features/customers/ui/customer-form'

type CreateCustomerPanelProps = {
  customers: CustomerDto[]
  onCreate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
  onCancel: () => void
}

export function CreateCustomerPanel({
  customers,
  onCreate,
  onSuccess,
  onCancel,
}: CreateCustomerPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14">
        <SheetTitle className="text-lg">Create customer</SheetTitle>
        <SheetDescription>Available as soon as it is created</SheetDescription>
      </SheetHeader>
      <CustomerForm
        customers={customers}
        onCancel={onCancel}
        onCreate={onCreate}
        onSuccess={onSuccess}
        onUpdate={() => {
          throw new Error('Update is not available while creating')
        }}
      />
    </div>
  )
}
