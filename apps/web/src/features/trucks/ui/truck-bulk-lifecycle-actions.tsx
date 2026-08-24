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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { BulkTruckLifecycleBlocker, BulkTruckLifecycleResult } from '@/features/trucks/types'
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'

type TruckBulkLifecycleActionsProps = {
  blockedTrucks: BulkTruckLifecycleBlocker[]
  selectedIds: string[]
  onClear: () => void
  onSuccess: (result: BulkTruckLifecycleResult) => void
}

export function TruckBulkLifecycleActions({
  blockedTrucks,
  selectedIds,
  onClear,
  onSuccess,
}: TruckBulkLifecycleActionsProps) {
  const mutations = useTruckMutations()

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<ReturnType<typeof parseApiError> | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await mutations.archiveMany.mutateAsync({
        body: { ids: selectedIds, comment: comment || null },
      })
      setOpen(false)
      setComment('')
      onSuccess(result.data)
      void mutations.refreshTrucks()
      notifyOutcome(result.data)
    } catch (cause) {
      setError(parseApiError(cause))
    } finally {
      setIsSubmitting(false)
    }
  }

  const visible = selectedIds.length > 0

  return (
    <>
      <div
        aria-hidden={!visible}
        aria-label="Bulk truck actions"
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
          <Button
            onClick={() => {
              setError(null)
              setOpen(true)
            }}
            size="sm"
            variant="destructive"
          >
            {blockedTrucks.length > 0 ? 'Retry blocked trucks' : 'Archive selected'}
          </Button>
          <Button aria-label="Clear selection" onClick={onClear} size="icon-sm" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive selected trucks?</AlertDialogTitle>
            <AlertDialogDescription>
              These trucks will remain readable but no longer offered for new operational work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error.message}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="truck-bulk-lifecycle-comment">Comment (optional)</FieldLabel>
            <Textarea
              id="truck-bulk-lifecycle-comment"
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

function formatBlockerReason(reason: BulkTruckLifecycleBlocker['reason']) {
  return (
    {
      IN_USE: 'used by an active or planned discharge',
      NOT_FOUND: 'not found',
      ALREADY_ARCHIVED: 'already archived',
    }[reason] ?? reason
  )
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function notifyOutcome(result: BulkTruckLifecycleResult) {
  const archivedCount = result.updatedTrucks.length
  const blocked = result.blockedTrucks

  if (blocked.length === 0) {
    toast.success(`${pluralize(archivedCount, 'truck')} archived`)
    return
  }

  const reasons = blocked
    .map(
      (blocker) => `${blocker.registration ?? blocker.id} (${formatBlockerReason(blocker.reason)})`,
    )
    .join(', ')
  // The toolbar stays compact (a count and a button); the per-truck breakdown that used to
  // sit permanently in that frame lives here instead, where it doesn't crowd the UI once read.
  const toastFn = archivedCount > 0 ? toast.warning : toast.error
  toastFn(
    archivedCount > 0
      ? `${pluralize(archivedCount, 'truck')} archived; ${pluralize(blocked.length, 'truck')} unchanged`
      : `${pluralize(blocked.length, 'truck')} unchanged`,
    { description: reasons, duration: 8000 },
  )
}
