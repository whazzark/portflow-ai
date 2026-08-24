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
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import type { DockDto } from '@/features/docks/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type DockLifecycleActionsProps = {
  className?: string
  dock: DockDto
}

export function DockLifecycleActions({ className, dock }: DockLifecycleActionsProps) {
  const mutations = useDockMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  const submit = async () => {
    try {
      await mutations.archive.mutateAsync({
        params: { id: dock.id },
        body: { comment: comment || null },
      })

      setOpen(false)
      setComment('')
      toast.success('Dock archived')
    } catch (error) {
      toast.error('Unable to archive dock', {
        description: parseApiError(error).message,
      })
    }
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)} variant="destructive">
        Archive dock
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive dock?</AlertDialogTitle>
            <AlertDialogDescription>
              This dock will remain readable but no longer selectable for new discharges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="dock-lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="dock-lifecycle-comment"
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
