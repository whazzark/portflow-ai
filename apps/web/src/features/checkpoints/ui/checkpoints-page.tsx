import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { AnchorIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
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
import { CheckpointLegend } from '@/features/checkpoints/map/checkpoint-marker'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import {
  CHECKPOINT_KINDS,
  type CheckpointLayerVisibility,
  checkpointKindFilterFromVisibility,
  checkpointLayerVisibilityFromFilter,
} from '@/features/checkpoints/types'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'
import {
  CheckpointSheet,
  type SelectedCheckpoint,
} from '@/features/checkpoints/ui/checkpoint-sheet'
import { toDockCheckpoint } from '@/features/docks/dock-checkpoint-adapter'
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import type { DockDto } from '@/features/docks/types'
import { CreateDockPanel } from '@/features/docks/ui/create-dock-panel'
import type { PendingDockPlacement } from '@/features/docks/ui/dock-form'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { toWeighingAreaCheckpoint } from '@/features/weighing-areas/weighing-area-checkpoint-adapter'

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

export function CheckpointsPage() {
  const {
    checkpoint: checkpointParam,
    create,
    kinds,
    search,
    status,
  } = checkpointsRoute.useSearch()
  const navigate = checkpointsRoute.useNavigate()
  const user = useAuthenticatedUser()
  const canCreateDock = isAdministrator(user)
  const isCreatingDock = canCreateDock && create === 'dock'
  const [pendingDockPlacement, setPendingDockPlacement] = useState<PendingDockPlacement | null>(
    null,
  )
  const dockMutations = useDockMutations()
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

  useEffect(() => {
    if (!isCreatingDock) {
      setPendingDockPlacement(null)
    }
  }, [isCreatingDock])

  useEffect(() => {
    const sourceLoaded =
      selection === undefined
        ? docksQuery.data
        : selection.kind === 'DOCK'
          ? docksQuery.data
          : weighingAreasQuery.data
    if (sourceLoaded && checkpointParam && !selectedResource) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, checkpoint: undefined }),
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
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, search: nextSearch }),
    })
  }
  const updateStatus = (nextStatus: typeof status) => {
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
        status: nextStatus,
      }),
    })
  }
  const updateLayerVisibility = (nextVisibility: CheckpointLayerVisibility) => {
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
  const startCreatingDock = () => {
    void navigate({
      search: (previous) => ({ ...previous, create: 'dock' }),
    })
  }
  const cancelCreatingDock = () => {
    setPendingDockPlacement(null)
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, create: undefined }),
    })
  }
  const createDock = async (value: { name: string; latitude: number; longitude: number }) => {
    const result = await dockMutations.create.mutateAsync({ body: value })

    return result.data
  }
  const handleDockCreated = (dock: DockDto) => {
    setPendingDockPlacement(null)
    toast.success('Dock created')
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        checkpoint: serializeCheckpointSelection({ kind: 'DOCK', id: dock.id }),
        create: undefined,
        // A brand new dock is AVAILABLE, so widen any filter that would hide it: otherwise it
        // never reaches `checkpoints`, and the selection effect above would drop the selection
        // again — leaving the administrator with a success toast and nothing to show for it.
        kinds: previous.kinds === 'weighing-area' ? undefined : previous.kinds,
        status: previous.status === 'archived' ? 'available' : previous.status,
      }),
    })
  }

  const dockCreateActions = canCreateDock
    ? [
        {
          key: 'DOCK',
          label: 'New dock',
          icon: <AnchorIcon aria-hidden="true" className="size-4" />,
          onSelect: startCreatingDock,
        },
      ]
    : []

  const createPanel = isCreatingDock ? (
    <CreateDockPanel
      onCreate={createDock}
      onPendingChange={setPendingDockPlacement}
      onSuccess={handleDockCreated}
      pending={pendingDockPlacement}
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
        mapUnavailableActions={dockCreateActions.map((action) => (
          <Button key={action.key} onClick={action.onSelect} size="sm" variant="outline">
            {action.icon}
            {action.label}
          </Button>
        ))}
        map={(onMapError) => (
          <CheckpointMap
            checkpoints={checkpoints}
            createActions={dockCreateActions}
            onError={onMapError}
            onSelect={selectCheckpoint}
            placement={
              isCreatingDock
                ? {
                    armed: true,
                    pending: pendingDockPlacement,
                    onPlace: setPendingDockPlacement,
                    onMove: setPendingDockPlacement,
                    label: 'New dock',
                    icon: <AnchorIcon aria-hidden="true" className="size-3.5" />,
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
      <CheckpointSheet
        checkpoint={selectedResource}
        createPanel={createPanel}
        mode={isCreatingDock ? 'create' : 'view'}
        onClose={() => {
          if (isCreatingDock) {
            cancelCreatingDock()
            return
          }
          void navigate({
            replace: true,
            search: (previous) => ({ ...previous, checkpoint: undefined }),
          })
        }}
      />
    </>
  )
}
