import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CHECKPOINT_KIND_LABELS, type CheckpointKind } from '@/features/checkpoints/types'
import {
  CheckpointResourceForm,
  type PendingCheckpointPlacement,
} from '@/features/checkpoints/ui/checkpoint-resource-form'

export function CreateCheckpointPanel<TResource>({
  kind,
  pending,
  onPendingChange,
  onCreate,
  onSuccess,
}: {
  kind: CheckpointKind
  pending: PendingCheckpointPlacement | null
  onPendingChange: (point: PendingCheckpointPlacement) => void
  onCreate: (value: { name: string; latitude: number; longitude: number }) => Promise<TResource>
  onSuccess: (resource: TResource) => void
}) {
  const resourceNoun = CHECKPOINT_KIND_LABELS[kind].toLowerCase()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create {resourceNoun}</SheetTitle>
        <SheetDescription>
          Click a point on the map to place the new {resourceNoun}, then name it.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <CheckpointResourceForm
          errorTitle={`Unable to create ${resourceNoun}`}
          kind={kind}
          onPendingChange={onPendingChange}
          onSubmit={onCreate}
          onSuccess={onSuccess}
          pending={pending}
          pendingLabel="Creating…"
          submitLabel={`Create ${resourceNoun}`}
        />
      </div>
    </div>
  )
}
