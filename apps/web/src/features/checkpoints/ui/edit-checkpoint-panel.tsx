import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CHECKPOINT_KIND_LABELS, type CheckpointKind } from '@/features/checkpoints/types'
import {
  CheckpointResourceForm,
  type PendingCheckpointPlacement,
} from '@/features/checkpoints/ui/checkpoint-resource-form'
import { resourceFailureTitle } from '@/helpers/resource-copy'

export function EditCheckpointPanel<
  TResource extends { name: string; latitude: number; longitude: number },
>({
  kind,
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to details
        </Button>
        <SheetTitle>Edit {resourceNoun}</SheetTitle>
        <SheetDescription>
          Drag the marker or edit its coordinates to reposition {resource.name}.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
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
          onNotFound={onNotFound}
          onPendingChange={onDraftChange}
          onSubmit={onUpdate}
          onSuccess={onSuccess}
          pending={draft}
          pendingLabel="Saving…"
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
