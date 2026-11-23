import { Button } from '@/components/ui/button'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { StartDischargeDialog } from '@/features/discharges/ui/start/start-discharge-dialog'

type StartDischargeActionProps = {
  discharge: DischargeDetailDto
  /** Held by the page, so that what blocks the start can open the same confirmation. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A started discharge has no start action, so focus has to move somewhere that stays. */
  onStarted: () => void
}

/** The detail header's start action, and the confirmation it opens. */
export function StartDischargeAction({
  discharge,
  open,
  onOpenChange,
  onStarted,
}: StartDischargeActionProps) {
  return (
    <>
      <Button onClick={() => onOpenChange(true)} type="button">
        Start
      </Button>
      {open && (
        <StartDischargeDialog
          discharge={discharge}
          onClose={() => onOpenChange(false)}
          onStarted={onStarted}
        />
      )}
    </>
  )
}
