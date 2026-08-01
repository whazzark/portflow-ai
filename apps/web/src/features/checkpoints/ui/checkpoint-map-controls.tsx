import { ResourceMapControls } from '@/components/resource-map/resource-map-controls'
import type { ResourceStatusFilter } from '@/components/resource-map/resource-map-types'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CheckpointKindIcon } from '@/features/checkpoints/map/checkpoint-marker'
import type { CheckpointKind, CheckpointLayerVisibility } from '@/features/checkpoints/types'

const KIND_LABELS: Record<CheckpointKind, string> = {
  DOCK: 'Docks',
  WEIGHING_AREA: 'Weighing areas',
}

export function CheckpointMapControls({
  hasMatches,
  layerVisibility,
  onLayerVisibilityChange,
  onSearchChange,
  onStatusChange,
  search,
  status,
  counts,
}: {
  hasMatches: boolean
  layerVisibility: CheckpointLayerVisibility
  onLayerVisibilityChange: (visibility: CheckpointLayerVisibility) => void
  onSearchChange: (search: string) => void
  onStatusChange: (status: ResourceStatusFilter) => void
  search: string
  status: ResourceStatusFilter
  counts?: Record<ResourceStatusFilter, number>
}) {
  const visibleKinds = (Object.keys(KIND_LABELS) as CheckpointKind[]).filter(
    (kind) => layerVisibility[kind],
  )

  return (
    <ResourceMapControls
      counts={counts ?? { all: 0, available: 0, archived: 0 }}
      hasMatches={hasMatches}
      onSearchChange={onSearchChange}
      onStatusChange={onStatusChange}
      resourceLabel="checkpoint"
      resourceLabelPlural="checkpoints"
      search={search}
      status={status}
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel>Checkpoint types</DropdownMenuLabel>
        {(Object.keys(KIND_LABELS) as CheckpointKind[]).map((kind) => (
          <DropdownMenuCheckboxItem
            checked={layerVisibility[kind]}
            closeOnClick={false}
            disabled={visibleKinds.length === 1 && layerVisibility[kind]}
            key={kind}
            onCheckedChange={(checked) => {
              if (!checked && visibleKinds.length === 1) {
                return
              }
              onLayerVisibilityChange({ ...layerVisibility, [kind]: checked })
            }}
          >
            <CheckpointKindIcon className="text-muted-foreground" kind={kind} />
            {KIND_LABELS[kind]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
    </ResourceMapControls>
  )
}
