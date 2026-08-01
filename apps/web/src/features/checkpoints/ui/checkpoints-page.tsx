import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { presentCheckpoints } from '@/features/checkpoints/checkpoint-search'
import {
  parseCheckpointSelection,
  serializeCheckpointSelection,
} from '@/features/checkpoints/checkpoint-selection'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import {
  CHECKPOINT_KINDS,
  type CheckpointLayerVisibility,
  checkpointKindFilterFromVisibility,
  checkpointLayerVisibilityFromFilter,
} from '@/features/checkpoints/types'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'
import { CheckpointMapPanel } from '@/features/checkpoints/ui/checkpoint-map-panel'
import {
  CheckpointSheet,
  type SelectedCheckpoint,
} from '@/features/checkpoints/ui/checkpoint-sheet'
import { toDockCheckpoint } from '@/features/docks/dock-checkpoint-adapter'
import { dockQueries } from '@/features/docks/queries/dock-queries'
import { weighingAreaQueries } from '@/features/weighing-areas/queries/weighing-area-queries'
import { toWeighingAreaCheckpoint } from '@/features/weighing-areas/weighing-area-checkpoint-adapter'

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

export function CheckpointsPage() {
  const { checkpoint: checkpointParam, kinds, search, status } = checkpointsRoute.useSearch()
  const navigate = checkpointsRoute.useNavigate()
  const docksQuery = useQuery(dockQueries.list())
  const weighingAreasQuery = useQuery(weighingAreaQueries.list())
  const docks = docksQuery.data?.data ?? []
  const weighingAreas = weighingAreasQuery.isError ? [] : (weighingAreasQuery.data?.data ?? [])
  const layerVisibility = checkpointLayerVisibilityFromFilter(kinds)
  const checkpointCollection = useMemo(
    () => [...docks.map(toDockCheckpoint), ...weighingAreas.map(toWeighingAreaCheckpoint)],
    [docks, weighingAreas],
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
    !layerVisibility.DOCK &&
    layerVisibility.WEIGHING_AREA &&
    (weighingAreasQuery.isPending || weighingAreasQuery.isError)
  const showWeighingAreaMessage =
    weighingAreasQuery.isPending ||
    weighingAreasQuery.isError ||
    (layerVisibility.DOCK && checkpointCollection.some((checkpoint) => checkpoint.kind === 'DOCK'))

  return (
    <>
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <CheckpointMapPanel
          checkpoints={checkpoints}
          controls={
            <CheckpointMapControls
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
          sourceMessage={showWeighingAreaMessage ? weighingAreaMessage : undefined}
          sourceError={layerVisibility.WEIGHING_AREA && weighingAreasQuery.isError}
          onRetrySource={() => void weighingAreasQuery.refetch()}
          legendKinds={CHECKPOINT_KINDS.filter((kind) => layerVisibility[kind])}
          onSelect={selectCheckpoint}
        />
      </main>
      <CheckpointSheet
        checkpoint={selectedResource}
        onClose={() => {
          void navigate({
            replace: true,
            search: (previous) => ({ ...previous, checkpoint: undefined }),
          })
        }}
      />
    </>
  )
}
