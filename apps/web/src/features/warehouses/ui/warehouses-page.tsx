import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BulkResourceLifecycleActions } from '@/components/resource-map/bulk-resource-lifecycle-actions'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import {
  useClearSelectionShortcut,
  useSelectAllShortcut,
} from '@/components/resource-map/use-bulk-selection-shortcuts'
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
import {
  countAvailableDoorsIn,
  describeBulkDoorCascade,
  toBulkLifecycleOutcome,
} from '@/features/warehouses/warehouse-lifecycle-adapter'
import { presentWarehouses } from '@/features/warehouses/warehouse-search'
import { useIsMobile } from '@/hooks/use-mobile'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

export function WarehousesPage() {
  const { create, doorId, doorStatus, search, selecting, status, warehouseId } =
    warehousesRoute.useSearch()
  const navigate = warehousesRoute.useNavigate()
  const user = useAuthenticatedUser()
  const canManageWarehouses = isAdministrator(user)
  const isMobile = useIsMobile()
  const isSelecting = canManageWarehouses && selecting === 'warehouses'
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const mutations = useWarehouseMutations()
  const query = useQuery(warehouseQueries.list())
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

  // Only available warehouses can be archived, and only an administrator may check anything.
  // Derived from `visible`, which the status filter scopes but the search term only annotates —
  // so switching lifecycle view drops what it no longer lists, while typing a search never prunes
  // what the administrator already chose. Keyed on the ids so the set stays referentially stable
  // across renders that changed nothing.
  const checkableIdsKey = canManageWarehouses
    ? visible
        .filter((warehouse) => warehouse.status === 'AVAILABLE')
        .map((warehouse) => warehouse.id)
        .join(',')
    : ''
  const checkableIds = useMemo(
    () => new Set(checkableIdsKey ? checkableIdsKey.split(',') : []),
    [checkableIdsKey],
  )
  const checkedWarehouses = useMemo(
    () => warehouses.filter((warehouse) => checkedIds.has(warehouse.id)),
    [checkedIds, warehouses],
  )

  useEffect(() => {
    if (!isSelecting) {
      setCheckedIds(new Set())
    }
  }, [isSelecting])

  // Drops ids that are no longer checkable — the status filter moved, or a refetch removed them —
  // while leaving search-hidden warehouses checked.
  useEffect(() => {
    setCheckedIds((current) => {
      if (current.size === 0) {
        return current
      }
      const next = new Set([...current].filter((id) => checkableIds.has(id)))

      return next.size === current.size ? current : next
    })
  }, [checkableIds])

  const selectAllVisible = useCallback(
    (event: KeyboardEvent) => {
      if (checkableIds.size === 0) {
        return
      }
      event.preventDefault()
      setCheckedIds(new Set(checkableIds))
      void navigate({
        search: (previous) => ({
          ...previous,
          doorId: undefined,
          doorStatus: undefined,
          selecting: 'warehouses' as const,
          warehouseId: undefined,
        }),
      })
    },
    [checkableIds, navigate],
  )
  useSelectAllShortcut({ enabled: canManageWarehouses, onSelectAll: selectAllVisible })

  const clearChecked = useCallback(() => setCheckedIds(new Set()), [])
  useClearSelectionShortcut({ enabled: isSelecting && checkedIds.size > 0, onClear: clearChecked })

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
  const startSelecting = (initialId?: string) => {
    setCheckedIds(initialId ? new Set([initialId]) : new Set())
    void navigate({
      search: (previous) => ({
        ...previous,
        doorId: undefined,
        doorStatus: undefined,
        selecting: 'warehouses' as const,
        warehouseId: undefined,
      }),
    })
  }
  const toggleSelectMode = () => {
    if (isSelecting) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, selecting: undefined }),
      })
      return
    }
    startSelecting()
  }
  const toggleChecked = (id: string) => {
    if (!checkableIds.has(id)) {
      return
    }
    setCheckedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }
  // Shift-clicking a checkable warehouse enters select mode and checks it, so the administrator
  // never has to reach for the map control first — the Checkpoints behaviour, unchanged.
  const handleShiftSelect = (id: string) => {
    if (isSelecting) {
      toggleChecked(id)
      return
    }
    startSelecting(id)
  }
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
    const result = await mutations.create.mutateAsync({
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
            selectMode={isSelecting}
            checkedIds={checkedIds}
            checkableIds={checkableIds}
            onToggleChecked={toggleChecked}
            onToggleSelectMode={canManageWarehouses ? toggleSelectMode : undefined}
            onShiftSelect={canManageWarehouses ? handleShiftSelect : undefined}
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
      {isSelecting && (
        <BulkResourceLifecycleActions
          blockerReasonLabels={{
            IN_USE: 'a door is used by an active or planned discharge',
          }}
          description={describeBulkDoorCascade(
            checkedWarehouses.length,
            countAvailableDoorsIn(checkedWarehouses),
          )}
          idPrefix="warehouse"
          intent="ARCHIVE"
          onClear={clearChecked}
          onSuccess={(outcome) => {
            // Narrowed to the blocked ids rather than cleared, so the administrator can resolve the
            // blocker and retry exactly those without reselecting them on the map.
            setCheckedIds(new Set(outcome.blocked.map((blocked) => blocked.id)))
          }}
          plural="warehouses"
          refresh={mutations.refreshWarehouses}
          selectedIds={[...checkedIds]}
          singular="warehouse"
          submit={async ({ ids, comment }) =>
            toBulkLifecycleOutcome(
              (await mutations.archiveMany.mutateAsync({ body: { ids, comment } })).data,
            )
          }
        />
      )}
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
                <WarehouseDetails canArchive={canManageWarehouses} warehouse={selected} />
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
