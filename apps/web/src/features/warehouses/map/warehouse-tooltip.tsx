import type { PresentedWarehouse } from '@/features/warehouses/types'

export function WarehouseTooltip({ warehouse }: { warehouse: PresentedWarehouse }) {
  return (
    <span className="grid gap-0.5 whitespace-nowrap">
      <span className="font-medium">{warehouse.name}</span>
      <span className="flex items-center gap-1.5 text-[10px] opacity-80">
        <span>Warehouse</span>
        <span aria-hidden="true">·</span>
        <span data-warehouse-status-label>
          {warehouse.status === 'AVAILABLE' ? 'Available' : 'Archived'}
        </span>
      </span>
    </span>
  )
}
