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

  const archived = dock.status === 'ARCHIVED'

  const submit = async () => {
    try {
      if (archived) {
        await mutations.reactivate.mutateAsync({
          params: { id: dock.id },
          body: { comment: comment || null },
        })
      } else {
        await mutations.archive.mutateAsync({
          params: { id: dock.id },
          body: { comment: comment || null },
        })
      }

      setOpen(false)
      setComment('')
      toast.success(archived ? 'Dock reactivated' : 'Dock archived')
    } catch (error) {
      toast.error(archived ? 'Unable to reactivate dock' : 'Unable to archive dock', {
        description: parseApiError(error).message,
      })
    }
  }

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        variant={archived ? 'default' : 'destructive'}
      >
        {archived ? 'Reactivate dock' : 'Archive dock'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archived ? 'Reactivate dock?' : 'Archive dock?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? 'This dock will become selectable for new discharges again.'
                : 'This dock will remain readable but no longer selectable for new discharges.'}
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
              disabled={archived ? mutations.reactivate.isPending : mutations.archive.isPending}
              onClick={() => {
                void submit()
              }}
            >
              {archived ? 'Reactivate' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
