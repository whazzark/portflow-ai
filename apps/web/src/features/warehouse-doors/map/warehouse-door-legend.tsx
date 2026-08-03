import { DoorOpenIcon } from 'lucide-react'
import {
  ResourceLegend,
  ResourceLegendStatusSymbol,
} from '@/components/resource-map/resource-legend'

function WarehouseDoorTypeSymbol() {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm"
      data-warehouse-door-legend-type="WAREHOUSE_DOOR"
    >
      <DoorOpenIcon className="size-3.5" />
    </span>
  )
}

export function WarehouseDoorLegend() {
  return (
    <ResourceLegend
      ariaLabel="Warehouse door legend"
      typeAriaLabel="Warehouse door types"
      types={[{ label: 'Warehouse door', symbol: <WarehouseDoorTypeSymbol /> }]}
      statusAriaLabel="Warehouse door statuses"
      statuses={[
        {
          label: 'Available',
          symbol: (
            <ResourceLegendStatusSymbol
              status="AVAILABLE"
              dataAttribute="warehouse-door-legend-status"
            />
          ),
        },
        {
          label: 'Archived',
          symbol: (
            <ResourceLegendStatusSymbol
              status="ARCHIVED"
              dataAttribute="warehouse-door-legend-status"
            />
          ),
        },
      ]}
    />
  )
}
