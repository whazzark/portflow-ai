import {
  HighlightedMatch,
  ResourceMapSearch,
} from '@/components/resource-map/resource-map-search-field'
import type { WarehouseStatusFilter, WarehouseWithDoorsDto } from '@/features/warehouses/types'
import {
  searchWarehousesAndDoors,
  type WarehouseDoorSearchResult,
  type WarehouseSearchResult,
} from '@/features/warehouses/warehouse-search'

type Result =
  | ({ kind: 'warehouse' } & WarehouseSearchResult)
  | ({ kind: 'door' } & WarehouseDoorSearchResult)

/** The toolbar's search over warehouse and door names, grouped by kind. */
export function WarehouseSearch({
  warehouses,
  status,
  search,
  onSearchChange,
  onOpenWarehouse,
  onOpenDoor,
}: {
  warehouses: WarehouseWithDoorsDto[]
  status: WarehouseStatusFilter
  search: string
  onSearchChange: (value: string) => void
  onOpenWarehouse: (warehouseId: string) => void
  onOpenDoor: (door: WarehouseDoorSearchResult) => void
}) {
  const results = searchWarehousesAndDoors(warehouses, status, search)

  return (
    <ResourceMapSearch<Result>
      footer="Enter opens the highlighted result. Archived results appear when Archived is on."
      getItemKey={(result) => `${result.kind}:${result.id}`}
      groups={[
        {
          label: 'Warehouses',
          items: results.warehouses.map((result) => ({ kind: 'warehouse' as const, ...result })),
        },
        {
          label: 'Doors',
          items: results.doors.map((result) => ({ kind: 'door' as const, ...result })),
        },
      ]}
      id="warehouse-search"
      label="Search warehouses"
      onSelect={(result) =>
        result.kind === 'warehouse' ? onOpenWarehouse(result.id) : onOpenDoor(result)
      }
      onValueChange={onSearchChange}
      renderItem={(result) => (
        <>
          <span className="truncate">
            <HighlightedMatch search={search} text={result.name} />
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {result.kind === 'warehouse' ? result.doorSummary : `In ${result.warehouseName}`}
          </span>
        </>
      )}
      value={search}
    />
  )
}
