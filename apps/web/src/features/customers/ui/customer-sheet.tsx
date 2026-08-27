import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CUSTOMER_SINGULAR } from '@/features/customers/customer-lifecycle'
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import type { CustomerDto } from '@/features/customers/types'
import { CreateCustomerPanel } from '@/features/customers/ui/create-customer-panel'
import { CustomerDetails } from '@/features/customers/ui/customer-details'
import { EditCustomerPanel } from '@/features/customers/ui/edit-customer-panel'
import { resourceSuccessMessage } from '@/helpers/resource-copy'

type CustomerSheetProps = {
  customer?: CustomerDto
  customerId?: string
  mode?: 'create' | 'edit' | 'view'
  canAdminister: boolean
  onChange: (next: { customerId?: string; mode?: 'create' | 'edit' | 'view' }) => void
}

export function CustomerSheet({
  customer,
  customerId,
  mode,
  canAdminister,
  onChange,
}: CustomerSheetProps) {
  const mutations = useCustomerMutations()
  const isOpen = Boolean(mode) && (mode === 'create' ? canAdminister : Boolean(customerId))
  const close = () => onChange({})

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent className="overflow-hidden sm:max-w-lg">
        {mode === 'create' ? (
          <CreateCustomerPanel
            onCreate={async (value) => {
              const result = await mutations.create.mutateAsync({ body: value })

              return result.data
            }}
            onSuccess={(created) => {
              toast.success(
                resourceSuccessMessage('create', CUSTOMER_SINGULAR, created.companyName),
              )
              onChange({ customerId: created.id, mode: 'view' })
            }}
          />
        ) : !customer ? (
          <>
            <SheetHeader>
              <SheetTitle>Unable to load customer</SheetTitle>
              <SheetDescription>
                The selected customer could not be restored from the current list.
              </SheetDescription>
            </SheetHeader>
            <Alert variant="destructive">
              <AlertTitle>Customer details unavailable</AlertTitle>
              <AlertDescription>The customer is no longer available in the list.</AlertDescription>
            </Alert>
          </>
        ) : mode === 'edit' && canAdminister && customer.status === 'AVAILABLE' ? (
          <EditCustomerPanel
            customer={customer}
            onBack={() => onChange({ customerId: customer.id, mode: 'view' })}
            onUpdate={async (value) => {
              const result = await mutations.update.mutateAsync({
                params: { id: customer.id },
                body: value,
              })

              return result.data
            }}
            onSuccess={(updated) => {
              toast.success(
                resourceSuccessMessage('update', CUSTOMER_SINGULAR, updated.companyName),
              )
              onChange({ customerId: updated.id, mode: 'view' })
            }}
          />
        ) : (
          <CustomerDetails
            canAdminister={canAdminister}
            customer={customer}
            onEdit={() => onChange({ customerId: customer.id, mode: 'edit' })}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
