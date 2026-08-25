import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type BulkLifecycleIntent,
  BulkResourceLifecycleActions,
} from '@/components/resource-map/bulk-resource-lifecycle-actions'
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
import { MINIMUM_FOOTPRINT_POINTS } from '@/features/warehouses/geometry/footprint-validation'
import { WarehouseLegend } from '@/features/warehouses/map/warehouse-legend'
import { WarehouseMap } from '@/features/warehouses/map/warehouse-map'
import { useWarehouseMutations } from '@/features/warehouses/mutations/use-warehouse-mutations'
import { warehouseQueries } from '@/features/warehouses/queries/warehouse-queries'
import type { WarehouseStatus } from '@/features/warehouses/types'
import { CreateWarehousePanel } from '@/features/warehouses/ui/create-warehouse-panel'
import { UpdateWarehousePanel } from '@/features/warehouses/ui/update-warehouse-panel'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { useWarehouseEditSession } from '@/features/warehouses/use-warehouse-edit-session'
import {
  countAvailableDoorsIn,
  countRestorableDoorsIn,
  describeBulkDoorCascade,
  describeBulkDoorRestore,
  toBulkLifecycleOutcome,
} from '@/features/warehouses/warehouse-lifecycle-adapter'
import { presentWarehouses, warehouseMatchesSearch } from '@/features/warehouses/warehouse-search'
import { useIsMobile } from '@/hooks/use-mobile'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

/** The lifecycle status a warehouse must hold to take part in a selection of this intent. Declared
 * here rather than imported from the checkpoints feature, which owns an equivalent map for its own
 * resources; warehouses do not otherwise depend on checkpoints. */
const statusForIntent = (intent: BulkLifecycleIntent): WarehouseStatus =>
  intent === 'REACTIVATE' ? 'ARCHIVED' : 'AVAILABLE'

export function WarehousesPage() {
  const { create, doorId, doorStatus, edit, search, selecting, status, warehouseId } =
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
  // Same for `edit`: without the permission it never opens a session, and the session itself
  // refuses an archived warehouse because those are read-only until reactivated.
  const isEditRequested = canManageWarehouses && edit === 'warehouse' && !isCreating
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
  const {
    isEditing,
    session: editSession,
    draftPoints,
    movePoint,
    insertPoint,
    removePoint,
    restoreOrigin,
    clear: clearEditSession,
  } = useWarehouseEditSession({ requested: isEditRequested, selected })

  // The status of any currently checked warehouse fixes what a selection is for — Available means
  // an archive is in progress, Archived means a reactivation is — since the selection is
  // homogeneous by construction (see checkableIds below). Undefined while nothing is checked, so
  // any warehouse may still start either kind of selection.
  const selectionIntent: BulkLifecycleIntent | undefined = useMemo(() => {
    if (checkedIds.size === 0) {
      return undefined
    }
    const [firstCheckedId] = checkedIds

    return warehouses.find((warehouse) => warehouse.id === firstCheckedId)?.status === 'ARCHIVED'
      ? 'REACTIVATE'
      : 'ARCHIVE'
  }, [checkedIds, warehouses])
  // With nothing checked the lifecycle filter breaks the tie, so opening select mode from the
  // archived view offers a reactivation rather than an archival.
  const bulkIntent: BulkLifecycleIntent =
    selectionIntent ?? (status === 'archived' ? 'REACTIVATE' : 'ARCHIVE')
  // Only an administrator may check anything, and only a warehouse whose status matches the
  // selection's intent — or, with nothing checked yet, either status. Derived from `visible`,
  // which the status filter scopes but the search term only annotates — so switching lifecycle
  // view drops what it no longer lists, while typing a search never prunes what the administrator
  // already chose. Keyed on the ids so the set stays referentially stable across renders that
  // changed nothing.
  const checkableIdsKey = canManageWarehouses
    ? visible
        .filter(
          (warehouse) => !selectionIntent || warehouse.status === statusForIntent(selectionIntent),
        )
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
      // With nothing checked, `checkableIds` spans both lifecycle states so either kind of
      // selection can be started. Select-all has to commit to one, or it would build the mixed
      // selection every other rule exists to prevent.
      const targetIds = visible
        .filter(
          (warehouse) =>
            checkableIds.has(warehouse.id) && warehouse.status === statusForIntent(bulkIntent),
        )
        .map((warehouse) => warehouse.id)
      if (targetIds.length === 0) {
        return
      }
      event.preventDefault()
      setCheckedIds(new Set(targetIds))
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
    [bulkIntent, checkableIds, navigate, visible],
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
          edit: undefined,
          warehouseId: undefined,
        }),
      })
    }
  }, [navigate, query.data, selected, warehouseId])

  // `edit` is scoped to the selection it was opened for, so it never outlives it: left behind, it
  // would arm the update mode for whichever warehouse is selected next.
  useEffect(() => {
    if (edit && !warehouseId) {
      void navigate({ replace: true, search: (previous) => ({ ...previous, edit: undefined }) })
    }
  }, [edit, navigate, warehouseId])

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
        edit: undefined,
      }),
    })
  const selectWarehouse = (warehouse: (typeof visible)[number]) =>
    void navigate({
      search: (previous) => ({
        ...previous,
        warehouseId: previous.warehouseId === warehouse.id ? undefined : warehouse.id,
        doorId: undefined,
        doorStatus: undefined,
        edit: undefined,
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
  const startCreating = () => {
    // Activating creation ends an update in progress without saving it: at most one map mode.
    clearEditSession()
    void navigate({
      search: (previous) => ({
        ...previous,
        create: 'warehouse' as const,
        edit: undefined,
        warehouseId: undefined,
        doorId: undefined,
        doorStatus: undefined,
      }),
    })
  }
  const cancelCreating = () =>
    void navigate({ search: (previous) => ({ ...previous, create: undefined }) })

  const startUpdating = () =>
    void navigate({
      search: (previous) => ({ ...previous, create: undefined, edit: 'warehouse' as const }),
    })
  const cancelUpdating = () => {
    clearEditSession()
    void navigate({ search: (previous) => ({ ...previous, edit: undefined }) })
  }
  const handleUpdateNotFound = () => {
    clearEditSession()
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, edit: undefined, warehouseId: undefined }),
    })
  }
  const updateWarehouse = async (value: { name: string; points: LatLng[] }) => {
    const result = await mutations.update.mutateAsync({
      params: { id: selected?.id ?? '' },
      body: { name: value.name, footprint: { points: value.points } },
    })

    return result.data
  }
  // The corrected warehouse stays prominent: a rename that no longer matches the active search
  // would otherwise leave it dimmed on the map the moment the administrator finished working on it.
  // The test is the list's own matcher, so a rename the search still accepts — accents and all —
  // never costs the administrator their filter.
  const handleUpdated = (warehouse: { id: string; name: string }) => {
    clearEditSession()

    void navigate({
      search: (previous) => ({
        ...previous,
        edit: undefined,
        search: warehouseMatchesSearch(warehouse, search) ? previous.search : '',
        warehouseId: warehouse.id,
      }),
    })
  }
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
            editing={
              isEditing && editSession
                ? {
                    warehouseId: editSession.warehouseId,
                    points: draftPoints,
                    onMovePoint: movePoint,
                    onInsertPoint: insertPoint,
                    onRemovePoint: removePoint,
                    minimumPoints: MINIMUM_FOOTPRINT_POINTS,
                  }
                : undefined
            }
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
          // The door-in-use wording belongs to archival only: reactivation has no usage blocker,
          // so overriding the label there would describe a reason that cannot occur.
          blockerReasonLabels={
            bulkIntent === 'ARCHIVE'
              ? { IN_USE: 'a door is used by an active or planned discharge' }
              : undefined
          }
          description={
            bulkIntent === 'REACTIVATE'
              ? describeBulkDoorRestore(
                  checkedWarehouses.length,
                  countRestorableDoorsIn(checkedWarehouses),
                )
              : describeBulkDoorCascade(
                  checkedWarehouses.length,
                  countAvailableDoorsIn(checkedWarehouses),
                )
          }
          idPrefix="warehouse"
          intent={bulkIntent}
          onClear={clearChecked}
          onSuccess={(outcome) => {
            // Only an archival leaves anything worth keeping checked: IN_USE is the one blocker an
            // administrator can resolve and retry, so the selection narrows to exactly those and
            // stays homogeneously Available. Every other blocker — and both reactivation blockers,
            // NOT_FOUND and ALREADY_AVAILABLE — is final on a retry, and keeping one checked would
            // leave a warehouse whose refreshed status flips `selectionIntent` under the toolbar.
            setCheckedIds(
              bulkIntent === 'ARCHIVE'
                ? new Set(
                    outcome.blocked
                      .filter((blocked) => blocked.reason === 'IN_USE')
                      .map((blocked) => blocked.id),
                  )
                : new Set(),
            )
          }}
          plural="warehouses"
          refresh={mutations.refreshWarehouses}
          selectedIds={[...checkedIds]}
          singular="warehouse"
          submit={async ({ ids, comment }) =>
            toBulkLifecycleOutcome(
              (
                await (bulkIntent === 'REACTIVATE'
                  ? mutations.reactivateMany
                  : mutations.archiveMany
                ).mutateAsync({ body: { ids, comment } })
              ).data,
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
          if (isEditing) {
            cancelUpdating()
            return
          }
          void navigate({
            replace: true,
            search: (previous) => ({
              ...previous,
              warehouseId: undefined,
              doorStatus: undefined,
              doorId: undefined,
              edit: undefined,
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
          ) : isEditing && selected && editSession ? (
            <UpdateWarehousePanel
              onCancel={cancelUpdating}
              onInsertPoint={insertPoint}
              onMovePoint={movePoint}
              onNotFound={handleUpdateNotFound}
              onRemovePoint={removePoint}
              onRestoreOutline={restoreOrigin}
              onSuccess={handleUpdated}
              onUpdate={updateWarehouse}
              originName={editSession.originName}
              originPoints={editSession.originPoints}
              points={draftPoints}
              warehouse={selected}
            />
          ) : (
            selected && (
              <div className="flex min-h-0 flex-1 flex-col">
                <WarehouseDetails canManageLifecycle={canManageWarehouses} warehouse={selected} />
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
                {/* Archived warehouses are read-only until they are reactivated (#211), so the
                    action is absent rather than disabled — as it is for archived trucks. */}
                {canManageWarehouses && selected.status === 'AVAILABLE' && (
                  <footer className="flex shrink-0 gap-2 border-t bg-popover px-5 py-4 md:px-6">
                    <Button onClick={startUpdating}>Edit</Button>
                  </footer>
                )}
              </div>
            )
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
