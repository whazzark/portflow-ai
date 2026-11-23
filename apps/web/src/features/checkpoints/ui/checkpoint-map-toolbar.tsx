import type { ReactNode } from 'react'
import {
  HighlightedMatch,
  ResourceMapSearch,
} from '@/components/resource-map/resource-map-search-field'
import {
  ResourceMapToggleGroup,
  ResourceMapToolbar,
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

/** Toggles `value` in or out of `selected`, keeping the canonical order of `all`. */
function toggled<Value extends string>(all: readonly Value[], selected: Value[], value: Value) {
  return all.filter((entry) =>
    entry === value ? !selected.includes(entry) : selected.includes(entry),
  )
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
      <ResourceMapSearch<PresentedCheckpoint>
        footer={searchFooter}
        getItemKey={serializeCheckpointSelection}
        groups={CHECKPOINT_KINDS.map((kind) => ({
          label: KIND_TOGGLE_LABELS[kind],
          items: matches.filter((checkpoint) => checkpoint.kind === kind),
        }))}
        id="checkpoint-search"
        label="Search checkpoints"
        listLabel="Matching checkpoints"
        onSelect={(checkpoint) => onPick(serializeCheckpointSelection(checkpoint))}
        onSubmitAll={onSubmitAll}
        onValueChange={onSearchChange}
        renderItem={(checkpoint) => (
          <span className="flex items-center gap-2">
            <CheckpointKindIcon className="text-muted-foreground" kind={checkpoint.kind} />
            <span className="min-w-0 flex-1 truncate">
              <HighlightedMatch search={search} text={checkpoint.name} />
            </span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {CHECKPOINT_KIND_LABELS[checkpoint.kind]}
            </span>
          </span>
        )}
        value={search}
      />
      <ResourceMapToggleGroup
        items={CHECKPOINT_KINDS.map((kind) => ({
          value: kind,
          label: KIND_TOGGLE_LABELS[kind],
          count: kindCounts[kind],
          pressed: kinds.includes(kind),
        }))}
        label="Checkpoint types"
        onToggle={(kind) => onKindsChange(toggled(CHECKPOINT_KINDS, kinds, kind))}
      />
      <ResourceMapToggleGroup
        countNoun="checkpoints"
        items={CHECKPOINT_STATUSES.map((status) => ({
          value: status,
          label: CHECKPOINT_STATUS_LABELS[status],
          count: statusCounts[status],
          pressed: statuses.includes(status),
        }))}
        label="Filter by checkpoint status"
        onToggle={(status) => onStatusesChange(toggled(CHECKPOINT_STATUSES, statuses, status))}
      />
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </ResourceMapToolbar>
  )
}
