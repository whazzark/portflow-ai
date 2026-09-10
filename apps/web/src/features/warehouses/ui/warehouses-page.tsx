import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BulkResourceLifecycleActions,
  BulkResourceLifecycleDialog,
} from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import {
  ACTION_BY_BULK_INTENT,
  type BulkLifecycleIntent,
} from '@/components/lifecycle/lifecycle-copy'
import {
  useClearSelectionShortcut,
  useSelectAllShortcut,
} from '@/components/lifecycle/use-bulk-selection-shortcuts'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { useWarehouseDoorMutations } from '@/features/warehouse-doors/mutations/use-warehouse-door-mutations'
import type { WarehouseDoorStatusFilter } from '@/features/warehouse-doors/types'
import { CreateWarehouseDoorPanel } from '@/features/warehouse-doors/ui/create-warehouse-door-panel'
import { EditWarehouseDoorPanel } from '@/features/warehouse-doors/ui/edit-warehouse-door-panel'
import { WarehouseDoorsPanel } from '@/features/warehouse-doors/ui/warehouse-doors-panel'
import { useWarehouseDoorEditSession } from '@/features/warehouse-doors/use-warehouse-door-edit-session'
import {
  toBulkWarehouseDoorLifecycleOutcome,
  WAREHOUSE_DOOR_BLOCKER_REASON_LABELS,
  WAREHOUSE_DOOR_PLURAL,
  WAREHOUSE_DOOR_SINGULAR,
} from '@/features/warehouse-doors/warehouse-door-lifecycle'
import {
  DOOR_SINGULAR,
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
import { EditWarehousePanel } from '@/features/warehouses/ui/edit-warehouse-panel'
import { WarehouseDetails } from '@/features/warehouses/ui/warehouse-details'
import { WarehouseMapControls } from '@/features/warehouses/ui/warehouse-map-controls'
import { WarehousesError } from '@/features/warehouses/ui/warehouses-error'
import { useWarehouseEditSession } from '@/features/warehouses/use-warehouse-edit-session'
import {
  countDoorsIn,
  describeBulkWarehouseEffect,
  toBulkWarehouseLifecycleOutcome,
  WAREHOUSE_BLOCKER_REASON_LABELS,
  WAREHOUSE_PLURAL,
  WAREHOUSE_SINGULAR,
  WarehouseLifecycleActions,
} from '@/features/warehouses/warehouse-lifecycle'
import { presentWarehouses, warehouseMatchesSearch } from '@/features/warehouses/warehouse-search'
import { resourceSuccessMessage } from '@/helpers/resource-copy'
import { useIsMobile } from '@/hooks/use-mobile'

const warehousesRoute = getRouteApi('/_authenticated/warehouses')

/** The lifecycle status a warehouse must hold to take part in a selection of this intent. Declared
 * here rather than imported from the checkpoints feature, which owns an equivalent map for its own
 * resources; warehouses do not otherwise depend on checkpoints. */
const statusForIntent = (intent: BulkLifecycleIntent): WarehouseStatus =>
  intent === 'REACTIVATE' ? 'ARCHIVED' : 'AVAILABLE'

/** Door creation is scoped to the one warehouse it was opened for, so it is dropped whenever that
 * selection changes or goes away. A `create=warehouse` is page-scoped — an armed drawing that owns
 * the map — and survives those same navigations untouched. */
const withoutDoorCreation = (create: 'warehouse' | 'door' | undefined) =>
  create === 'door' ? undefined : create

/** Same reasoning for the update mode: `edit=door` is scoped to the one door it was opened for, so
 * it is dropped whenever that selection changes or goes away. A `edit=warehouse` is scoped to the
 * warehouse and survives a door selection changing under it. */
const withoutDoorEditing = (edit: 'warehouse' | 'door' | undefined) =>
  edit === 'door' ? undefined : edit

/** Referentially stable, so an unselected view never hands the panel and the map a new Set. */
const EMPTY_DOOR_SELECTION: ReadonlySet<string> = new Set<string>()

export function WarehousesPage() {
  const { create, doorId, doorStatus, edit, search, selecting, status, warehouseId } =
    warehousesRoute.useSearch()
  const navigate = warehousesRoute.useNavigate()
  const user = useAuthenticatedUser()
  const canManageWarehouses = isAdministrator(user)
  const isMobile = useIsMobile()
  const isSelecting = canManageWarehouses && selecting === 'warehouses'
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  // Doors are selected inside the warehouse they belong to, so unlike `selecting=warehouses` — which
  // clears `warehouseId` on entry — this keeps the selection it acts on.
  //
  // Carried *with* the warehouse it was built in, exactly as a pending door placement is, so no
  // render ever reads a selection built somewhere else. That alone is not enough for a selection,
  // though: unlike a pending point, one left behind would come back the moment its context did —
  // see the two effects below, which drop it for good.
  const [doorSelection, setDoorSelection] = useState<{
    warehouseId: string
    ids: Set<string>
  } | null>(null)
  const mutations = useWarehouseMutations()
  const query = useQuery(warehouseQueries.list())
  // A `create` param a non-administrator cannot act on stays inert: no panel, no armed map.
  const isCreating = canManageWarehouses && create === 'warehouse'
  // Same for `edit`: without the permission it never opens a session, and the session itself
  // refuses an archived warehouse because those are read-only until reactivated.
  // Either creation mode owns the sheet, so neither leaves room for an update session.
  const isEditRequested = canManageWarehouses && edit === 'warehouse' && create === undefined
  // Same gate for the door update: a creation mode owns the sheet, so neither leaves room for one.
  const isDoorEditRequested = canManageWarehouses && edit === 'door' && create === undefined
  const [pendingPoints, setPendingPoints] = useState<LatLng[]>([])
  // A finished outline stops taking new points; removing one reopens it for further drawing.
  const [isOutlineComplete, setIsOutlineComplete] = useState(false)
  // Kept with the warehouse it was placed in, so a point never survives a switch to another
  // warehouse: a stale one is simply not read rather than having to be cleared by an effect.
  const [pendingDoor, setPendingDoor] = useState<{ warehouseId: string; point: LatLng } | null>(
    null,
  )
  const doorMutations = useWarehouseDoorMutations()
  // The lifecycle view placement was entered from, kept so cancelling can restore it.
  const doorStatusBeforeCreating = useRef<WarehouseDoorStatusFilter | undefined>(undefined)
  // Which of this page's two collections a Ctrl/Cmd+A means is decided by whether focus is inside
  // the panel — see `selectAllInFocus` below.
  const panelRef = useRef<HTMLDivElement>(null)

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
  // Door creation is scoped to one warehouse rather than to the page: the mode is real only when
  // the administrator may manage doors and `warehouseId` resolves to an *available* warehouse.
  // Anything else — no permission, no or unknown id, an archived warehouse — renders consultation.
  const selectedStatus = selected?.status
  const selectedId = selected?.id
  const isCreatingDoor =
    canManageWarehouses && create === 'door' && selected?.status === 'AVAILABLE'
  // Leaving the mode — cancelling, dismissing the sheet, navigating away — discards the pending
  // point rather than carrying it into the next session, including one the browser's Back button
  // returns to. Switching to another warehouse without leaving needs no cleanup: a point kept with
  // the warehouse it was placed in is simply not read once another one is selected.
  useEffect(() => {
    if (!isCreatingDoor) {
      setPendingDoor(null)
    }
  }, [isCreatingDoor])
  const pendingDoorPoint =
    isCreatingDoor && pendingDoor?.warehouseId === selected?.id ? pendingDoor.point : null
  const placePendingDoor = (point: LatLng) =>
    setPendingDoor(selected ? { warehouseId: selected.id, point } : null)

  // Checking doors is offered, never entered: an administrator who opens an available warehouse's
  // Available doors can check one straight away. What still withholds it is what would make a check
  // meaningless — an archived warehouse, the Archived view, or a creation or update session, which
  // replaces the list with a form and arms the map.
  const canSelectDoors =
    canManageWarehouses &&
    selected?.status === 'AVAILABLE' &&
    effectiveDoorStatus === 'available' &&
    create === undefined &&
    edit === undefined

  // Withholds a selection whose context has just gone — the render before the effects below drop
  // it — so no checkbox, no map ring, and no `Archive selected` ever outlives it by a frame.
  const checkedDoorIds = useMemo(
    () =>
      doorSelection && canSelectDoors && doorSelection.warehouseId === selectedId
        ? doorSelection.ids
        : EMPTY_DOOR_SELECTION,
    [canSelectDoors, doorSelection, selectedId],
  )
  // The doors a selection may hold: the available ones this warehouse currently lists. Keyed on the
  // ids so the set stays referentially stable across renders that changed nothing — the warehouse
  // selection's own `checkableIds` above does the same.
  const checkableDoorIdsKey = canSelectDoors ? admittedDoors.map((door) => door.id).join(',') : ''
  const checkableDoorIds = useMemo(
    () => new Set(checkableDoorIdsKey ? checkableDoorIdsKey.split(',') : []),
    [checkableDoorIdsKey],
  )

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

  const {
    isEditing: isEditingDoor,
    session: doorEditSession,
    draft: doorDraft,
    setDraft: setDoorDraft,
    restoreOrigin: restoreDoorOrigin,
    clear: clearDoorEditSession,
  } = useWarehouseDoorEditSession({
    requested: isDoorEditRequested,
    warehouse: selected,
    door: admittedDoor,
  })

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
  const selectAllDoors = useCallback(
    (event: KeyboardEvent) => {
      if (!selected || checkableDoorIds.size === 0) {
        return
      }
      event.preventDefault()
      setDoorSelection({ warehouseId: selected.id, ids: new Set(checkableDoorIds) })
    },
    [checkableDoorIds, selected],
  )
  // One keystroke, one meaning at a time — settled by where focus is, not by which collection
  // happens to be selectable. This page's panel is deliberately unmodal (`modal={false}`, no
  // overlay), so an open warehouse leaves the map behind it fully workable: pannable, filterable,
  // clickable. A press made out there is therefore still about the map, even with a doors list on
  // screen. #214's note said doors got no binding because the trucks and customers directories
  // had none either — they have one now, and focus is what keeps the keystroke unambiguous.
  const selectAllInFocus = useCallback(
    (event: KeyboardEvent) => {
      if (panelRef.current?.contains(document.activeElement)) {
        // Inside the panel the press can only mean the list it shows: its available doors, or
        // nothing at all where the open warehouse or view offers no selection — an archived
        // warehouse, the Archived doors, a creation or update session. Never the map behind, whose
        // select-all clears `warehouseId` and would tear down the panel being read, taking an
        // in-progress footprint edit and its draft points with it.
        if (canSelectDoors) {
          selectAllDoors(event)
        }
        return
      }

      selectAllVisible(event)
    },
    [canSelectDoors, selectAllDoors, selectAllVisible],
  )
  useSelectAllShortcut({ enabled: canManageWarehouses, onSelectAll: selectAllInFocus })
  // Doors get no `Escape` binding, unlike the map's selection. Inside a sheet that key already
  // means "close this", which is a stronger convention than any shortcut we would add, and the
  // panel's own "Clear selection" button is right beside the count anyway.

  const clearChecked = useCallback(() => setCheckedIds(new Set()), [])
  // Opened from the Doors panel rather than from a floating bar: the selection lives in that list,
  // and a bar hovering between the panel and the map legend is where an administrator never looks.
  const [isArchivingDoors, setIsArchivingDoors] = useState(false)
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

  // `edit` and a door-scoped `create` are scoped to the selection they were opened for, so neither
  // ever outlives it: left behind, they would arm the update or the door-creation mode for
  // whichever warehouse is selected next — including one arrived at from a shared URL.
  useEffect(() => {
    if ((edit || create === 'door') && !warehouseId) {
      void navigate({
        replace: true,
        search: (previous) => ({
          ...previous,
          create: withoutDoorCreation(previous.create),
          edit: undefined,
        }),
      })
    }
  }, [create, edit, navigate, warehouseId])

  // A door-scoped `edit` outliving its door would arm the update for whichever door is selected
  // next — including one arrived at from a shared URL — so it goes as soon as `doorId` does.
  useEffect(() => {
    if (edit === 'door' && !doorId) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, edit: withoutDoorEditing(previous.edit) }),
      })
    }
  }, [doorId, edit, navigate])

  // Dormant rather than dropped, a door-scoped `create` would arm placement the moment the archived
  // warehouse it points at is reactivated (#211) — an action the administrator never asked for. So
  // the param goes as soon as the selection turns out to be one that cannot take a new door.
  useEffect(() => {
    if (create === 'door' && selectedStatus === 'ARCHIVED') {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, create: withoutDoorCreation(previous.create) }),
      })
    }
  }, [create, navigate, selectedStatus])

  // Same for the update: dormant rather than dropped, `edit=door` would arm the session the moment
  // an archived door or its archived warehouse was reactivated (#211, #216) — an action the
  // administrator never asked for.
  useEffect(() => {
    if (
      edit === 'door' &&
      query.data &&
      admittedDoor !== undefined &&
      (selectedStatus === 'ARCHIVED' || admittedDoor.status === 'ARCHIVED')
    ) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, edit: withoutDoorEditing(previous.edit) }),
      })
    }
  }, [admittedDoor, edit, navigate, query.data, selectedStatus])

  // Also what happens after a door is archived (#215): the door leaves the Available view, so its
  // selection is dropped and the administrator stays on the warehouse with its Doors panel. Nothing
  // is forced — no switch to the Archived view, no re-selection — because archival moves a door the
  // administrator was already looking at one click away, and the toast already reports the outcome.
  // Creation reveals a door that exists nowhere else, which is why it does the opposite.
  useEffect(() => {
    if (query.data && selected && doorId && !admittedDoor) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, doorId: undefined }),
      })
    }
  }, [admittedDoor, doorId, navigate, query.data, selected])

  // A door selection lives only in the context it was built in, and leaving that context ends it
  // for good — the rule the warehouse select mode already follows. Withholding it instead would
  // let it resurrect: cancelling a creation, switching lifecycle view and back, or reopening the
  // same warehouse would each bring back a queue the administrator watched disappear (FR-041), and
  // an id checked in a warehouse can never be allowed to reappear under another (FR-040).
  useEffect(() => {
    setDoorSelection((current) =>
      current === null || (canSelectDoors && current.warehouseId === selectedId) ? current : null,
    )
  }, [canSelectDoors, selectedId])

  // Drops ids the Available list no longer holds — a door archived from its own row menu, or by
  // another administrator between two refetches. Without it the id would stay checked with no row
  // to show for it, and `Archive selected` would resubmit a door the view does not list, earning a
  // spurious "already archived" in the outcome (FR-040). The warehouse selection prunes itself the
  // same way against `checkableIds`.
  useEffect(() => {
    setDoorSelection((current) => {
      if (!current || current.ids.size === 0) {
        return current
      }
      const ids = new Set([...current.ids].filter((id) => checkableDoorIds.has(id)))

      return ids.size === current.ids.size ? current : { ...current, ids }
    })
  }, [checkableDoorIds])

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
        create: withoutDoorCreation(previous.create),
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
        create: withoutDoorCreation(previous.create),
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
  const toggleDoorChecked = (doorId: string) => {
    if (!selected) {
      return
    }
    const next = new Set(checkedDoorIds)
    if (next.has(doorId)) {
      next.delete(doorId)
    } else {
      next.add(doorId)
    }
    setDoorSelection({ warehouseId: selected.id, ids: next })
  }
  const selectAllDoorsIn = (checked: boolean, doorIds: string[]) => {
    if (!selected) {
      return
    }
    setDoorSelection({ warehouseId: selected.id, ids: new Set(checked ? doorIds : []) })
  }
  const clearDoorSelection = () => setDoorSelection(null)

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
    clearDoorEditSession()
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
    toast.success(resourceSuccessMessage('update', WAREHOUSE_SINGULAR, warehouse.name))

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
  const handleCreated = (warehouse: { id: string; name: string }) => {
    toast.success(resourceSuccessMessage('create', WAREHOUSE_SINGULAR, warehouse.name))
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
  }

  // The lifecycle view follows the door being created, which is always Available: entered from the
  // Archived tab, placement would otherwise hide every existing door — exactly the ones the
  // administrator needs on the map to place a new one between them.
  const startCreatingDoor = () => {
    clearEditSession()
    clearDoorEditSession()
    doorStatusBeforeCreating.current = doorStatus
    void navigate({
      search: (previous) => ({
        ...previous,
        create: 'door' as const,
        edit: undefined,
        doorId: undefined,
        doorStatus: 'available' as const,
      }),
    })
  }
  // Cancelling undoes the forced view along with the mode: an administrator who reached placement
  // from the Archived tab is put back on it, rather than left on Available with nothing to explain
  // why the list changed. A created door keeps Available, where it is the one that matters.
  const cancelCreatingDoor = () =>
    void navigate({
      search: (previous) => ({
        ...previous,
        create: undefined,
        doorStatus: doorStatusBeforeCreating.current,
      }),
    })
  const createWarehouseDoor = async (value: {
    name: string
    latitude: number
    longitude: number
  }) => {
    const result = await doorMutations.create.mutateAsync({
      body: { warehouseId: selected?.id ?? '', ...value },
    })

    return result.data
  }
  const startUpdatingDoor = (nextDoorId: string) => {
    // Activating a door update ends any warehouse update in progress without saving it: at most one
    // map mode. Selecting the door and opening its session are one navigation, so the action does
    // not require the row to have been selected first.
    clearEditSession()
    void navigate({
      search: (previous) => ({
        ...previous,
        create: undefined,
        doorId: nextDoorId,
        edit: 'door' as const,
      }),
    })
  }
  const cancelUpdatingDoor = () => {
    clearDoorEditSession()
    void navigate({ search: (previous) => ({ ...previous, edit: undefined }) })
  }
  // The door the session was opened for is gone: drop the selection with it, so the administrator
  // lands on a consistent view of the warehouse's remaining doors rather than on a ghost.
  const handleDoorUpdateNotFound = () => {
    clearDoorEditSession()
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, doorId: undefined, edit: undefined }),
    })
  }
  const updateWarehouseDoor = async (value: {
    name: string
    latitude: number
    longitude: number
  }) => {
    const result = await doorMutations.update.mutateAsync({
      params: { id: doorEditSession?.doorId ?? '' },
      body: value,
    })

    return result.data
  }
  // The corrected door stays selected. Unlike #209 there is nothing to reveal it from: `search`
  // matches warehouses, so no door name takes part in the filter and a rename can hide nothing;
  // and the update cannot change a door's status, so the lifecycle view still contains it.
  const handleDoorUpdated = (door: { name: string }) => {
    clearDoorEditSession()
    toast.success(resourceSuccessMessage('update', DOOR_SINGULAR, door.name))
    void navigate({ search: (previous) => ({ ...previous, edit: undefined }) })
  }

  // The lifecycle view stays on Available, where placement put it, and follows the new door.
  const handleDoorCreated = (door: { id: string; name: string }) => {
    toast.success(resourceSuccessMessage('create', DOOR_SINGULAR, door.name))
    void navigate({
      search: (previous) => ({
        ...previous,
        create: undefined,
        doorStatus: 'available' as const,
        doorId: door.id,
      }),
    })
  }

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
            doorPlacement={
              isCreatingDoor
                ? {
                    armed: true,
                    pending: pendingDoorPoint,
                    onPlace: placePendingDoor,
                    onMove: placePendingDoor,
                  }
                : isEditingDoor && doorEditSession && doorDraft
                  ? {
                      // Unarmed: a door under correction is moved by dragging its own marker or by
                      // typing coordinates. Among sibling door markers a map click reads as "select
                      // that one", so it must place nothing at all.
                      armed: false,
                      pending: doorDraft,
                      onPlace: setDoorDraft,
                      onMove: setDoorDraft,
                      label: doorEditSession.originName,
                      doorId: doorEditSession.doorId,
                    }
                  : undefined
            }
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
            doorSelectMode={canSelectDoors}
            checkedDoorIds={checkedDoorIds}
            onToggleDoorChecked={toggleDoorChecked}
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
          action={ACTION_BY_BULK_INTENT[bulkIntent]}
          // The door-in-use wording belongs to archival only: reactivation has no usage blocker,
          // so overriding the label there would describe a reason that cannot occur.
          blockerReasonLabels={
            bulkIntent === 'ARCHIVE' ? WAREHOUSE_BLOCKER_REASON_LABELS : undefined
          }
          describeEffect={(action) =>
            describeBulkWarehouseEffect(
              action,
              checkedWarehouses.length,
              countDoorsIn(checkedWarehouses),
            )
          }
          idPrefix="warehouse"
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
          plural={WAREHOUSE_PLURAL}
          refresh={mutations.refreshWarehouses}
          selectedIds={[...checkedIds]}
          singular={WAREHOUSE_SINGULAR}
          submit={async ({ ids, comment }) =>
            toBulkWarehouseLifecycleOutcome(
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
      <BulkResourceLifecycleDialog
        action="archive"
        // No `describeEffect`: a door cascades onto nothing, so the canonical sentence is already
        // exactly true. The labels override nothing either — the shared `IN_USE` reads "used by an
        // active or planned discharge", which is the plain truth for a door, unlike a warehouse
        // that is blocked by one of *its* doors — it only adds the reason the shared four omit.
        blockerReasonLabels={WAREHOUSE_DOOR_BLOCKER_REASON_LABELS}
        idPrefix="warehouse-door"
        onOpenChange={setIsArchivingDoors}
        onSuccess={(outcome) => {
          // `IN_USE` is the one blocker an administrator can resolve and retry — close the
          // discharge, end the assignment — so the selection narrows to exactly those. Every other
          // reason is final on a retry, and a door archived elsewhere would sit checked in a view
          // that no longer lists it.
          setDoorSelection(
            selected
              ? {
                  warehouseId: selected.id,
                  ids: new Set(
                    outcome.blocked
                      .filter((blocked) => blocked.reason === 'IN_USE')
                      .map((blocked) => blocked.id),
                  ),
                }
              : null,
          )
        }}
        open={isArchivingDoors}
        plural={WAREHOUSE_DOOR_PLURAL}
        refresh={doorMutations.refreshWarehouseDoors}
        selectedIds={[...checkedDoorIds]}
        singular={WAREHOUSE_DOOR_SINGULAR}
        submit={async ({ ids, comment }) =>
          toBulkWarehouseDoorLifecycleOutcome(
            (await doorMutations.archiveMany.mutateAsync({ body: { ids, comment } })).data,
          )
        }
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
          if (isCreatingDoor) {
            cancelCreatingDoor()
            return
          }
          if (isEditingDoor) {
            cancelUpdatingDoor()
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
          ref={panelRef}
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
          ) : isCreatingDoor && selected ? (
            <CreateWarehouseDoorPanel
              onCancel={cancelCreatingDoor}
              onCreate={createWarehouseDoor}
              onPendingChange={placePendingDoor}
              onSuccess={handleDoorCreated}
              pending={pendingDoorPoint}
              warehouse={selected}
            />
          ) : isEditingDoor && selected && admittedDoor && doorEditSession && doorDraft ? (
            <EditWarehouseDoorPanel
              door={admittedDoor}
              draft={doorDraft}
              onCancel={cancelUpdatingDoor}
              onDraftChange={setDoorDraft}
              onNotFound={handleDoorUpdateNotFound}
              onRestorePosition={restoreDoorOrigin}
              onSuccess={handleDoorUpdated}
              onUpdate={updateWarehouseDoor}
              origin={doorEditSession.origin}
              originName={doorEditSession.originName}
              warehouse={selected}
            />
          ) : isEditing && selected && editSession ? (
            <EditWarehousePanel
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
                <WarehouseDetails warehouse={selected} />
                <WarehouseDoorsPanel
                  warehouse={selected}
                  status={effectiveDoorStatus}
                  selectedDoorId={admittedDoor?.id}
                  onStatusChange={(next) => {
                    // No selection to clear here: the Archived view is not one a selection can live
                    // in, so the context effect above drops it — and keeps it dropped when the
                    // administrator returns to Available.
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        doorStatus: next,
                        doorId: undefined,
                      }),
                    })
                  }}
                  onDoorSelect={selectDoor}
                  onCreateDoor={
                    canManageWarehouses && selected.status === 'AVAILABLE'
                      ? startCreatingDoor
                      : undefined
                  }
                  // Present for any administrator; each row is gated again by its own and its
                  // warehouse's lifecycle state, and renders no menu at all when it has nothing to
                  // offer. Server-side authorization stays authoritative — this only mirrors it.
                  canAdministerDoors={canManageWarehouses}
                  onEditDoor={canManageWarehouses ? startUpdatingDoor : undefined}
                  selectMode={canSelectDoors}
                  selectionAction={
                    checkedDoorIds.size > 0 ? (
                      <Button
                        onClick={() => setIsArchivingDoors(true)}
                        size="sm"
                        variant="destructive"
                      >
                        Archive selected
                      </Button>
                    ) : undefined
                  }
                  checkedDoorIds={checkedDoorIds}
                  onToggleChecked={toggleDoorChecked}
                  onSelectAll={selectAllDoorsIn}
                  onClearSelection={clearDoorSelection}
                />
                {/* One footer for every action on the warehouse. Editing is absent rather than
                    disabled for an archived warehouse, which is read-only until it is reactivated
                    (#211) — as it is for archived trucks — while the lifecycle action itself is
                    what offers that reactivation. */}
                {canManageWarehouses && (
                  <footer className="flex shrink-0 items-center gap-2 border-t bg-popover px-5 py-4 md:px-6">
                    {selected.status === 'AVAILABLE' && (
                      <Button onClick={startUpdating}>Edit</Button>
                    )}
                    <WarehouseLifecycleActions className="ml-auto" warehouse={selected} />
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
