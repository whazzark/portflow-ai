import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import { truckLifecycleActions, useTruckLifecycleConfig } from '@/features/trucks/truck-lifecycle'
import type { TruckDto } from '@/features/trucks/types'

type TruckRowActionsProps = {
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  truck: TruckDto
}

export function TruckRowActions({ onEdit, onView, truck }: TruckRowActionsProps) {
  const config = useTruckLifecycleConfig(truck)

  return (
    <ResourceRowActions
      actions={truckLifecycleActions(truck.status)}
      config={config}
      // Editing is refused for anything but an available truck, exactly as the detail pane gates it.
      editable={truck.status === 'AVAILABLE'}
      onEdit={onEdit && (() => onEdit(truck.id))}
      onView={onView && (() => onView(truck.id))}
    />
  )
}
