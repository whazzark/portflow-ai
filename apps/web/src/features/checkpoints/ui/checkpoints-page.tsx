import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { presentCheckpoints } from '@/features/checkpoints/checkpoint-search'
import {
  parseCheckpointSelection,
  serializeCheckpointSelection,
} from '@/features/checkpoints/checkpoint-selection'
import type { PresentedCheckpoint } from '@/features/checkpoints/types'
import { CheckpointMapControls } from '@/features/checkpoints/ui/checkpoint-map-controls'
import { CheckpointMapPanel } from '@/features/checkpoints/ui/checkpoint-map-panel'
import {
  CheckpointSheet,
  type SelectedCheckpoint,
} from '@/features/checkpoints/ui/checkpoint-sheet'
import { toDockCheckpoint } from '@/features/docks/dock-checkpoint-adapter'
import { dockQueries } from '@/features/docks/queries/dock-queries'

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

export function CheckpointsPage() {
  const { checkpoint: checkpointParam, search, status } = checkpointsRoute.useSearch()
  const navigate = checkpointsRoute.useNavigate()
  const docksQuery = useQuery(dockQueries.list())
  const docks = docksQuery.data?.data ?? []
  const checkpointCollection = useMemo(() => docks.map(toDockCheckpoint), [docks])
  const checkpoints = presentCheckpoints(checkpointCollection, status, search)
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
  const selectedResource: SelectedCheckpoint =
    selection?.kind === 'DOCK' && selectedDock
      ? {
          resource: selectedDock,
          selection: { ...selection, kind: 'DOCK' },
        }
      : undefined

  useEffect(() => {
    if (docksQuery.data && checkpointParam && !selectedResource) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, checkpoint: undefined }),
      })
    }
  }, [checkpointParam, docksQuery.data, navigate, selectedResource])

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
  const selectCheckpoint = (checkpoint: PresentedCheckpoint) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        checkpoint: serializeCheckpointSelection(checkpoint),
      }),
    })
  }

  return (
    <>
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <CheckpointMapPanel
          checkpoints={checkpoints}
          controls={
            <CheckpointMapControls
              hasMatches={hasMatches}
              onSearchChange={updateSearch}
              onStatusChange={updateStatus}
              search={search}
              status={status}
            />
          }
          emptyMessage={
            checkpoints.length === 0
              ? status === 'all'
                ? 'No checkpoints have been configured.'
                : `No ${status} checkpoints match this filter.`
              : undefined
          }
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
