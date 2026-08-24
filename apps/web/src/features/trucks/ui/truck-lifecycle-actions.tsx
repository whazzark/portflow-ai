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
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { TruckDto } from '@/features/trucks/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type TruckLifecycleActionsProps = {
  className?: string
  truck: TruckDto
}

export function TruckLifecycleActions({ className, truck }: TruckLifecycleActionsProps) {
  const mutations = useTruckMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  const submit = async () => {
    try {
      await mutations.archive.mutateAsync({
        params: { id: truck.id },
        body: { comment: comment || null },
      })

      setOpen(false)
      setComment('')
      toast.success('Truck archived')
    } catch (error) {
      // A refusal (already-archived, in-use) may mean the truck's authoritative state has moved
      // on since this view loaded; refresh so the consultation workspace shows it, not just the
      // success path.
      void mutations.refreshTrucks()
      toast.error('Unable to archive truck', {
        description: parseApiError(error).message,
      })
    }
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)} variant="destructive">
        Archive truck
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive truck?</AlertDialogTitle>
            <AlertDialogDescription>
              This truck will remain readable but no longer offered for new operational work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="truck-lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="truck-lifecycle-comment"
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
              onClick={() => {
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
