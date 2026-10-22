import type { ReactNode } from 'react'
import { ResourceMapSearch } from '@/components/resource-map/resource-map-search-field'
import {
  ResourceMapToggleGroup,
  ResourceMapToolbar,
  ResourceMapToolbarSeparator,
} from '@/components/resource-map/resource-map-toolbar'
import { serializeCheckpointSelection } from '@/features/checkpoints/checkpoint-selection'
import { CheckpointKindIcon } from '@/features/checkpoints/map/checkpoint-marker'
import {
  CHECKPOINT_KIND_LABELS,
  CHECKPOINT_KINDS,
  CHECKPOINT_STATUS_LABELS,
  CHECKPOINT_STATUSES,
  type CheckpointKind,
  type CheckpointStatus,
  type PresentedCheckpoint,
} from '@/features/checkpoints/types'

const KIND_TOGGLE_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'Docks',
  WEIGHING_AREA: 'Weighing areas',
}

/**
 * The Checkpoints map's floating toolbar: search with suggestions, the cumulative type and status
 * toggles with their counts, and the page's own actions (Select, Create) at the end.
 */
export function CheckpointMapToolbar({
  search,
  onSearchChange,
  matches,
  searchFooter,
  onPick,
  onSubmitAll,
  kinds,
  onKindsChange,
  kindCounts,
  statuses,
  onStatusesChange,
  statusCounts,
  actions,
}: {
  search: string
  onSearchChange: (search: string) => void
  /** The checkpoints the search matches, in display order. */
  matches: PresentedCheckpoint[]
  searchFooter: string
  onPick: (checkpointId: string) => void
  onSubmitAll: () => void
  kinds: CheckpointKind[]
  onKindsChange: (kinds: CheckpointKind[]) => void
  kindCounts: Record<CheckpointKind, number>
  statuses: CheckpointStatus[]
  onStatusesChange: (statuses: CheckpointStatus[]) => void
  statusCounts: Record<CheckpointStatus, number>
  actions?: ReactNode
}) {
  return (
    <ResourceMapToolbar>
      <ResourceMapSearch
        footer={searchFooter}
        items={matches.map((checkpoint) => ({
          id: serializeCheckpointSelection(checkpoint),
          name: checkpoint.name,
          kindLabel: CHECKPOINT_KIND_LABELS[checkpoint.kind],
          icon: <CheckpointKindIcon className="text-muted-foreground" kind={checkpoint.kind} />,
        }))}
        label="Search checkpoints"
        listLabel="Matching checkpoints"
        onPick={onPick}
        onSubmitAll={onSubmitAll}
        onValueChange={onSearchChange}
        value={search}
      />
      <ResourceMapToolbarSeparator />
      <ResourceMapToggleGroup
        items={CHECKPOINT_KINDS.map((kind) => ({
          value: kind,
          label: KIND_TOGGLE_LABELS[kind],
          count: kindCounts[kind],
          icon: <CheckpointKindIcon className="text-muted-foreground" kind={kind} />,
        }))}
        label="Checkpoint types"
        onChange={onKindsChange}
        pressed={kinds}
      />
      <ResourceMapToolbarSeparator />
      <ResourceMapToggleGroup
        items={CHECKPOINT_STATUSES.map((status) => ({
          value: status,
          label: CHECKPOINT_STATUS_LABELS[status],
          count: statusCounts[status],
        }))}
        label="Filter by checkpoint status"
        onChange={onStatusesChange}
        pressed={statuses}
      />
      {actions && (
        <>
          <ResourceMapToolbarSeparator />
          <div className="flex items-center gap-2">{actions}</div>
        </>
      )}
    </ResourceMapToolbar>
  )
}
