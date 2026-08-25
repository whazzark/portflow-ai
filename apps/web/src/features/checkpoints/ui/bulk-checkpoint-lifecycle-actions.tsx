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
import {
  BULK_LIFECYCLE_DESCRIPTIONS,
  type BulkLifecycleIntent,
  CHECKPOINT_KIND_PLURAL_LABELS,
  CHECKPOINT_KIND_SINGULAR_LABELS,
  CHECKPOINT_PARAM_BY_KIND,
  type CheckpointKind,
} from '@/features/checkpoints/types'
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type BulkLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export type BulkLifecycleOutcome = {
  updatedCount: number
  blocked: BulkLifecycleBlocker[]
}

type BulkCheckpointLifecycleActionsProps = {
  /** Which checkpoint kind this instance acts on — drives every label and the request it sends. */
  kind: CheckpointKind
  /** Which lifecycle transition the current selection is for. */
  intent: BulkLifecycleIntent
  selectedIds: string[]
  onClear: () => void
  onSuccess: (outcome: BulkLifecycleOutcome) => void
  /** Submits the bulk request for this kind and intent, returning its normalized outcome. Each
   * resource feature adapts its own response shape (e.g. `{ updatedDocks, blockedDocks }`) onto
   * `BulkLifecycleOutcome`, so this component holds no resource-specific knowledge. */
  submit: (input: { ids: string[]; comment: string | null }) => Promise<BulkLifecycleOutcome>
  /** Invalidates the resource's own list query after a successful submission. */
  refresh: () => void | Promise<void>
}

const BLOCKER_REASON_LABELS: Record<BulkLifecycleBlocker['reason'], string> = {
  IN_USE: 'used by an active or planned discharge',
  NOT_FOUND: 'not found',
  ALREADY_ARCHIVED: 'already archived',
  ALREADY_AVAILABLE: 'already available',
}

export function BulkCheckpointLifecycleActions({
  kind,
  intent,
  selectedIds,
  onClear,
  onSuccess,
  submit: submitRequest,
  refresh,
}: BulkCheckpointLifecycleActionsProps) {
  const isReactivate = intent === 'REACTIVATE'
  const singular = CHECKPOINT_KIND_SINGULAR_LABELS[kind]
  const plural = CHECKPOINT_KIND_PLURAL_LABELS[kind]
  const actionLabel = isReactivate ? 'Reactivate' : 'Archive'
  const pastTense = isReactivate ? 'reactivated' : 'archived'
  const countLabel = (count: number) => `${count} ${count === 1 ? singular : plural}`

  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const outcome = await submitRequest({ ids: selectedIds, comment: comment || null })

      setOpen(false)
      setComment('')
      onSuccess(outcome)
      void refresh()
      toast.success(
        outcome.blocked.length > 0
          ? `${countLabel(outcome.updatedCount)} ${pastTense}; ${outcome.blocked.length} unchanged`
          : `${countLabel(selectedIds.length)} ${pastTense}`,
        outcome.blocked.length > 0
          ? {
              description: outcome.blocked
                .map(
                  (blocked) =>
                    `${blocked.name ?? blocked.id}: ${BLOCKER_REASON_LABELS[blocked.reason]}`,
                )
                .join(', '),
            }
          : undefined,
      )
    } catch (cause) {
      toast.error(`Unable to ${actionLabel.toLowerCase()} ${plural}`, {
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
        aria-label={`Bulk ${singular} actions`}
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
            {actionLabel} selected
          </Button>
          <Button aria-label="Clear selection" onClick={onClear} size="icon-sm" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`${actionLabel} selected ${plural}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {BULK_LIFECYCLE_DESCRIPTIONS[kind][intent]}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={`bulk-${CHECKPOINT_PARAM_BY_KIND[kind]}-lifecycle-comment`}>
              Comment (optional)
            </FieldLabel>
            <Textarea
              id={`bulk-${CHECKPOINT_PARAM_BY_KIND[kind]}-lifecycle-comment`}
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
              {actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
