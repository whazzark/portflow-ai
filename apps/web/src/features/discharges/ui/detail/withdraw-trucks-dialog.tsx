import { toast } from 'sonner'

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
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { shiftsSelectingTrucks } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { parseApiError } from '@/libraries/tuyau/api-error'

type WithdrawTrucksDialogProps = {
  discharge: DischargeDetailDto
  truckIds: string[]
  onClose: () => void
  onWithdrawn: () => void
}

function withdrawnMessage(count: number) {
  return count === 1 ? 'Truck withdrawn' : `${count} trucks withdrawn`
}

/**
 * The confirmation in front of a withdrawal. It names the planned shifts that lose the trucks too,
 * read from the detail on screen: the withdrawal changes them in the same step, and a user who
 * planned those shifts should not discover it afterwards. Mounted only while open.
 */
export function WithdrawTrucksDialog({
  discharge,
  truckIds,
  onClose,
  onWithdrawn,
}: WithdrawTrucksDialogProps) {
  const { withdrawTrucks } = useDischargeMutations()
  const registrations = discharge.truckPool
    .filter((entry) => truckIds.includes(entry.truckId))
    .map((entry) => entry.registration)
  const affectedShifts = shiftsSelectingTrucks(discharge, truckIds)

  const submit = async () => {
    try {
      await withdrawTrucks.mutateAsync({
        params: { dischargeId: discharge.id },
        body: { truckIds },
      })

      onWithdrawn()
      onClose()
      toast.success(withdrawnMessage(truckIds.length))
    } catch (cause) {
      const error = parseApiError(cause)

      if (error.code === 'E_DISCHARGE_NOT_PLANNED' || error.code === 'E_DISCHARGE_NOT_FOUND') {
        onClose()
        toast.error(STARTED_REFUSAL_MESSAGE)

        return
      }

      toast.error('Unable to withdraw trucks', { description: error.message })
    }
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {truckIds.length === 1 ? 'Withdraw truck?' : `Withdraw ${truckIds.length} trucks?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {registrations.join(', ')} will be removed from this discharge's pool.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {affectedShifts.length > 0 && (
          <div className="grid gap-1 text-sm">
            <p>They will also be removed from these shifts:</p>
            <ul className="list-disc pl-5">
              {affectedShifts.map((shift) => (
                <li key={shift.id}>{formatShiftPeriod(shift)}</li>
              ))}
            </ul>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={withdrawTrucks.isPending}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
            variant="destructive"
          >
            {withdrawTrucks.isPending ? 'Withdrawing…' : 'Withdraw'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
