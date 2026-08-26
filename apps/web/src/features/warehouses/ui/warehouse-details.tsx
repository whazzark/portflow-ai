import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import { ResourceDetailHeader } from '@/components/resource-map/resource-details'
import { Separator } from '@/components/ui/separator'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { warehouseLifecycleBlocks } from '@/features/warehouses/warehouse-lifecycle'

/** Read-only: every action on the warehouse lives in the sheet's single footer, below its doors,
 * so the panel is not interrupted by a set of buttons halfway down. */
export function WarehouseDetails({ warehouse }: { warehouse: WarehouseWithDoorsDto }) {
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
    </div>
  )
}
