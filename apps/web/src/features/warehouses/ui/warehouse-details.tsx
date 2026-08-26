import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import { ResourceDetailHeader } from '@/components/resource-map/resource-details'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import {
  WarehouseLifecycleActions,
  warehouseLifecycleBlocks,
} from '@/features/warehouses/warehouse-lifecycle'

export function WarehouseDetails({
  canManageLifecycle = false,
  warehouse,
}: {
  /** Gates both lifecycle directions — an available warehouse can be archived, an archived one
   * reactivated — so it is named for the right rather than for one of the two actions. */
  canManageLifecycle?: boolean
  warehouse: WarehouseWithDoorsDto
}) {
  const lifecycleBlocks = warehouseLifecycleBlocks(warehouse)
  // The summary renders nothing for a warehouse with no history; the frame around it has to go
  // too, or an empty separator would sit under the header.
  const hasLifecycleContext = lifecycleBlocks.some((block) => block.at)

  return (
    <div className="shrink-0">
      <ResourceDetailHeader
        archivedMessage="Archived warehouses cannot receive new operations."
        name={warehouse.name}
        status={warehouse.status}
      />
      {hasLifecycleContext && (
        <div className="px-4 pt-4">
          <Separator className="mb-3" />
          <ResourceLifecycleSummary blocks={lifecycleBlocks} />
        </div>
      )}
      {canManageLifecycle && (
        <SheetFooter className="shrink-0 sm:flex-row sm:items-center sm:justify-end">
          <WarehouseLifecycleActions warehouse={warehouse} />
        </SheetFooter>
      )}
    </div>
  )
}
