import type { ReactNode } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { CheckpointSelection } from '@/features/checkpoints/checkpoint-selection'
import type { DockDto } from '@/features/docks/types'
import { DockDetails } from '@/features/docks/ui/dock-details'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { WeighingAreaDetails } from '@/features/weighing-areas/ui/weighing-area-details'

export type SelectedCheckpoint =
  | {
      selection: CheckpointSelection & { kind: 'DOCK' }
      resource: DockDto
    }
  | {
      selection: CheckpointSelection & { kind: 'WEIGHING_AREA' }
      resource: WeighingAreaDto
    }
  | undefined

export function CheckpointSheet({
  checkpoint,
  mode = 'view',
  onClose,
  createPanel = null,
  editPanel = null,
  canEditCheckpoint,
  onEditCheckpoint,
}: {
  checkpoint: SelectedCheckpoint
  mode?: 'view' | 'create' | 'edit'
  onClose: () => void
  createPanel?: ReactNode
  editPanel?: ReactNode
  canEditCheckpoint: boolean
  onEditCheckpoint: () => void
}) {
  const isCreating = mode === 'create'
  const isEditing = mode === 'edit'

  return (
    <Sheet
      disablePointerDismissal={isCreating || isEditing}
      modal={!isCreating && !isEditing}
      onOpenChange={(open) => !open && onClose()}
      open={isCreating || isEditing || Boolean(checkpoint)}
    >
      <SheetContent className="overflow-hidden sm:max-w-lg" showOverlay={!isCreating && !isEditing}>
        {isCreating ? (
          createPanel
        ) : isEditing ? (
          editPanel
        ) : (
          <>
            {checkpoint?.selection.kind === 'DOCK' && (
              <DockDetails
                canEdit={canEditCheckpoint}
                dock={checkpoint.resource}
                onEdit={onEditCheckpoint}
              />
            )}
            {checkpoint?.selection.kind === 'WEIGHING_AREA' && (
              <WeighingAreaDetails
                area={checkpoint.resource}
                canEdit={canEditCheckpoint}
                onEdit={onEditCheckpoint}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
