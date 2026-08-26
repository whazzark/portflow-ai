import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import { TruckLifecycleDialog, truckLifecycleActions } from '@/features/trucks/truck-lifecycle'
import type { TruckDto } from '@/features/trucks/types'

type TruckRowActionsProps = {
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  truck: TruckDto
}

export function TruckRowActions({ onEdit, onView, truck }: TruckRowActionsProps) {
  return (
    <ResourceRowActions
      actions={truckLifecycleActions(truck.status)}
      // Editing is refused for anything but an available truck, exactly as the detail pane gates it.
      editable={truck.status === 'AVAILABLE'}
      name={truck.registration}
      onEdit={onEdit && (() => onEdit(truck.id))}
      onView={onView && (() => onView(truck.id))}
      renderDialog={({ action, onClose }) => (
        <TruckLifecycleDialog action={action} onClose={onClose} truck={truck} />
      )}
    />
  )
}
