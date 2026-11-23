import { DoorOpenIcon } from 'lucide-react'
import {
  ResourceLegend,
  ResourceLegendStatusSymbol,
} from '@/components/resource-map/resource-legend'
import { WarehouseMarkerSymbol } from '@/features/warehouses/map/warehouse-marker-symbol'

function WarehouseLegendTypeSymbol() {
  return (
    <span aria-hidden="true" data-warehouse-legend-type="WAREHOUSE">
      <WarehouseMarkerSymbol compact status="AVAILABLE" />
    </span>
  )
}

function WarehouseDoorLegendTypeSymbol() {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"
      data-warehouse-legend-type="WAREHOUSE_DOOR"
    >
      <DoorOpenIcon className="size-3.5" />
    </span>
  )
}

/** Warehouse, Door, and the two statuses, in every state of the map — the V2 legend does not
 * change under the user as they select, draw, or place. */
export function WarehouseLegend() {
  const types = [
    { label: 'Warehouse', symbol: <WarehouseLegendTypeSymbol /> },
    { label: 'Door', symbol: <WarehouseDoorLegendTypeSymbol /> },
  ]

  return (
    <ResourceLegend
      ariaLabel="Warehouse legend"
      typeAriaLabel="Warehouse types"
      types={types}
      statusAriaLabel="Warehouse statuses"
      statuses={(['AVAILABLE', 'ARCHIVED'] as const).map((status) => ({
        label: status === 'AVAILABLE' ? 'Available' : 'Archived',
        symbol: (
          <ResourceLegendStatusSymbol status={status} dataAttribute="warehouse-legend-status" />
        ),
      }))}
    />
  )
}
