import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useWarehouseMutations } from '@/features/warehouses/mutations/use-warehouse-mutations'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

/** Counted from the doors already embedded in the warehouse, so the confirmation needs no extra
 * request. It is advisory: the authoritative set is assessed when the archival is submitted, and
 * the reported outcome — not this number — says what was archived. */
export function countAvailableDoors(warehouse: WarehouseWithDoorsDto) {
  return (warehouse.doors ?? []).filter((door) => door.status === 'AVAILABLE').length
}

/** The mirror for reactivation. Only a door archived *with* this warehouse comes back with it, so
 * a door retired on its own is excluded — and the status check matters as much as the record:
 * reactivation leaves `archivedWithWarehouse` cleared, but an available door must never be counted
 * as returning to service. Advisory in exactly the same way. */
export function countRestorableDoors(warehouse: WarehouseWithDoorsDto) {
  return (warehouse.doors ?? []).filter(
    (door) => door.status === 'ARCHIVED' && door.archivedWithWarehouse,
  ).length
}

export function describeDoorCascade(availableDoors: number) {
  if (availableDoors === 0) {
    return 'It has no available door to archive with it.'
  }

  return availableDoors === 1
    ? 'Its 1 available door is archived with it and stays readable.'
    : `Its ${availableDoors} available doors are archived with it and stay readable.`
}

export function describeDoorRestore(restorableDoors: number) {
  if (restorableDoors === 0) {
    return 'No door returns to service with it.'
  }

  return restorableDoors === 1
    ? 'Its 1 door archived with it returns to service.'
    : `Its ${restorableDoors} doors archived with it return to service.`
}

export function WarehouseLifecycleActions({
  className,
  warehouse,
}: {
  className?: string
  warehouse: WarehouseWithDoorsDto
}) {
  const mutations = useWarehouseMutations()
  const [comment, setComment] = useState('')

  // One component for both directions: the dialog, the comment field and its limit, the
  // stay-open-on-failure behaviour and the error parsing are identical, and only the wording, the
  // door count and the mutation differ.
  const isArchived = warehouse.status === 'ARCHIVED'
  // The button follows the live status, but an open dialog must not. It deliberately survives a
  // refusal, so a concurrent change refetched underneath it would otherwise retitle it and rewire
  // its action to the opposite direction under the administrator's cursor. Opening snapshots the
  // direction, and it holds until the dialog closes.
  const [openIntent, setOpenIntent] = useState<'ARCHIVE' | 'REACTIVATE' | null>(null)
  const reactivating = openIntent === 'REACTIVATE'
  const mutation = reactivating ? mutations.reactivate : mutations.archive
  const doorCount = reactivating ? countRestorableDoors(warehouse) : countAvailableDoors(warehouse)
  const description = reactivating
    ? `“${warehouse.name}” becomes selectable again for new operational work. ${describeDoorRestore(doorCount)}`
    : `“${warehouse.name}” remains readable but is no longer selectable for new operational work. ${describeDoorCascade(doorCount)}`

  const submit = async () => {
    try {
      const response = await mutation.mutateAsync({
        params: { id: warehouse.id },
        body: { comment: comment || null },
      })

      setOpenIntent(null)
      setComment('')
      // Narrowed on the payload rather than on `isArchived`: the two mutations return different
      // envelopes, and only the response itself proves which one came back.
      const changedDoors =
        'reactivatedDoorCount' in response.data
          ? response.data.reactivatedDoorCount
          : response.data.archivedDoorCount
      const verb = reactivating ? 'reactivated' : 'archived'
      toast.success(
        changedDoors === 0
          ? `Warehouse ${verb}`
          : `Warehouse ${verb} with ${changedDoors} ${changedDoors === 1 ? 'door' : 'doors'}`,
      )
    } catch (cause) {
      // The dialog deliberately stays open so the typed comment survives a refusal and the
      // administrator can correct it and resubmit without reopening the warehouse.
      const error = parseApiError(cause)

      toast.error(
        `Unable to ${reactivating ? 'reactivate' : 'archive'} warehouse “${warehouse.name}”`,
        {
          // A validation failure's top-level message is only "Validation failure"; the field-level
          // detail is what tells the administrator what to fix.
          description: error.details?.[0]?.message ?? error.message,
        },
      )
    }
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpenIntent(isArchived ? 'REACTIVATE' : 'ARCHIVE')}
        variant={isArchived ? 'default' : 'destructive'}
      >
        {isArchived ? 'Reactivate warehouse' : 'Archive warehouse'}
      </Button>
      <AlertDialog
        open={openIntent !== null}
        onOpenChange={(next) => {
          if (!next) {
            setOpenIntent(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reactivating ? 'Reactivate warehouse?' : 'Archive warehouse?'}
            </AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="warehouse-lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="warehouse-lifecycle-comment"
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <FieldDescription>
                Keep a short explanation for the lifecycle change (maximum 1,000 characters).
              </FieldDescription>
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {reactivating ? 'Reactivate' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
