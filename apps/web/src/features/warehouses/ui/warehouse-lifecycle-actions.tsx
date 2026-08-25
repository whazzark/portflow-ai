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

export function describeDoorCascade(availableDoors: number) {
  if (availableDoors === 0) {
    return 'It has no available door to archive with it.'
  }

  return availableDoors === 1
    ? 'Its 1 available door is archived with it and stays readable.'
    : `Its ${availableDoors} available doors are archived with it and stay readable.`
}

export function WarehouseLifecycleActions({
  className,
  warehouse,
}: {
  className?: string
  warehouse: WarehouseWithDoorsDto
}) {
  const mutations = useWarehouseMutations()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  if (warehouse.status === 'ARCHIVED') {
    return null
  }

  const availableDoors = countAvailableDoors(warehouse)

  const submit = async () => {
    try {
      const response = await mutations.archive.mutateAsync({
        params: { id: warehouse.id },
        body: { comment: comment || null },
      })

      setOpen(false)
      setComment('')
      const archivedDoors = response.data.archivedDoorCount
      toast.success(
        archivedDoors === 0
          ? 'Warehouse archived'
          : `Warehouse archived with ${archivedDoors} ${archivedDoors === 1 ? 'door' : 'doors'}`,
      )
    } catch (cause) {
      // The dialog deliberately stays open so the typed comment survives a refusal and the
      // administrator can correct it and resubmit without reopening the warehouse.
      const error = parseApiError(cause)

      toast.error(`Unable to archive warehouse “${warehouse.name}”`, {
        // A validation failure's top-level message is only "Validation failure"; the field-level
        // detail is what tells the administrator what to fix.
        description: error.details?.[0]?.message ?? error.message,
      })
    }
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)} variant="destructive">
        Archive warehouse
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive warehouse?</AlertDialogTitle>
            <AlertDialogDescription>
              {`“${warehouse.name}” remains readable but is no longer selectable for new operational work. ${describeDoorCascade(availableDoors)}`}
            </AlertDialogDescription>
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
              disabled={mutations.archive.isPending}
              onClick={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
