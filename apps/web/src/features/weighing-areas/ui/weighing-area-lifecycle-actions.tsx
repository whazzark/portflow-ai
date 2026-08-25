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
import { useWeighingAreaMutations } from '@/features/weighing-areas/mutations/use-weighing-area-mutations'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type WeighingAreaLifecycleActionsProps = {
  className?: string
  area: WeighingAreaDto
}

export function WeighingAreaLifecycleActions({
  className,
  area,
}: WeighingAreaLifecycleActionsProps) {
  const mutations = useWeighingAreaMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  const submit = async () => {
    try {
      await mutations.archive.mutateAsync({
        params: { id: area.id },
        body: { comment: comment || null },
      })

      setOpen(false)
      setComment('')
      toast.success('Weighing area archived')
    } catch (cause) {
      // The dialog deliberately stays open (`setOpen(false)` only runs on success), so the typed
      // comment survives a refusal and the administrator can correct it and resubmit without
      // reopening the weighing area (spec US3 scenario 6) — matching the dock component.
      const error = parseApiError(cause)

      toast.error(`Unable to archive weighing area “${area.name}”`, {
        // A validation failure's top-level message is only "Validation failure"; the field-level
        // detail is what tells the administrator what to fix.
        description: error.details?.[0]?.message ?? error.message,
      })
    }
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)} variant="destructive">
        Archive weighing area
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive weighing area?</AlertDialogTitle>
            <AlertDialogDescription>
              This weighing area will remain readable but no longer offered for new operational
              work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="weighing-area-lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="weighing-area-lifecycle-comment"
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
