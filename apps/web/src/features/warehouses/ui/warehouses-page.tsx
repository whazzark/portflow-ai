import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
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
import { useWarehouseMutations } from '@/features/warehouses/mutations/use-warehouse-mutations'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import { CreateWarehousePanel } from '@/features/warehouses/ui/create-warehouse-panel'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { presentWarehouses } from '@/features/warehouses/warehouse-search'
import { useIsMobile } from '@/hooks/use-mobile'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

export function WarehousesPage() {
  const { create, doorId, doorStatus, search, status, warehouseId } = warehousesRoute.useSearch()
  const navigate = warehousesRoute.useNavigate()
  const isMobile = useIsMobile()
  const query = useQuery(warehouseQueries.list())
  const user = useAuthenticatedUser()
  const warehouseMutations = useWarehouseMutations()
  const canManageWarehouses = isAdministrator(user)
  // A `create` param a non-administrator cannot act on stays inert: no panel, no armed map.
  const isCreating = canManageWarehouses && create === 'warehouse'
  const [pendingPoints, setPendingPoints] = useState<LatLng[]>([])
  // A finished outline stops taking new points; removing one reopens it for further drawing.
  const [isOutlineComplete, setIsOutlineComplete] = useState(false)

  // Leaving the mode — cancelling, navigating away, or landing on the route without the param —
  // discards every pending boundary point rather than carrying it into a later session.
  useEffect(() => {
    if (!isCreating) {
      setPendingPoints([])
      setIsOutlineComplete(false)
    }
  }, [isCreating])
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

  // Activating the mode closes any open detail, so a footprint is never drawn "inside" a selected
  // warehouse's sheet and the two can never both own the sheet.
  const startCreating = () =>
    void navigate({
      search: (previous) => ({
        ...previous,
        create: 'warehouse' as const,
        warehouseId: undefined,
        doorId: undefined,
        doorStatus: undefined,
      }),
    })
  const cancelCreating = () =>
    void navigate({ search: (previous) => ({ ...previous, create: undefined }) })
  const createWarehouse = async (value: { name: string; points: LatLng[] }) => {
    const result = await warehouseMutations.create.mutateAsync({
      body: { name: value.name, footprint: { points: value.points } },
    })

    return result.data
  }
  // The new warehouse is revealed whatever the previous lifecycle view or search would have hidden.
  const handleCreated = (warehouse: { id: string }) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        create: undefined,
        doorId: undefined,
        doorStatus: undefined,
        search: '',
        status: 'available' as const,
        warehouseId: warehouse.id,
      }),
    })

  const createActions =
    canManageWarehouses && !isCreating
      ? [
          {
            key: 'warehouse',
            label: 'Create warehouse',
            icon: <PlusIcon aria-hidden="true" className="size-4" />,
            onSelect: startCreating,
          },
        ]
      : []

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
            createActions={createActions}
            detailsPanelSide={isMobile ? 'bottom' : 'right'}
            onError={onMapError}
            placement={{
              armed: isCreating,
              completed: isOutlineComplete,
              points: pendingPoints,
              onAddPoint: (point) => setPendingPoints((current) => [...current, point]),
              onComplete: () => setIsOutlineComplete(true),
              onMovePoint: (index, point) =>
                setPendingPoints((current) =>
                  current.map((existing, position) => (position === index ? point : existing)),
                ),
            }}
            selected={selected}
            warehouses={visible}
            onSelect={selectWarehouse}
            doors={admittedDoors}
            selectedDoorId={admittedDoor?.id}
            onDoorSelect={(door) => selectDoor(door.id)}
          />
        )}
        // Without a configured basemap the map — and its control cluster with it — never renders,
        // so creation would otherwise be unreachable in that environment.
        mapUnavailableActions={createActions.map((action) => (
          <Button key={action.key} onClick={action.onSelect} type="button" variant="outline">
            {action.label}
          </Button>
        ))}
        resourceLabel="Warehouses"
      />
      <Sheet
        open={Boolean(selected) || isCreating}
        onOpenChange={(open) => {
          if (open) {
            return
          }
          if (isCreating) {
            cancelCreating()
            return
          }
          void navigate({
            replace: true,
            search: (previous) => ({
              ...previous,
              warehouseId: undefined,
              doorStatus: undefined,
              doorId: undefined,
            }),
          })
        }}
        modal={false}
        disablePointerDismissal
      >
        <SheetContent
          className="gap-0 overflow-y-auto data-[side=bottom]:h-[min(75dvh,38rem)] data-[side=right]:sm:max-w-lg"
          showOverlay={false}
          side={isMobile ? 'bottom' : 'right'}
        >
          {isCreating ? (
            <CreateWarehousePanel
              onAddPoint={(point) => setPendingPoints((current) => [...current, point])}
              onCancel={cancelCreating}
              onCreate={createWarehouse}
              onMovePoint={(index, point) =>
                setPendingPoints((current) =>
                  current.map((existing, position) => (position === index ? point : existing)),
                )
              }
              isOutlineComplete={isOutlineComplete}
              onRemoveLastPoint={() => {
                setPendingPoints((current) => current.slice(0, -1))
                setIsOutlineComplete(false)
              }}
              onSuccess={handleCreated}
              points={pendingPoints}
            />
          ) : (
            selected && (
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
            )
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
