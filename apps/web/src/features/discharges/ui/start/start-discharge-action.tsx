import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { StartDischargeDialog } from '@/features/discharges/ui/start/start-discharge-dialog'

type StartDischargeActionProps = {
  discharge: DischargeDetailDto
  /** A started discharge has no start action, so focus has to move somewhere that stays. */
  onStarted: () => void
}

/** The detail header's start action, and the confirmation it opens. */
export function StartDischargeAction({ discharge, onStarted }: StartDischargeActionProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        Start
      </Button>
      {open && (
        <StartDischargeDialog
          discharge={discharge}
          onClose={() => setOpen(false)}
          onStarted={onStarted}
        />
      )}
    </>
  )
}
