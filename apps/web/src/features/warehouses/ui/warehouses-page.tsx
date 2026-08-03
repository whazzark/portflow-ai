import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { WarehouseDoorStatusFilter } from '@/features/warehouse-doors/types'
import { WarehouseDoorsPanel } from '@/features/warehouse-doors/ui/warehouse-doors-panel'
import {
  defaultDoorStatus,
  filterWarehouseDoors,
  findAdmittedDoor,
  toggleDoorSelection,
} from '@/features/warehouse-doors/warehouse-door-presentation'
import { WarehouseLegend } from '@/features/warehouses/map/warehouse-legend'
import { WarehouseMap } from '@/features/warehouses/map/warehouse-map'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { presentWarehouses } from '@/features/warehouses/warehouse-search'
import { useIsMobile } from '@/hooks/use-mobile'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

export function WarehousesPage() {
  const { doorId, doorStatus, search, status, warehouseId } = warehousesRoute.useSearch()
  const navigate = warehousesRoute.useNavigate()
  const isMobile = useIsMobile()
  const query = useQuery(warehouseQueries.list())
  const warehouses = query.data?.data ?? []
  const visible = presentWarehouses(warehouses, status, search)
  const counts = countResources(warehouses)
  const selected = visible.find((warehouse) => warehouse.id === warehouseId)
  const effectiveDoorStatus: WarehouseDoorStatusFilter =
    doorStatus ?? (selected ? defaultDoorStatus(selected.status) : 'available')
  const admittedDoors = useMemo(
    () => (selected ? filterWarehouseDoors(selected, effectiveDoorStatus) : []),
    [effectiveDoorStatus, selected],
  )
  const admittedDoor = selected
    ? findAdmittedDoor(selected, doorId, effectiveDoorStatus)
    : undefined

  useEffect(() => {
    if (query.data && warehouseId && !selected) {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          doorId: undefined,
          doorStatus: undefined,
          warehouseId: undefined,
        }),
      })
    }
  }, [navigate, query.data, selected, warehouseId])

  useEffect(() => {
    if (query.data && selected && doorId && !admittedDoor) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, doorId: undefined }),
      })
    }
  }, [admittedDoor, doorId, navigate, query.data, selected])

  if (query.isError) {
    return <WarehousesError onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return null
  }

  const updateStatus = (next: typeof status) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        status: next,
        warehouseId: undefined,
        doorId: undefined,
        doorStatus: undefined,
      }),
    })
  const selectWarehouse = (warehouse: (typeof visible)[number]) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        warehouseId: previous.warehouseId === warehouse.id ? undefined : warehouse.id,
        doorId: undefined,
        doorStatus: undefined,
      }),
    })
  const selectDoor = (nextDoorId: string) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        doorId: toggleDoorSelection(previous.doorId, nextDoorId),
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
        legend={<WarehouseLegend showDoors={Boolean(selected)} />}
        map={(onMapError) => (
          <WarehouseMap
            detailsPanelSide={isMobile ? 'bottom' : 'right'}
            onError={onMapError}
            selected={selected}
            warehouses={visible}
            onSelect={selectWarehouse}
            doors={admittedDoors}
            selectedDoorId={admittedDoor?.id}
            onDoorSelect={(door) => selectDoor(door.id)}
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
            search: (previous) => ({
              ...previous,
              warehouseId: undefined,
              doorStatus: undefined,
              doorId: undefined,
            }),
          })
        }
        modal={false}
        disablePointerDismissal
      >
        <SheetContent
          className="gap-0 overflow-y-auto data-[side=bottom]:h-[min(75dvh,38rem)] data-[side=right]:sm:max-w-lg"
          showOverlay={false}
          side={isMobile ? 'bottom' : 'right'}
        >
          {selected && (
            <div className="flex min-h-0 flex-1 flex-col">
              <WarehouseDetails warehouse={selected} />
              <WarehouseDoorsPanel
                warehouse={selected}
                status={effectiveDoorStatus}
                selectedDoorId={admittedDoor?.id}
                onStatusChange={(next) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      doorStatus: next,
                      doorId: undefined,
                    }),
                  })
                }
                onDoorSelect={selectDoor}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
