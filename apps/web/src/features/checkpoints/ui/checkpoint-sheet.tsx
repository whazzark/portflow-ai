import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { CheckpointSelection } from '@/features/checkpoints/checkpoint-selection'
import type { DockDto } from '@/features/docks/types'
import { DockDetails } from '@/features/docks/ui/dock-details'

export type SelectedCheckpoint =
  | {
      selection: CheckpointSelection & { kind: 'DOCK' }
      resource: DockDto
    }
  | undefined

export function CheckpointSheet({
  checkpoint,
  onClose,
}: {
  checkpoint: SelectedCheckpoint
  onClose: () => void
}) {
  return (
    <Sheet open={Boolean(checkpoint)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-hidden sm:max-w-lg">
        {checkpoint?.selection.kind === 'DOCK' && <DockDetails dock={checkpoint.resource} />}
      </SheetContent>
    </Sheet>
  )
}
