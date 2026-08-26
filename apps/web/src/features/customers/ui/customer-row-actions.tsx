import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import {
  customerLifecycleActions,
  useCustomerLifecycleConfig,
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
  const config = useCustomerLifecycleConfig(customer)

  return (
    <ResourceRowActions
      actions={canAdminister ? customerLifecycleActions(customer.status) : []}
      config={config}
      // Editing is refused on an archived customer, exactly as the detail pane gates it.
      editable={canAdminister && customer.status === 'AVAILABLE'}
      onEdit={onEdit && (() => onEdit(customer.id))}
      onView={onView && (() => onView(customer.id))}
    />
  )
}
