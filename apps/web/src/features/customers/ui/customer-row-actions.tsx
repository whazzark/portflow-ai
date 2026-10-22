import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import {
  CustomerLifecycleDialog,
  customerLifecycleActions,
} from '@/features/customers/customer-lifecycle'
import type { CustomerDto } from '@/features/customers/types'

type CustomerRowActionsProps = {
  customer: CustomerDto
  /** Consulting is open to every active user; correcting and moving through the lifecycle are not. */
  canAdminister?: boolean
  onEdit?: (id: string) => void
  onView?: (id: string) => void
}

export function CustomerRowActions({
  customer,
  canAdminister = false,
  onEdit,
  onView,
}: CustomerRowActionsProps) {
  return (
    <ResourceRowActions
      actions={canAdminister ? customerLifecycleActions(customer.status) : []}
      // Editing is refused on an archived customer, exactly as the detail pane gates it.
      editable={canAdminister && customer.status === 'AVAILABLE'}
      // The code is what the directory shows in the row, so it is what names the row's menu.
      name={customer.code}
      onEdit={onEdit && (() => onEdit(customer.id))}
      onView={onView && (() => onView(customer.id))}
      renderDialog={({ action, onClose }) => (
        <CustomerLifecycleDialog action={action} customer={customer} onClose={onClose} />
      )}
    />
  )
}
