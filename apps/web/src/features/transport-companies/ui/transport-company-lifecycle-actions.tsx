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
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type TransportCompanyLifecycleActionsProps = {
  className?: string
  company: TransportCompanyDto
  onSuccess?: () => void
}

export function TransportCompanyLifecycleActions({
  className,
  company,
  onSuccess,
}: TransportCompanyLifecycleActionsProps) {
  const mutations = useTransportCompanyMutations()
  const archived = company.status === 'ARCHIVED'

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  const submit = async () => {
    try {
      if (archived) {
        await mutations.reactivate.mutateAsync({
          params: { id: company.id },
          body: { comment: comment || null },
        })
      } else {
        await mutations.archive.mutateAsync({
          params: { id: company.id },
          body: { comment: comment || null },
        })
      }

      setOpen(false)
      setComment('')
      toast.success(archived ? 'Transport company reactivated' : 'Transport company archived')
      onSuccess?.()
    } catch (error) {
      toast.error(
        archived
          ? `Unable to reactivate transport company “${company.name}”`
          : `Unable to archive transport company “${company.name}”`,
        { description: parseApiError(error).message },
      )
    }
  }

  const isPending = archived ? mutations.reactivate.isPending : mutations.archive.isPending

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        variant={archived ? 'default' : 'destructive'}
      >
        {archived ? 'Reactivate company' : 'Archive company'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archived ? 'Reactivate company?' : 'Archive company?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archived
                ? 'This company will become selectable again for new operational use.'
                : 'This company will remain readable but will no longer be selectable for new operational use.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="transport-company-lifecycle-comment">
                Comment (optional)
              </FieldLabel>
              <Textarea
                id="transport-company-lifecycle-comment"
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <FieldDescription>
                Keep a short explanation for the {archived ? 'reactivation' : 'archival'} (maximum
                1,000 characters).
              </FieldDescription>
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
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
