import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import {
  TransportCompanyLifecycleDialog,
  transportCompanyLifecycleActions,
} from '@/features/transport-companies/transport-company-lifecycle'
import type { TransportCompanyDto } from '@/features/transport-companies/types'

type TransportCompanyRowActionsProps = {
  company: TransportCompanyDto
  /** Consulting is open to every active user; correcting and moving through the lifecycle are not. */
  canAdminister?: boolean
  onEdit?: (id: string) => void
  onView?: (id: string) => void
}

export function TransportCompanyRowActions({
  company,
  canAdminister = false,
  onEdit,
  onView,
}: TransportCompanyRowActionsProps) {
  return (
    <ResourceRowActions
      actions={canAdminister ? transportCompanyLifecycleActions(company.status) : []}
      // Editing is refused on an archived company, exactly as the detail pane gates it.
      editable={canAdminister && company.status === 'AVAILABLE'}
      name={company.name}
      onEdit={onEdit && (() => onEdit(company.id))}
      onView={onView && (() => onView(company.id))}
      renderDialog={({ action, onClose }) => (
        <TransportCompanyLifecycleDialog action={action} company={company} onClose={onClose} />
      )}
    />
  )
}
