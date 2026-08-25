import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { countResources } from '@/components/resource-map/resource-map-search'
import { ResourceMapWorkspace } from '@/components/resource-map/resource-map-workspace'
import {
  useClearSelectionShortcut,
  useSelectAllShortcut,
} from '@/components/resource-map/use-bulk-selection-shortcuts'
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
  BULK_LIFECYCLE_INTENTS,
  type BulkLifecycleIntent,
  CHECKPOINT_KINDS,
  CHECKPOINT_PARAM_BY_KIND,
  type CheckpointKind,
  type CheckpointKindFilter,
  type CheckpointLayerVisibility,
  checkpointKindFilterFromVisibility,
  checkpointLayerVisibilityFromFilter,
  STATUS_FOR_BULK_INTENT,
} from '@/features/checkpoints/types'
import {
  BulkCheckpointLifecycleActions,
  type BulkLifecycleOutcome,
} from '@/features/checkpoints/ui/bulk-checkpoint-lifecycle-actions'
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
import {
  toBulkLifecycleOutcome as toDockBulkLifecycleOutcome,
  toDockCheckpoint,
} from '@/features/docks/dock-checkpoint-adapter'
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import type { DockDto } from '@/features/docks/types'
import { useWeighingAreaMutations } from '@/features/weighing-areas/mutations/use-weighing-area-mutations'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import {
  toBulkLifecycleOutcome as toWeighingAreaBulkLifecycleOutcome,
  toWeighingAreaCheckpoint,
} from '@/features/weighing-areas/weighing-area-checkpoint-adapter'

/** Maps the `selecting` search param's on-the-wire value to the kind it names. */
const SELECTING_KIND_BY_PARAM: Record<string, CheckpointKind> = {
  docks: 'DOCK',
  'weighing-areas': 'WEIGHING_AREA',
}
const SELECTING_PARAM_BY_KIND: Record<CheckpointKind, 'docks' | 'weighing-areas'> = {
  DOCK: 'docks',
  WEIGHING_AREA: 'weighing-areas',
}
/** Kinds whose bulk lifecycle endpoints exist. Both kinds can be bulk-archived and
 * bulk-reactivated; which directions each one supports is `BULK_LIFECYCLE_INTENTS`. */
const BULK_LIFECYCLE_CAPABLE_KINDS: CheckpointKind[] = ['DOCK', 'WEIGHING_AREA']

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
  const selectingKind: CheckpointKind | undefined =
    canManageCheckpoints && selecting ? SELECTING_KIND_BY_PARAM[selecting] : undefined
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
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
  // The status of any currently checked checkpoint fixes what a selection is for — Available means
  // an archive is in progress, Archived means a reactivation is — since the selection is
  // homogeneous by construction (see checkableIds below). Undefined while nothing is checked, so
  // any checkpoint may still start either kind of selection.
  const selectionIntent: BulkLifecycleIntent | undefined = useMemo(() => {
    if (checkedIds.size === 0) {
      return undefined
    }
    const [firstCheckedId] = checkedIds
    const firstChecked = checkpointCollection.find((entry) => entry.id === firstCheckedId)
    return firstChecked?.status === 'ARCHIVED' ? 'REACTIVATE' : 'ARCHIVE'
  }, [checkedIds, checkpointCollection])
  // Every checkpoint select mode may check right now, whether or not it is currently active — the
  // map also uses this to gate shift-click, which can enter select mode directly. Eligibility is
  // three things at once: the kind must support bulk lifecycle actions and be the one being
  // selected (if any), and the status must match the selection's intent — or, with nothing checked
  // yet, any intent that kind supports.
  const checkableIds = useMemo(
    () =>
      new Set(
        checkpoints
          .filter((checkpoint) => {
            if (!BULK_LIFECYCLE_CAPABLE_KINDS.includes(checkpoint.kind)) {
              return false
            }
            if (selectingKind && checkpoint.kind !== selectingKind) {
              return false
            }
            const intents = selectionIntent
              ? [selectionIntent]
              : BULK_LIFECYCLE_INTENTS[checkpoint.kind]
            return intents
              .filter((intent) => BULK_LIFECYCLE_INTENTS[checkpoint.kind].includes(intent))
              .some((intent) => checkpoint.status === STATUS_FOR_BULK_INTENT[intent])
          })
          .map((checkpoint) => checkpoint.id),
      ),
    [checkpoints, selectingKind, selectionIntent],
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
    if (!selectingKind) {
      setCheckedIds(new Set())
    }
  }, [selectingKind])

  // A checked checkpoint that drops out of the collection entirely — a failed list refetch empties
  // its source (see weighingAreas above) — would leave selectionIntent falling back to ARCHIVE
  // over what may be an archived selection, offering and sending the wrong bulk action. Such ids
  // are dropped instead. Search-hidden checkpoints are untouched: this looks at the whole
  // collection, not the presented list, so a search term never prunes the selection (spec FR-036).
  useEffect(() => {
    setCheckedIds((current) => {
      if (current.size === 0) {
        return current
      }
      const resolvableIds = new Set(checkpointCollection.map((checkpoint) => checkpoint.id))
      const next = new Set([...current].filter((id) => resolvableIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [checkpointCollection])

  // Ctrl/Cmd+A selects every currently visible checkpoint of the active selecting kind matching
  // the selection's intent, entering select mode on the fly just like a shift-click — the
  // administrator never has to reach for the map control first. With no kind being selected it
  // defaults to the first capable visible kind (docks before weighing areas); with nothing checked
  // the intent falls back to the status filter (Archived reactivates, anything else archives), so
  // Ctrl+A always grabs what the administrator is actually looking at. That fallback is clamped to
  // the intents the kind supports, so a kind that only archives never gets a reactivate selection.
  // The listener itself — including ignoring the shortcut while a field has focus — lives in
  // `useSelectAllShortcut`, shared with the warehouse map.
  const selectAllVisible = useCallback(
    (event: KeyboardEvent) => {
      const targetKind =
        selectingKind ?? BULK_LIFECYCLE_CAPABLE_KINDS.find((kind) => layerVisibility[kind])
      if (!targetKind) {
        return
      }
      const supportedIntents = BULK_LIFECYCLE_INTENTS[targetKind]
      const preferredIntent = selectionIntent ?? (status === 'archived' ? 'REACTIVATE' : 'ARCHIVE')
      const targetIntent = supportedIntents.includes(preferredIntent)
        ? preferredIntent
        : supportedIntents[0]
      const targetStatus = STATUS_FOR_BULK_INTENT[targetIntent]
      const matchingIds = checkpoints
        .filter(
          (checkpoint) => checkpoint.kind === targetKind && checkpoint.status === targetStatus,
        )
        .map((checkpoint) => checkpoint.id)
      if (matchingIds.length === 0) {
        return
      }
      event.preventDefault()
      setCheckedIds(new Set(matchingIds))
      void navigate({
        search: (previous) => ({
          ...previous,
          checkpoint: undefined,
          create: undefined,
          edit: undefined,
          selecting: SELECTING_PARAM_BY_KIND[targetKind],
        }),
      })
    },
    [checkpoints, layerVisibility, navigate, selectingKind, selectionIntent, status],
  )
  useSelectAllShortcut({ enabled: canManageCheckpoints, onSelectAll: selectAllVisible })

  // Escape clears an in-progress selection without leaving select mode — the keyboard counterpart
  // of the bulk action bar's "Clear selection" button. `enabled` goes false with nothing checked,
  // so a second Escape falls through to whatever else Escape already does (e.g. closing a menu)
  // rather than this handler swallowing every Escape press.
  const clearChecked = useCallback(() => setCheckedIds(new Set()), [])
  useClearSelectionShortcut({
    enabled: Boolean(selectingKind) && checkedIds.size > 0,
    onClear: clearChecked,
  })

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
  // Search narrows what is displayed, not what was chosen: a checked checkpoint that a search
  // term hides stays selected (spec FR-036), unlike the status and resource-kind filters below,
  // which change what is *eligible* and so do prune the selection.
  const updateSearch = (nextSearch: string) => {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, search: nextSearch }),
    })
  }
  const updateStatus = (nextStatus: typeof status) => {
    setCheckedIds(new Set())
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
    setCheckedIds(new Set())
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
  const startSelecting = (kind: CheckpointKind, initialId?: string) => {
    setCheckedIds(initialId ? new Set([initialId]) : new Set())
    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: undefined,
        create: undefined,
        edit: undefined,
        selecting: SELECTING_PARAM_BY_KIND[kind],
      }),
    })
  }
  const stopSelecting = () => {
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, selecting: undefined }),
    })
  }
  const toggleSelectMode = (kind: CheckpointKind) => {
    if (selectingKind === kind) {
      stopSelecting()
      return
    }
    startSelecting(kind)
  }
  const toggleChecked = (_kind: CheckpointKind, id: string) => {
    // Eligibility already accounts for kind, status and the selection's intent.
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
  // Shift-clicking an available marker of a selectable kind enters select mode on the fly and
  // checks that checkpoint, without needing the map control first. Once already selecting that
  // same kind, it just toggles like a plain click — shift adds no further meaning there. Shift-
  // clicking a marker of the *other* selectable kind switches select mode to that kind instead,
  // starting a fresh selection with just the shift-clicked checkpoint.
  const handleShiftSelect = (kind: CheckpointKind, id: string) => {
    if (selectingKind === kind) {
      toggleChecked(kind, id)
      return
    }
    startSelecting(kind, id)
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
  // Falls back to ARCHIVE while nothing is checked, and is clamped to what the selecting kind
  // actually supports, so a kind that only archives can never resolve to REACTIVATE.
  const bulkIntent: BulkLifecycleIntent =
    selectingKind &&
    selectionIntent &&
    BULK_LIFECYCLE_INTENTS[selectingKind].includes(selectionIntent)
      ? selectionIntent
      : 'ARCHIVE'
  // Routes the submission to the right mutation for the selected kind and intent, and normalizes
  // each resource's own response shape onto the shared outcome the toolbar renders.
  const submitBulkLifecycle = async (input: { ids: string[]; comment: string | null }) => {
    if (selectingKind === 'WEIGHING_AREA') {
      return toWeighingAreaBulkLifecycleOutcome(
        bulkIntent === 'REACTIVATE'
          ? (await weighingAreaMutations.reactivateMany.mutateAsync({ body: input })).data
          : (await weighingAreaMutations.archiveMany.mutateAsync({ body: input })).data,
      )
    }
    return toDockBulkLifecycleOutcome(
      bulkIntent === 'REACTIVATE'
        ? (await dockMutations.reactivateMany.mutateAsync({ body: input })).data
        : (await dockMutations.archiveMany.mutateAsync({ body: input })).data,
    )
  }
  const handleBulkArchiveSuccess = (outcome: BulkLifecycleOutcome) => {
    setCheckedIds(
      new Set(
        outcome.blocked
          .filter((blocked) => blocked.reason === 'IN_USE')
          .map((blocked) => blocked.id),
      ),
    )
  }
  // Unlike archiving's IN_USE, neither reactivation blocker (NOT_FOUND, ALREADY_AVAILABLE)
  // becomes eligible on a retry, so the whole selection is cleared rather than keeping any
  // blocked checkpoint checked — the same rule for docks and weighing areas.
  const handleBulkReactivateSuccess = () => {
    setCheckedIds(new Set())
  }

  // Hidden while any checkpoint is being edited or a bulk selection is in progress: starting a
  // creation from there would tear down the edit session or an in-progress selection. Two
  // creation flows may still replace one another — switching between them is deliberate, and
  // `startCreating` discards the abandoned placement (spec FR-016, FR-017).
  const createActions =
    canManageCheckpoints && !isEditing && !selectingKind
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
            checkableIds={canManageCheckpoints ? checkableIds : undefined}
            checkedIds={selectingKind ? checkedIds : undefined}
            checkpoints={mapCheckpoints}
            createActions={createActions}
            onError={onMapError}
            onSelect={selectCheckpoint}
            onShiftSelect={canManageCheckpoints ? handleShiftSelect : undefined}
            onToggleChecked={selectingKind ? (id) => toggleChecked(selectingKind, id) : undefined}
            onToggleSelectMode={toggleSelectMode}
            selectMode={selectingKind}
            selectableKinds={
              canManageCheckpoints
                ? BULK_LIFECYCLE_CAPABLE_KINDS.filter((kind) => layerVisibility[kind])
                : []
            }
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
      {canManageCheckpoints && selectingKind && (
        <BulkCheckpointLifecycleActions
          intent={bulkIntent}
          kind={selectingKind}
          onClear={() => setCheckedIds(new Set())}
          onSuccess={
            bulkIntent === 'REACTIVATE' ? handleBulkReactivateSuccess : handleBulkArchiveSuccess
          }
          refresh={
            selectingKind === 'DOCK'
              ? dockMutations.refreshDocks
              : weighingAreaMutations.refreshWeighingAreas
          }
          selectedIds={[...checkedIds]}
          submit={submitBulkLifecycle}
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
