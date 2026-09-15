import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { LOT_GONE_MESSAGE } from '@/features/discharges/ui/detail/product-lot-sheet'
import { parseApiError } from '@/libraries/tuyau/api-error'

type ProductLot = DischargeDetailDto['productLots'][number]

/**
 * Refusals that the dialog explains in place, because retrying cannot succeed and the user needs to
 * read why before dismissing it.
 */
const BLOCKING_REFUSALS: Record<string, string> = {
  E_DISCHARGE_LAST_PRODUCT_LOT: 'A discharge needs at least one product lot',
  E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS: 'This product lot has warehouse door assignments',
}

/**
 * The deliberate confirmation in front of a lot's removal. Mounted only while open, and kept open on
 * a refusal — `event.preventDefault()` on the confirm action stops the primitive from closing.
 */
export function RemoveProductLotDialog({
  discharge,
  lot,
  onClose,
}: {
  discharge: DischargeDetailDto
  lot: ProductLot
  onClose: () => void
}) {
  const { removeLot } = useDischargeMutations()
  const [blockingRefusal, setBlockingRefusal] = useState<string | null>(null)

  const submit = async () => {
    try {
      await removeLot.mutateAsync({ params: { dischargeId: discharge.id, id: lot.id } })

      onClose()
      toast.success('Product lot removed')
    } catch (cause) {
      const error = parseApiError(cause)
      const blocking = BLOCKING_REFUSALS[error.code ?? '']

      if (blocking) {
        setBlockingRefusal(blocking)

        return
      }

      if (error.code === 'E_PRODUCT_LOT_NOT_FOUND') {
        onClose()
        toast.error(LOT_GONE_MESSAGE)

        return
      }
      if (error.code === 'E_DISCHARGE_NOT_PLANNED' || error.code === 'E_DISCHARGE_NOT_FOUND') {
        onClose()
        toast.error(STARTED_REFUSAL_MESSAGE)

        return
      }

      toast.error('Unable to remove the product lot', { description: error.message })
    }
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove product lot?</AlertDialogTitle>
          <AlertDialogDescription>
            {lot.customer.name} · {lot.productName}, {formatTonnes(lot.expectedQuantityTonnes)},
            will be removed from this discharge.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blockingRefusal && (
          <Alert variant="destructive">
            <AlertDescription>{blockingRefusal}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={removeLot.isPending || blockingRefusal !== null}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
            variant="destructive"
          >
            {removeLot.isPending ? 'Removing…' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
