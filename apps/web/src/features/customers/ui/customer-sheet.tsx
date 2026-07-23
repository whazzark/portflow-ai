import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import { customerQueries } from '@/features/customers/queries/customer-queries'
import { CreateCustomerPanel } from '@/features/customers/ui/create-customer-panel'
import { CustomerDetails } from '@/features/customers/ui/customer-details'
import { EditCustomerPanel } from '@/features/customers/ui/edit-customer-panel'
import { parseApiError } from '@/libraries/tuyau/api-error'

type CustomerSheetProps = {
  customerId?: string
  mode?: 'create' | 'edit' | 'view'
  canAdminister: boolean
  onChange: (next: { customerId?: string; mode?: 'create' | 'edit' | 'view' }) => void
}

export function CustomerSheet({ customerId, mode, canAdminister, onChange }: CustomerSheetProps) {
  const customerQuery = useQuery({
    ...customerQueries.detail(customerId ?? ''),
    enabled: Boolean(customerId) && mode !== 'create',
  })
  const mutations = useCustomerMutations()
  const isOpen = Boolean(mode)
  const customer = customerQuery.data?.data
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
              toast.success('Customer created')
              onChange({ customerId: created.id, mode: 'view' })
            }}
          />
        ) : customerQuery.isPending ? (
          <SheetHeader>
            <SheetTitle>Loading customer…</SheetTitle>
          </SheetHeader>
        ) : customerQuery.isError || !customer ? (
          <SheetHeader>
            <SheetTitle>Unable to load customer</SheetTitle>
            <SheetDescription>
              <Alert variant="destructive">
                <AlertTitle>Customer details unavailable</AlertTitle>
                <AlertDescription>{parseApiError(customerQuery.error).message}</AlertDescription>
              </Alert>
            </SheetDescription>
          </SheetHeader>
        ) : mode === 'edit' && canAdminister && customer.status === 'AVAILABLE' ? (
          <EditCustomerPanel
            customer={customer}
            onUpdate={async (value) => {
              const result = await mutations.update.mutateAsync({
                params: { id: customer.id },
                body: value,
              })

              return result.data
            }}
            onSuccess={(updated) => {
              toast.success('Customer updated')
              onChange({ customerId: updated.id, mode: 'view' })
            }}
          />
        ) : (
          <CustomerDetails
            canAdminister={canAdminister}
            customer={customer}
            onEdit={() => onChange({ customerId: customer.id, mode: 'edit' })}
            onLifecycleSuccess={() => customerQuery.refetch()}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
