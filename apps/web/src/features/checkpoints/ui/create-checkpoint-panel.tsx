import type { ResourceMapAnchor } from '@/components/resource-map/resource-map-anchor'
import { ResourceMapCard } from '@/components/resource-map/resource-map-card'
import { CHECKPOINT_KIND_LABELS, type CheckpointKind } from '@/features/checkpoints/types'
import {
  CheckpointResourceForm,
  type PendingCheckpointPlacement,
} from '@/features/checkpoints/ui/checkpoint-resource-form'
import { resourceFailureTitle } from '@/helpers/resource-copy'

const PLACEMENT_HINT_BY_KIND: Record<CheckpointKind, string> = {
  DOCK: 'Drag the pin to adjust its position.',
  WEIGHING_AREA: 'Place the pin where trucks stand on the weighbridge.',
}

/**
 * The creation card of placement mode, anchored to the pending pin once there is one. It is open
 * from the start, so the coordinates can also be typed without ever clicking the map.
 */
export function CreateCheckpointPanel<TResource>({
  kind,
  anchor,
  pending,
  onPendingChange,
  onCancel,
  onCreate,
  onSuccess,
}: {
  kind: CheckpointKind
  anchor: ResourceMapAnchor | null
  pending: PendingCheckpointPlacement | null
  onPendingChange: (point: PendingCheckpointPlacement) => void
  onCancel: () => void
  onCreate: (value: { name: string; latitude: number; longitude: number }) => Promise<TResource>
  onSuccess: (resource: TResource) => void
}) {
  const resourceNoun = CHECKPOINT_KIND_LABELS[kind].toLowerCase()

  return (
    <ResourceMapCard
      anchor={anchor}
      onClose={onCancel}
      subtitle={PLACEMENT_HINT_BY_KIND[kind]}
      title={`New ${resourceNoun}`}
    >
      <CheckpointResourceForm
        failureTitle={(name) => resourceFailureTitle('create', resourceNoun, name)}
        kind={kind}
        onCancel={onCancel}
        onPendingChange={onPendingChange}
        onSubmit={onCreate}
        onSuccess={onSuccess}
        pending={pending}
        submitLabel={`Create ${resourceNoun}`}
      />
    </ResourceMapCard>
  )
}
