import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { EditDischargeIdentitySheet } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'

type EditDischargeActionProps = {
  discharge: DischargeDetailDto
}

/** The detail header's edit action, and the sheet correcting the discharge's identity. */
export function EditDischargeAction({ discharge }: EditDischargeActionProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Edit
      </Button>
      <EditDischargeIdentitySheet discharge={discharge} onOpenChange={setOpen} open={open} />
    </>
  )
}
