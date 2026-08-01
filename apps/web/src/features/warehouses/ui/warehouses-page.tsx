import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect } from 'react'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { WarehouseLegend } from '@/features/warehouses/map/warehouse-legend'
import { WarehouseMap } from '@/features/warehouses/map/warehouse-map'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { presentWarehouses } from '@/features/warehouses/warehouse-search'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

export function WarehousesPage() {
  const { search, status, warehouseId } = warehousesRoute.useSearch()
  const navigate = warehousesRoute.useNavigate()
  const query = useQuery(warehouseQueries.list())
  const warehouses = query.data?.data ?? []
  const visible = presentWarehouses(warehouses, status, search)
  const counts = countResources(warehouses)
  const selected = visible.find((warehouse) => warehouse.id === warehouseId)

  useEffect(() => {
    if (query.data && warehouseId && !selected) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, warehouseId: undefined }),
      })
    }
  }, [navigate, query.data, selected, warehouseId])

  if (query.isError) {
    return <WarehousesError onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return null
  }

  const updateStatus = (next: typeof status) =>
    void navigate({ search: (previous) => ({ ...previous, status: next, warehouseId: undefined }) })
  const selectWarehouse = (warehouse: (typeof visible)[number]) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        warehouseId: previous.warehouseId === warehouse.id ? undefined : warehouse.id,
      }),
    })

  return (
    <>
      <ResourceMapWorkspace
        controls={
          <WarehouseMapControls
            counts={counts}
            hasMatches={visible.some((warehouse) => warehouse.isSearchMatch)}
            onSearchChange={(value) =>
              void navigate({
                replace: true,
                search: (previous) => ({ ...previous, search: value }),
              })
            }
            onStatusChange={updateStatus}
            search={search}
            status={status}
          />
        }
        emptyMessage={
          visible.length === 0
            ? status === 'all'
              ? 'No warehouses have been configured.'
              : `No ${status} warehouses match this filter.`
            : undefined
        }
        legend={<WarehouseLegend />}
        map={(onMapError) => (
          <WarehouseMap
            onError={onMapError}
            selected={selected}
            warehouses={visible}
            onSelect={selectWarehouse}
          />
        )}
        resourceLabel="Warehouses"
      />
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) =>
          !open &&
          void navigate({
            replace: true,
            search: (previous) => ({ ...previous, warehouseId: undefined }),
          })
        }
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected && <WarehouseDetails warehouse={selected} />}
        </SheetContent>
      </Sheet>
    </>
  )
}
