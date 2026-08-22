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
}: {
  checkpoint: SelectedCheckpoint
  /** `'edit'` is intentionally not modeled yet — see issue #199. */
  mode?: 'view' | 'create'
  onClose: () => void
  createPanel?: ReactNode
}) {
  const isCreating = mode === 'create'

  return (
    <Sheet
      disablePointerDismissal={isCreating}
      modal={!isCreating}
      onOpenChange={(open) => !open && onClose()}
      open={isCreating || Boolean(checkpoint)}
    >
      <SheetContent className="overflow-hidden sm:max-w-lg" showOverlay={!isCreating}>
        {isCreating ? (
          createPanel
        ) : (
          <>
            {checkpoint?.selection.kind === 'DOCK' && <DockDetails dock={checkpoint.resource} />}
            {checkpoint?.selection.kind === 'WEIGHING_AREA' && (
              <WeighingAreaDetails area={checkpoint.resource} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
