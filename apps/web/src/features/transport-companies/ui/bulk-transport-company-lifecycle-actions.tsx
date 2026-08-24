import { XIcon } from 'lucide-react'
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import type {
  BulkTransportCompanyLifecycleBlocker,
  BulkTransportCompanyLifecycleResult,
} from '@/features/transport-companies/types'
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'

type BulkTransportCompanyLifecycleActionsProps = {
  selectedIds: string[]
  onClear: () => void
  onSuccess: (result: BulkTransportCompanyLifecycleResult) => void
}

export function BulkTransportCompanyLifecycleActions({
  selectedIds,
  onClear,
  onSuccess,
}: BulkTransportCompanyLifecycleActionsProps) {
  const mutations = useTransportCompanyMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const result = await mutations.archiveMany.mutateAsync({
        body: { ids: selectedIds, comment: comment || null },
      })
      setOpen(false)
      setComment('')
      onSuccess(result.data)
      void mutations.refreshTransportCompanies()

      const archivedCount = result.data.updatedCompanies.length
      const blockedCount = result.data.blockedCompanies.length
      const archivedLabel = `${archivedCount} transport ${archivedCount === 1 ? 'company' : 'companies'} archived`

      if (blockedCount === 0) {
        toast.success(archivedLabel)
      } else {
        toast.warning(`${archivedLabel}; ${blockedCount} unchanged`, {
          description: result.data.blockedCompanies
            .map(
              (blocked) => `${blocked.name ?? blocked.id}: ${formatBlockerReason(blocked.reason)}`,
            )
            .join('\n'),
        })
      }
    } catch (cause) {
      toast.error('Unable to archive transport companies', {
        description: parseApiError(cause).message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const visible = selectedIds.length > 0

  return (
    <>
      <div
        aria-hidden={!visible}
        aria-label="Bulk transport company actions"
        className={classnames(
          'pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex justify-center transition-[opacity,transform] duration-200 ease-out md:absolute md:inset-x-6 md:bottom-6',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
        inert={!visible}
        role="toolbar"
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-popover px-2 py-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <span className="whitespace-nowrap px-2 font-medium text-sm tabular-nums">
            {selectedIds.length} selected
          </span>
          <Button onClick={() => setOpen(true)} size="sm" variant="destructive">
            Archive selected
          </Button>
          <Button aria-label="Clear selection" onClick={onClear} size="icon-sm" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {selectedIds.length} transport{' '}
              {selectedIds.length === 1 ? 'company' : 'companies'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              These companies will remain readable but will no longer be selectable for new
              operational use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="bulk-transport-company-lifecycle-comment">
              Comment (optional)
            </FieldLabel>
            <Textarea
              id="bulk-transport-company-lifecycle-comment"
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
            <FieldDescription>Maximum 1,000 characters.</FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
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

function formatBlockerReason(reason: BulkTransportCompanyLifecycleBlocker['reason']) {
  return (
    {
      NOT_FOUND: 'not found',
      ALREADY_ARCHIVED: 'already archived',
      HAS_AVAILABLE_TRUCKS: 'still provides available trucks',
    }[reason] ?? reason
  )
}
