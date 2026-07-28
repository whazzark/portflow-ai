import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import type { BulkCustomerLifecycleResult, CustomerDto } from '@/features/customers/types'
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'

type BulkLifecycleActionsProps = {
  customers: CustomerDto[]
  isArchived: boolean
  onClear: () => void
  onSuccess: (result: BulkCustomerLifecycleResult) => void
}

export function BulkLifecycleActions({
  customers,
  isArchived,
  onClear,
  onSuccess,
}: BulkLifecycleActionsProps) {
  const mutations = useCustomerMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<ReturnType<typeof parseApiError> | null>(null)
  const [blockedCustomers, setBlockedCustomers] = useState<
    BulkCustomerLifecycleResult['blockedCustomers']
  >([])

  const submit = async () => {
    setError(null)
    try {
      const body = { ids: customers.map((customer) => customer.id), comment: comment || null }
      const result = isArchived
        ? await mutations.reactivateMany.mutateAsync({ body })
        : await mutations.archiveMany.mutateAsync({ body })
      setBlockedCustomers(result.data.blockedCustomers)
      setOpen(false)
      setComment('')
      onSuccess(result.data)
      toast.success(
        result.data.blockedCustomers.length > 0
          ? `${result.data.updatedCustomers.length} customer${result.data.updatedCustomers.length === 1 ? '' : 's'} ${isArchived ? 'reactivated' : 'archived'}; ${result.data.blockedCustomers.length} unchanged`
          : `${customers.length} customer${customers.length === 1 ? '' : 's'} ${isArchived ? 'reactivated' : 'archived'}`,
      )
    } catch (cause) {
      setError(parseApiError(cause))
    }
  }

  const visible = customers.length > 0

  return (
    <>
      <div
        aria-hidden={!visible}
        aria-label="Bulk customer actions"
        className={classnames(
          'pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex justify-center transition-[opacity,transform] duration-200 ease-out md:absolute md:inset-x-6 md:bottom-6',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
        inert={!visible}
        role="toolbar"
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-popover px-2 py-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <span className="whitespace-nowrap px-2 font-medium text-sm tabular-nums">
            {customers.length} selected
          </span>
          <Button
            onClick={() => {
              setError(null)
              setBlockedCustomers([])
              setOpen(true)
            }}
            size="sm"
            variant={isArchived ? 'default' : 'destructive'}
          >
            {isArchived ? 'Reactivate selected' : 'Archive selected'}
          </Button>
          {blockedCustomers.length > 0 && (
            <Alert className="max-w-md" variant="destructive">
              <AlertTitle>Some customers were unchanged</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {blockedCustomers.map((blocked) => (
                    <li key={blocked.id}>
                      {blocked.code ?? blocked.id}: {formatBlockerReason(blocked.reason)}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <Button aria-label="Clear selection" onClick={onClear} size="icon-sm" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchived ? 'Reactivate selected customers?' : 'Archive selected customers?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchived
                ? 'These customers will become selectable for new Discharges.'
                : 'These customers will remain readable but no longer selectable for new Discharges.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error.message}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="bulk-lifecycle-comment">Comment (optional)</FieldLabel>
            <Textarea
              id="bulk-lifecycle-comment"
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutations.archiveMany.isPending || mutations.reactivateMany.isPending}
              onClick={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {isArchived ? 'Reactivate' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function formatBlockerReason(
  reason: BulkCustomerLifecycleResult['blockedCustomers'][number]['reason'],
) {
  return (
    {
      IN_USE: 'used by an active or planned discharge',
      NOT_FOUND: 'not found',
      ALREADY_ARCHIVED: 'already archived',
      ALREADY_AVAILABLE: 'already available',
    }[reason] ?? reason
  )
}
