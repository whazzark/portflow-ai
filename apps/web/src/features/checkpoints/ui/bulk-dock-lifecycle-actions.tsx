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
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import type { BulkDockLifecycleBlocker, BulkDockLifecycleResult } from '@/features/docks/types'
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'

type BulkDockLifecycleActionsProps = {
  intent: 'ARCHIVE' | 'REACTIVATE'
  selectedIds: string[]
  onClear: () => void
  onSuccess: (result: BulkDockLifecycleResult) => void
}

const BLOCKER_REASON_LABELS: Record<BulkDockLifecycleBlocker['reason'], string> = {
  IN_USE: 'used by an active or planned discharge',
  NOT_FOUND: 'not found',
  ALREADY_ARCHIVED: 'already archived',
  ALREADY_AVAILABLE: 'already available',
}

export function BulkDockLifecycleActions({
  intent,
  selectedIds,
  onClear,
  onSuccess,
}: BulkDockLifecycleActionsProps) {
  const mutations = useDockMutations()
  const isReactivate = intent === 'REACTIVATE'

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const body = { ids: selectedIds, comment: comment || null }
      const result = isReactivate
        ? await mutations.reactivateMany.mutateAsync({ body })
        : await mutations.archiveMany.mutateAsync({ body })
      const { updatedDocks, blockedDocks } = result.data

      setOpen(false)
      setComment('')
      onSuccess(result.data)
      void mutations.refreshDocks()
      const verb = isReactivate ? 'reactivated' : 'archived'
      toast.success(
        blockedDocks.length > 0
          ? `${updatedDocks.length} dock${updatedDocks.length === 1 ? '' : 's'} ${verb}; ${blockedDocks.length} unchanged`
          : `${selectedIds.length} dock${selectedIds.length === 1 ? '' : 's'} ${verb}`,
        blockedDocks.length > 0
          ? {
              description: blockedDocks
                .map(
                  (blocked) =>
                    `${blocked.name ?? blocked.id}: ${BLOCKER_REASON_LABELS[blocked.reason]}`,
                )
                .join(', '),
            }
          : undefined,
      )
    } catch (cause) {
      toast.error(isReactivate ? 'Unable to reactivate docks' : 'Unable to archive docks', {
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
        aria-label="Bulk dock actions"
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
            onClick={() => setOpen(true)}
            size="sm"
            variant={isReactivate ? 'default' : 'destructive'}
          >
            {isReactivate ? 'Reactivate selected' : 'Archive selected'}
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
              {isReactivate ? 'Reactivate selected docks?' : 'Archive selected docks?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isReactivate
                ? 'These docks will become selectable for new discharges again.'
                : 'These docks will remain readable but no longer selectable for new discharges.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="bulk-dock-lifecycle-comment">Comment (optional)</FieldLabel>
            <Textarea
              id="bulk-dock-lifecycle-comment"
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
              {isReactivate ? 'Reactivate' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
