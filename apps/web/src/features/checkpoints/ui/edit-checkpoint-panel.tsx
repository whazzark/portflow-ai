import type { ResourceMapAnchor } from '@/components/resource-map/resource-map-anchor'
import { ResourceMapCard } from '@/components/resource-map/resource-map-card'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { CHECKPOINT_KIND_LABELS, type CheckpointKind } from '@/features/checkpoints/types'
import { formatCheckpointCoordinates } from '@/features/checkpoints/ui/checkpoint-detail-card'
import {
  CheckpointResourceForm,
  type PendingCheckpointPlacement,
} from '@/features/checkpoints/ui/checkpoint-resource-form'
import { resourceFailureTitle } from '@/helpers/resource-copy'

/** The edit card of move mode, anchored to the draggable pin. Cancel restores where it stood. */
export function EditCheckpointPanel<
  TResource extends { name: string; latitude: number; longitude: number },
>({
  kind,
  anchor,
  resource,
  draft,
  origin,
  onDraftChange,
  onRestorePosition,
  onCancel,
  onNotFound,
  onUpdate,
  onSuccess,
}: {
  kind: CheckpointKind
  anchor: ResourceMapAnchor | null
  resource: TResource
  draft: PendingCheckpointPlacement
  /** Where the resource stood when this edit session started — not its live, refetchable position. */
  origin: PendingCheckpointPlacement
  onDraftChange: (point: PendingCheckpointPlacement) => void
  onRestorePosition: () => void
  onCancel: () => void
  onNotFound: () => void
  onUpdate: (value: { name: string; latitude: number; longitude: number }) => Promise<TResource>
  onSuccess: (resource: TResource) => void
}) {
  const resourceNoun = CHECKPOINT_KIND_LABELS[kind].toLowerCase()
  const positionModified =
    draft.latitude !== origin.latitude || draft.longitude !== origin.longitude

  return (
    <ResourceMapCard
      anchor={anchor}
      autoFocusHeading={false}
      onClose={onCancel}
      title={`Edit ${resourceNoun}`}
    >
      <div className="mb-4 flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground text-xs">Previous position</span>
        <span className="font-mono tabular-nums">{formatCheckpointCoordinates(origin)}</span>
      </div>
      {positionModified && (
        <FieldDescription className="mb-4 flex items-center justify-between gap-2" role="status">
          <span>Position modified</span>
          <Button onClick={onRestorePosition} size="sm" type="button" variant="link">
            Restore original position
          </Button>
        </FieldDescription>
      )}
      <CheckpointResourceForm
        failureTitle={() => resourceFailureTitle('update', resourceNoun, resource.name)}
        initialValues={resource}
        kind={kind}
        onCancel={onCancel}
        onNotFound={onNotFound}
        onPendingChange={onDraftChange}
        onSubmit={onUpdate}
        onSuccess={onSuccess}
        pending={draft}
        submitLabel="Save changes"
      />
    </ResourceMapCard>
  )
}
