import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import { Button } from '@/components/ui/button'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { presentCheckpoints } from '@/features/checkpoints/checkpoint-search'
import {
  parseCheckpointSelection,
  serializeCheckpointSelection,
} from '@/features/checkpoints/checkpoint-selection'
import { CheckpointMap } from '@/features/checkpoints/map/checkpoint-map'
import { CheckpointKindIcon, CheckpointLegend } from '@/features/checkpoints/map/checkpoint-marker'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import {
  CHECKPOINT_KINDS,
  CHECKPOINT_PARAM_BY_KIND,
  type CheckpointKind,
  type CheckpointKindFilter,
  type CheckpointLayerVisibility,
  checkpointKindFilterFromVisibility,
  checkpointLayerVisibilityFromFilter,
} from '@/features/checkpoints/types'
import { BulkDockLifecycleActions } from '@/features/checkpoints/ui/bulk-dock-lifecycle-actions'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'
import {
  CheckpointSheet,
  type SelectedCheckpoint,
} from '@/features/checkpoints/ui/checkpoint-sheet'
import { CreateCheckpointPanel } from '@/features/checkpoints/ui/create-checkpoint-panel'
import { EditCheckpointPanel } from '@/features/checkpoints/ui/edit-checkpoint-panel'
import {
  type EditableCheckpoint,
  useCheckpointEditSession,
} from '@/features/checkpoints/use-checkpoint-edit-session'
import { toDockCheckpoint } from '@/features/docks/dock-checkpoint-adapter'
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import type { BulkDockLifecycleResult, DockDto } from '@/features/docks/types'
import { useWeighingAreaMutations } from '@/features/weighing-areas/mutations/use-weighing-area-mutations'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { toWeighingAreaCheckpoint } from '@/features/weighing-areas/weighing-area-checkpoint-adapter'

/** The `kinds` filter value that would hide a just-created checkpoint of this kind, so a
 * successful creation can widen it away (see `handleCreated`). */
const OPPOSITE_KIND_FILTER: Record<CheckpointKind, CheckpointKindFilter> = {
  DOCK: 'weighing-area',
  WEIGHING_AREA: 'dock',
}

const CREATE_LABEL_BY_KIND: Record<CheckpointKind, string> = {
  DOCK: 'New dock',
  WEIGHING_AREA: 'New weighing area',
}

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

export function CheckpointsPage() {
  const {
    checkpoint: checkpointParam,
    create,
    edit,
    kinds,
    search,
    selecting,
    status,
  } = checkpointsRoute.useSearch()
  const navigate = checkpointsRoute.useNavigate()
  const user = useAuthenticatedUser()
  const canManageCheckpoints = isAdministrator(user)
  const creationKind: CheckpointKind | null = !canManageCheckpoints
    ? null
    : create === 'dock'
      ? 'DOCK'
      : create === 'weighing-area'
        ? 'WEIGHING_AREA'
        : null
  // A creation flow wins if both params are somehow present, so two draft markers can never
  // coexist, and only an administrator may request edit mode at all.
  const requestedEditKind: CheckpointKind | null =
    !canManageCheckpoints || creationKind !== null
      ? null
      : edit === 'dock'
        ? 'DOCK'
        : edit === 'weighing-area'
          ? 'WEIGHING_AREA'
          : null
  const [pendingPlacement, setPendingPlacement] = useState<LatLng | null>(null)
  const isSelectingDocks = canManageCheckpoints && selecting === 'docks'
  const [checkedDockIds, setCheckedDockIds] = useState<Set<string>>(new Set())
  const dockMutations = useDockMutations()
  const weighingAreaMutations = useWeighingAreaMutations()
  const docksQuery = useQuery(dockQueries.list())
  const weighingAreasQuery = useQuery(weighingAreaQueries.list())
  const docks = docksQuery.data?.data ?? []
  const weighingAreas = weighingAreasQuery.isError ? [] : (weighingAreasQuery.data?.data ?? [])
  const layerVisibility = checkpointLayerVisibilityFromFilter(kinds)
  const checkpointCollection = useMemo(
    () => [...docks.map(toDockCheckpoint), ...weighingAreas.map(toWeighingAreaCheckpoint)],
    [docks, weighingAreas],
  )
  const counts = countResources(
    checkpointCollection,
    (checkpoint) => !layerVisibility || layerVisibility[checkpoint.kind],
  )
  const checkpoints = presentCheckpoints(checkpointCollection, status, search, layerVisibility)
  // The status of any currently checked dock fixes what a selection is for — Available means an
  // archive is in progress, Archived means a reactivation is — since the selection is homogeneous
  // by construction (see checkableDockIds below). Undefined while nothing is checked, so any dock
  // may still start either kind of selection.
  const selectionIntent: 'ARCHIVE' | 'REACTIVATE' | undefined = useMemo(() => {
    if (checkedDockIds.size === 0) {
      return undefined
    }
    const [firstCheckedId] = checkedDockIds
    const firstCheckedDock = docks.find((dock) => dock.id === firstCheckedId)
    return firstCheckedDock?.status === 'ARCHIVED' ? 'REACTIVATE' : 'ARCHIVE'
  }, [checkedDockIds, docks])
  // Every dock select mode may check right now, whether or not it is currently active — the map
  // also uses this to gate shift-click, which can enter select mode directly. With nothing checked
  // yet, any dock is checkable; once the selection's intent is fixed, only docks matching it are.
  const checkableDockIds = useMemo(
    () =>
      new Set(
        checkpoints
          .filter((checkpoint) => {
            if (checkpoint.kind !== 'DOCK') {
              return false
            }
            if (!selectionIntent) {
              return true
            }
            return (
              checkpoint.status === (selectionIntent === 'REACTIVATE' ? 'ARCHIVED' : 'AVAILABLE')
            )
          })
          .map((checkpoint) => checkpoint.id),
      ),
    [checkpoints, selectionIntent],
  )
  const selection = parseCheckpointSelection(checkpointParam)
  const selectedCheckpoint = selection
    ? checkpoints.find(
        (checkpoint) => checkpoint.kind === selection.kind && checkpoint.id === selection.id,
      )
    : undefined
  const selectedDock =
    selection?.kind === 'DOCK' && selectedCheckpoint
      ? docks.find((dock) => dock.id === selection.id)
      : undefined
  const selectedWeighingArea =
    selection?.kind === 'WEIGHING_AREA' && selectedCheckpoint
      ? weighingAreas.find((area) => area.id === selection.id)
      : undefined
  const selectedResource: SelectedCheckpoint =
    selection?.kind === 'DOCK' && selectedDock
      ? {
          resource: selectedDock,
          selection: { ...selection, kind: 'DOCK' },
        }
      : selection?.kind === 'WEIGHING_AREA' && selectedWeighingArea
        ? { resource: selectedWeighingArea, selection: { ...selection, kind: 'WEIGHING_AREA' } }
        : undefined
  // Memoized so its identity only changes when the selected dock/weighing-area itself changes
  // (both are stable references across renders that don't touch query data, e.g. every mousemove
  // while dragging a marker) — otherwise the edit session's effect, which depends on this value by
  // reference, would re-run on every one of those renders.
  const selectedEditable: EditableCheckpoint | undefined = useMemo(() => {
    if (selectedDock) {
      return {
        kind: 'DOCK',
        id: selectedDock.id,
        latitude: selectedDock.latitude,
        longitude: selectedDock.longitude,
        status: selectedDock.status,
      }
    }
    if (selectedWeighingArea) {
      return {
        kind: 'WEIGHING_AREA',
        id: selectedWeighingArea.id,
        latitude: selectedWeighingArea.latitude,
        longitude: selectedWeighingArea.longitude,
        status: selectedWeighingArea.status,
      }
    }
    return undefined
  }, [selectedDock, selectedWeighingArea])
  const {
    isEditing,
    session: editSession,
    draft,
    setDraft,
    restoreOrigin,
    clear: clearEditSession,
  } = useCheckpointEditSession({ requestedKind: requestedEditKind, selected: selectedEditable })

  // Resets whenever the active creation flow changes — including switching directly from one
  // kind to the other — so at most one creation flow is ever armed and switching discards the
  // abandoned pending placement rather than carrying it into the new flow (spec FR-016, FR-017).
  // `startCreating` already resets for in-app switches; this covers the flows it doesn't run
  // through, such as landing on a `create` param directly or moving between them with back/forward.
  // The effect body doesn't need creationKind's value, only to re-run whenever it changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    setPendingPlacement(null)
  }, [creationKind])

  useEffect(() => {
    if (!isSelectingDocks) {
      setCheckedDockIds(new Set())
    }
  }, [isSelectingDocks])

  // Ctrl/Cmd+A selects every currently visible dock matching the selection's intent, entering
  // select mode on the fly just like a shift-click — the administrator never has to reach for the
  // map control first. With nothing checked yet, the intent falls back to the status filter
  // (Archived shows archived docks, anything else shows available ones), so Ctrl+A always grabs
  // the docks the administrator is actually looking at. Ignored while typing in a field, so the
  // browser's native "select all text" keeps working there.
  useEffect(() => {
    if (!canManageCheckpoints) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSelectAllShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a'
      if (!isSelectAllShortcut) {
        return
      }
      const target = event.target as HTMLElement | null
      const isEditableTarget =
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditableTarget) {
        return
      }
      const targetStatus =
        selectionIntent === 'REACTIVATE'
          ? 'ARCHIVED'
          : selectionIntent === 'ARCHIVE'
            ? 'AVAILABLE'
            : status === 'archived'
              ? 'ARCHIVED'
              : 'AVAILABLE'
      const matchingDockIds = checkpoints
        .filter((checkpoint) => checkpoint.kind === 'DOCK' && checkpoint.status === targetStatus)
        .map((checkpoint) => checkpoint.id)
      if (matchingDockIds.length === 0) {
        return
      }
      event.preventDefault()
      setCheckedDockIds(new Set(matchingDockIds))
      void navigate({
        search: (previous) => ({
          ...previous,
          checkpoint: undefined,
          create: undefined,
          edit: undefined,
          selecting: 'docks',
        }),
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canManageCheckpoints, checkpoints, navigate, selectionIntent, status])

  // Escape clears an in-progress dock selection without leaving select mode — the keyboard
  // counterpart of the bulk action bar's "Clear selection" button, so a second Escape (with
  // nothing left checked) is free to fall through to whatever else Escape already does (e.g.
  // closing a menu), rather than this handler swallowing every Escape press.
  useEffect(() => {
    if (!isSelectingDocks || checkedDockIds.size === 0) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCheckedDockIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectingDocks, checkedDockIds.size])

  useEffect(() => {
    const sourceLoaded =
      selection === undefined
        ? docksQuery.data
        : selection.kind === 'DOCK'
          ? docksQuery.data
          : weighingAreasQuery.data
    if (sourceLoaded && checkpointParam && !selectedResource) {
      // `edit` is scoped to the selection it was opened for, so it has to go with it. Leaving it
      // behind would arm edit mode for whichever checkpoint is selected next.
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, checkpoint: undefined, edit: undefined }),
      })
    }
  }, [
    checkpointParam,
    docksQuery.data,
    navigate,
    selectedResource,
    selection,
    selection?.kind,
    weighingAreasQuery.data,
  ])

  if (!docksQuery.data) {
    return null
  }

  const hasMatches = checkpoints.some((checkpoint) => checkpoint.isSearchMatch)
  const updateSearch = (nextSearch: string) => {
    setCheckedDockIds(new Set())
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, search: nextSearch }),
    })
  }
  const updateStatus = (nextStatus: typeof status) => {
    setCheckedDockIds(new Set())
    const selectedCheckpointInCollection = selection
      ? checkpointCollection.find(
          (checkpoint) => checkpoint.kind === selection.kind && checkpoint.id === selection.id,
        )
      : undefined
    const keepsSelection =
      !selectedCheckpointInCollection ||
      nextStatus === 'all' ||
      selectedCheckpointInCollection.status === nextStatus.toUpperCase()

    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: keepsSelection ? previous.checkpoint : undefined,
        edit: keepsSelection ? previous.edit : undefined,
        status: nextStatus,
      }),
    })
  }
  const updateLayerVisibility = (nextVisibility: CheckpointLayerVisibility) => {
    setCheckedDockIds(new Set())
    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: previous.checkpoint,
        kinds: checkpointKindFilterFromVisibility(nextVisibility),
      }),
    })
  }
  const selectCheckpoint = (checkpoint: PresentedCheckpoint) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: serializeCheckpointSelection(checkpoint),
      }),
    })
  }
  const startCreating = (kind: CheckpointKind) => {
    // Discard synchronously, batched with the navigation: the effect above also resets, but only
    // after the newly mounted panel has painted a pending marker at the abandoned position.
    setPendingPlacement(null)
    void navigate({
      search: (previous) => ({
        ...previous,
        create: CHECKPOINT_PARAM_BY_KIND[kind],
        selecting: undefined,
      }),
    })
  }
  const cancelCreating = () => {
    setPendingPlacement(null)
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, create: undefined }),
    })
  }
  const createDock = async (value: { name: string; latitude: number; longitude: number }) => {
    const result = await dockMutations.create.mutateAsync({ body: value })

    return result.data
  }
  const createWeighingArea = async (value: {
    name: string
    latitude: number
    longitude: number
  }) => {
    const result = await weighingAreaMutations.create.mutateAsync({ body: value })

    return result.data
  }
  // A brand new checkpoint is AVAILABLE, so widen any filter that would hide it: otherwise it
  // never reaches `checkpoints`, and the selection effect above would drop the selection again —
  // leaving the administrator with a success toast and nothing to show for it.
  const handleCreated = (kind: CheckpointKind, id: string, successMessage: string) => {
    setPendingPlacement(null)
    toast.success(successMessage)
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        checkpoint: serializeCheckpointSelection({ kind, id }),
        create: undefined,
        kinds: previous.kinds === OPPOSITE_KIND_FILTER[kind] ? undefined : previous.kinds,
        status: previous.status === 'archived' ? 'available' : previous.status,
      }),
    })
  }
  const handleDockCreated = (dock: DockDto) => handleCreated('DOCK', dock.id, 'Dock created')
  const handleWeighingAreaCreated = (area: WeighingAreaDto) =>
    handleCreated('WEIGHING_AREA', area.id, 'Weighing area created')

  const startEditing = () => {
    if (!selection) {
      return
    }
    void navigate({
      search: (previous) => ({
        ...previous,
        edit: CHECKPOINT_PARAM_BY_KIND[selection.kind],
        selecting: undefined,
      }),
    })
  }
  const startSelectingDocks = (initialDockId?: string) => {
    setCheckedDockIds(initialDockId ? new Set([initialDockId]) : new Set())
    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: undefined,
        create: undefined,
        edit: undefined,
        selecting: 'docks',
      }),
    })
  }
  const stopSelectingDocks = () => {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, selecting: undefined }),
    })
  }
  const toggleDockChecked = (id: string) => {
    if (!checkableDockIds.has(id)) {
      return
    }
    setCheckedDockIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  // Shift-clicking an available dock marker enters select mode on the fly and checks that dock,
  // without needing the map control first. Once already selecting, it just toggles like a plain
  // click — shift adds no further meaning there.
  const handleShiftSelectDock = (id: string) => {
    if (isSelectingDocks) {
      toggleDockChecked(id)
      return
    }
    startSelectingDocks(id)
  }
  const cancelEditing = () => {
    clearEditSession()
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, edit: undefined }),
    })
  }
  const updateDock = async (
    id: string,
    value: { name: string; latitude: number; longitude: number },
  ) => {
    const result = await dockMutations.update.mutateAsync({ params: { id }, body: value })

    return result.data
  }
  const updateWeighingArea = async (
    id: string,
    value: { name: string; latitude: number; longitude: number },
  ) => {
    const result = await weighingAreaMutations.update.mutateAsync({ params: { id }, body: value })

    return result.data
  }
  const handleUpdated = (successMessage: string) => {
    clearEditSession()
    toast.success(successMessage)
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, edit: undefined }),
    })
  }
  const handleDockUpdated = () => handleUpdated('Dock updated')
  const handleWeighingAreaUpdated = () => handleUpdated('Weighing area updated')
  const handleEditNotFound = () => {
    clearEditSession()
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, checkpoint: undefined, edit: undefined }),
    })
  }
  const handleBulkArchiveSuccess = (result: BulkDockLifecycleResult) => {
    setCheckedDockIds(
      new Set(
        result.blockedDocks
          .filter((blocked) => blocked.reason === 'IN_USE')
          .map((blocked) => blocked.id),
      ),
    )
  }
  // Unlike archiving's IN_USE, neither reactivation blocker (NOT_FOUND, ALREADY_AVAILABLE)
  // becomes eligible on a retry, so the whole selection is cleared rather than keeping any
  // blocked dock checked (research D7).
  const handleBulkReactivateSuccess = () => {
    setCheckedDockIds(new Set())
  }

  // Hidden while any checkpoint is being edited or a bulk selection is in progress: starting a
  // creation from there would tear down the edit session or an in-progress selection. Two
  // creation flows may still replace one another — switching between them is deliberate, and
  // `startCreating` discards the abandoned placement (spec FR-016, FR-017).
  const createActions =
    canManageCheckpoints && !isEditing && !isSelectingDocks
      ? CHECKPOINT_KINDS.map((kind) => ({
          key: kind,
          label: CREATE_LABEL_BY_KIND[kind],
          icon: <CheckpointKindIcon kind={kind} />,
          onSelect: () => startCreating(kind),
        }))
      : []

  const createPanel =
    creationKind === 'DOCK' ? (
      <CreateCheckpointPanel
        kind="DOCK"
        onCreate={createDock}
        onPendingChange={setPendingPlacement}
        onSuccess={handleDockCreated}
        pending={pendingPlacement}
      />
    ) : creationKind === 'WEIGHING_AREA' ? (
      <CreateCheckpointPanel
        kind="WEIGHING_AREA"
        onCreate={createWeighingArea}
        onPendingChange={setPendingPlacement}
        onSuccess={handleWeighingAreaCreated}
        pending={pendingPlacement}
      />
    ) : null

  // Resolved once, in one place, to whichever of the two kinds is actually being edited — the map
  // marker label and the edit panel below both read from it, instead of each re-deriving the same
  // DOCK/WEIGHING_AREA branch independently.
  const editing =
    isEditing && editSession?.kind === 'DOCK' && selectedDock
      ? {
          kind: 'DOCK' as const,
          resource: selectedDock,
          onUpdate: (value: { name: string; latitude: number; longitude: number }) =>
            updateDock(selectedDock.id, value),
          onSuccess: handleDockUpdated,
        }
      : isEditing && editSession?.kind === 'WEIGHING_AREA' && selectedWeighingArea
        ? {
            kind: 'WEIGHING_AREA' as const,
            resource: selectedWeighingArea,
            onUpdate: (value: { name: string; latitude: number; longitude: number }) =>
              updateWeighingArea(selectedWeighingArea.id, value),
            onSuccess: handleWeighingAreaUpdated,
          }
        : undefined

  const editPanel =
    editing && draft && editSession ? (
      <EditCheckpointPanel
        draft={draft}
        kind={editing.kind}
        onCancel={cancelEditing}
        onDraftChange={setDraft}
        onNotFound={handleEditNotFound}
        onRestorePosition={restoreOrigin}
        onSuccess={editing.onSuccess}
        onUpdate={editing.onUpdate}
        origin={editSession.origin}
        resource={editing.resource}
      />
    ) : null

  const weighingAreaMessage = layerVisibility.WEIGHING_AREA
    ? weighingAreasQuery.isPending
      ? 'Loading weighing areas…'
      : weighingAreasQuery.isError
        ? 'Unable to load weighing areas.'
        : weighingAreasQuery.data && weighingAreas.length === 0
          ? 'No weighing areas have been configured.'
          : weighingAreasQuery.data &&
              status !== 'all' &&
              !weighingAreas.some((area) => area.status === status.toUpperCase())
            ? `No ${status} weighing areas match this filter.`
            : undefined
    : undefined

  const visibleKindLabel =
    layerVisibility.DOCK && layerVisibility.WEIGHING_AREA
      ? 'checkpoints'
      : layerVisibility.DOCK
        ? 'docks'
        : 'weighing areas'
  const sourceUnavailable =
    layerVisibility.WEIGHING_AREA && (weighingAreasQuery.isPending || weighingAreasQuery.isError)
  const showWeighingAreaMessage =
    weighingAreasQuery.isPending ||
    weighingAreasQuery.isError ||
    (layerVisibility.DOCK && checkpointCollection.some((checkpoint) => checkpoint.kind === 'DOCK'))
  // The checkpoint being edited is represented on the map by its draft marker (below) instead of
  // its ordinary one, so there is never a moment where both a stale saved position and a live
  // draft both claim to be the same checkpoint. This filtering is scoped to the map only —
  // `checkpoints` is still the unfiltered set for `hasMatches`/`emptyMessage`, so the page doesn't
  // under-report how many checkpoints it has while an edit is in progress.
  const mapCheckpoints =
    isEditing && editSession
      ? checkpoints.filter(
          (checkpoint) =>
            !(checkpoint.kind === editSession.kind && checkpoint.id === editSession.id),
        )
      : checkpoints
  const editingLabel = editing?.resource.name

  return (
    <>
      <ResourceMapWorkspace
        controls={
          <CheckpointMapControls
            counts={counts}
            hasMatches={hasMatches}
            layerVisibility={layerVisibility}
            onLayerVisibilityChange={updateLayerVisibility}
            onSearchChange={updateSearch}
            onStatusChange={updateStatus}
            search={search}
            status={status}
          />
        }
        emptyMessage={
          checkpoints.length === 0 && !sourceUnavailable
            ? status === 'all'
              ? `No ${visibleKindLabel} have been configured.`
              : `No ${status} ${visibleKindLabel} match this filter.`
            : undefined
        }
        legend={
          <CheckpointLegend kinds={CHECKPOINT_KINDS.filter((kind) => layerVisibility[kind])} />
        }
        mapUnavailableActions={createActions.map((action) => (
          <Button key={action.key} onClick={action.onSelect} size="sm" variant="outline">
            {action.icon}
            {action.label}
          </Button>
        ))}
        map={(onMapError) => (
          <CheckpointMap
            canSelectDocks={canManageCheckpoints && layerVisibility.DOCK}
            checkableDockIds={canManageCheckpoints ? checkableDockIds : undefined}
            checkedIds={isSelectingDocks ? checkedDockIds : undefined}
            checkpoints={mapCheckpoints}
            createActions={createActions}
            onError={onMapError}
            onSelect={selectCheckpoint}
            onShiftSelectDock={canManageCheckpoints ? handleShiftSelectDock : undefined}
            onToggleChecked={isSelectingDocks ? toggleDockChecked : undefined}
            onToggleSelectMode={isSelectingDocks ? stopSelectingDocks : () => startSelectingDocks()}
            selectMode={isSelectingDocks ? 'docks' : undefined}
            placement={
              creationKind
                ? {
                    armed: true,
                    pending: pendingPlacement,
                    onPlace: setPendingPlacement,
                    onMove: setPendingPlacement,
                    label: CREATE_LABEL_BY_KIND[creationKind],
                    icon: <CheckpointKindIcon className="size-3.5" kind={creationKind} />,
                  }
                : isEditing && editSession && draft
                  ? {
                      armed: true,
                      pending: draft,
                      onPlace: setDraft,
                      onMove: setDraft,
                      label: editingLabel ?? '',
                      icon: <CheckpointKindIcon className="size-3.5" kind={editSession.kind} />,
                    }
                  : undefined
            }
            selected={selectedCheckpoint}
          />
        )}
        onRetrySource={() => void weighingAreasQuery.refetch()}
        resourceLabel="Checkpoints"
        sourceError={layerVisibility.WEIGHING_AREA && weighingAreasQuery.isError}
        sourceMessage={showWeighingAreaMessage ? weighingAreaMessage : undefined}
      />
      {canManageCheckpoints && (
        <BulkDockLifecycleActions
          intent={selectionIntent ?? 'ARCHIVE'}
          onClear={() => setCheckedDockIds(new Set())}
          onSuccess={
            selectionIntent === 'REACTIVATE'
              ? handleBulkReactivateSuccess
              : handleBulkArchiveSuccess
          }
          selectedIds={[...checkedDockIds]}
        />
      )}
      <CheckpointSheet
        canEditCheckpoint={canManageCheckpoints}
        checkpoint={selectedResource}
        createPanel={createPanel}
        editPanel={editPanel}
        mode={creationKind ? 'create' : isEditing ? 'edit' : 'view'}
        onClose={() => {
          if (creationKind) {
            cancelCreating()
            return
          }
          if (isEditing) {
            cancelEditing()
            return
          }
          void navigate({
            replace: true,
            search: (previous) => ({ ...previous, checkpoint: undefined, edit: undefined }),
          })
        }}
        onEditCheckpoint={startEditing}
      />
    </>
  )
}
