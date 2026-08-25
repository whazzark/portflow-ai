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

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')

  const submit = async () => {
    try {
      await mutations.archive.mutateAsync({
        params: { id: company.id },
        body: { comment: comment || null },
      })

      setOpen(false)
      setComment('')
      toast.success('Transport company archived')
      onSuccess?.()
    } catch (error) {
      toast.error(`Unable to archive transport company “${company.name}”`, {
        description: parseApiError(error).message,
      })
    }
  }

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)} variant="destructive">
        Archive company
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive company?</AlertDialogTitle>
            <AlertDialogDescription>
              This company will remain readable but will no longer be selectable for new operational
              use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="archive-transport-company-comment">
                Comment (optional)
              </FieldLabel>
              <Textarea
                id="archive-transport-company-comment"
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <FieldDescription>
                Keep a short explanation for the archival (maximum 1,000 characters).
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
