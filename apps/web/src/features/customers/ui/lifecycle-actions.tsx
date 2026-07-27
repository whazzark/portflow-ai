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
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import type { CustomerDto } from '@/features/customers/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type LifecycleActionsProps = {
  className?: string
  customer: CustomerDto
}

export function LifecycleActions({ className, customer }: LifecycleActionsProps) {
  const mutations = useCustomerMutations()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const archived = customer.status === 'ARCHIVED'

  const submit = async () => {
    try {
      if (archived) {
        await mutations.reactivate.mutateAsync({
          params: { id: customer.id },
          body: { comment: comment || null },
        })
      } else {
        await mutations.archive.mutateAsync({
          params: { id: customer.id },
          body: { comment: comment || null },
        })
      }

      setOpen(false)
      setComment('')
      toast.success(archived ? 'Customer reactivated' : 'Customer archived')
    } catch (error) {
      toast.error(archived ? 'Unable to reactivate customer' : 'Unable to archive customer', {
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
        {archived ? 'Reactivate customer' : 'Archive customer'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archived ? 'Reactivate customer?' : 'Archive customer?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? 'This Customer will become selectable for new Discharges.'
                : 'This Customer will remain readable but no longer selectable for new Discharges.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="lifecycle-comment"
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <FieldDescription>
                Keep a short explanation for the lifecycle change.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutations.archive.isPending || mutations.reactivate.isPending}
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
