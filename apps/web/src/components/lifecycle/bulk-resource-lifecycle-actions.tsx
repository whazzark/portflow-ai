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
import { classnames } from '@/libraries/shadcn/helpers'
import { parseApiError } from '@/libraries/tuyau/api-error'
import {
  BULK_LIFECYCLE_COMMENT_DESCRIPTION,
  bulkLifecycleDialogTitle,
  bulkLifecycleFailureTitle,
  describeBulkLifecycleEffect,
  LIFECYCLE_ACTION_LABELS,
  LIFECYCLE_COMMENT_LABEL,
  LIFECYCLE_PAST_PARTICIPLES,
  LIFECYCLE_PENDING_LABELS,
  type LifecycleAction,
} from './lifecycle-copy'

export type BulkLifecycleBlocker = {
  id: string
  name?: string
  /** Open on purpose: each resource refuses for its own reasons — a suspended truck, a transport
   * company that still provides available trucks — and names them through `blockerReasonLabels`. */
  reason: string
}

export type BulkLifecycleOutcome = {
  updatedCount: number
  blocked: BulkLifecycleBlocker[]
}

export const DEFAULT_BLOCKER_REASON_LABELS: Record<string, string> = {
  IN_USE: 'used by an active or planned discharge',
  NOT_FOUND: 'not found',
  ALREADY_ARCHIVED: 'already archived',
  ALREADY_AVAILABLE: 'already available',
}

type BulkResourceLifecycleSubmissionProps = {
  /** Lower-case resource noun, e.g. `dock`, `weighing area`, `warehouse`. Drives every label. */
  singular: string
  /** Lower-case plural of `singular`. */
  plural: string
  /** Prefix for the comment field's element id, so several instances never collide. */
  idPrefix: string
  /** Which lifecycle transition the current selection is for. */
  action: LifecycleAction
  selectedIds: string[]
  onSuccess: (outcome: BulkLifecycleOutcome) => void
  /** Submits the bulk request for this resource and action, returning its normalized outcome. Each
   * resource feature adapts its own response shape (e.g. `{ updatedDocks, blockedDocks }`) onto
   * `BulkLifecycleOutcome`, so this component holds no resource-specific knowledge. */
  submit: (input: { ids: string[]; comment: string | null }) => Promise<BulkLifecycleOutcome>
  /** Invalidates the resource's own list query after a successful submission. */
  refresh: () => void | Promise<void>
  /** Replaces the canonical effect sentence where a resource genuinely says more — archiving
   * warehouses cascades to their available doors. Receives the size of the selection, which every
   * clause of the sentence has to agree with. */
  describeEffect?: (action: LifecycleAction, count: number) => string
  /** Names blocked reasons this resource can report beyond the shared four. Missing keys fall
   * back to the defaults, and an unknown reason falls back to its own code. */
  blockerReasonLabels?: Record<string, string>
}

type BulkResourceLifecycleDialogProps = BulkResourceLifecycleSubmissionProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The confirmation half of a bulk lifecycle change: the dialog, the request, and the outcome
 * reporting. Split from the toolbar below so a resource whose selection lives inside a panel can
 * trigger it from there — the Doors panel does — while every one of them keeps the same copy, the
 * same comment field, and the same partial-outcome message.
 */
export function BulkResourceLifecycleDialog({
  singular,
  plural,
  idPrefix,
  action,
  selectedIds,
  onSuccess,
  submit: submitRequest,
  refresh,
  describeEffect,
  blockerReasonLabels,
  open,
  onOpenChange,
}: BulkResourceLifecycleDialogProps) {
  const countLabel = (count: number) => `${count} ${count === 1 ? singular : plural}`
  const reasonLabels = { ...DEFAULT_BLOCKER_REASON_LABELS, ...blockerReasonLabels }
  const describeBlocked = (blocked: BulkLifecycleBlocker) =>
    `${blocked.name ?? blocked.id}: ${reasonLabels[blocked.reason] ?? blocked.reason}`

  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const notifyOutcome = (outcome: BulkLifecycleOutcome) => {
    const verb = LIFECYCLE_PAST_PARTICIPLES[action]

    if (outcome.blocked.length === 0) {
      toast.success(`${countLabel(outcome.updatedCount)} ${verb}`)
      return
    }

    // The toolbar stays compact (a count and a button); the per-record breakdown lives here
    // instead, where it does not crowd the UI once read.
    const notify = outcome.updatedCount > 0 ? toast.warning : toast.error

    notify(
      outcome.updatedCount > 0
        ? `${countLabel(outcome.updatedCount)} ${verb}; ${countLabel(outcome.blocked.length)} unchanged`
        : `${countLabel(outcome.blocked.length)} unchanged`,
      { description: outcome.blocked.map(describeBlocked).join(', '), duration: 8000 },
    )
  }

  const submit = async () => {
    setIsSubmitting(true)
    try {
      const outcome = await submitRequest({ ids: selectedIds, comment: comment || null })

      onOpenChange(false)
      setComment('')
      onSuccess(outcome)
      void refresh()
      notifyOutcome(outcome)
    } catch (cause) {
      // As in the single-record dialog, a refusal keeps the dialog open with the typed comment
      // intact so the administrator can correct and resubmit.
      const error = parseApiError(cause)

      toast.error(bulkLifecycleFailureTitle(action, plural), {
        description: error.details?.[0]?.message ?? error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{bulkLifecycleDialogTitle(action, plural)}</AlertDialogTitle>
          <AlertDialogDescription>
            {describeEffect?.(action, selectedIds.length) ??
              describeBulkLifecycleEffect(action, selectedIds.length, singular, plural)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`bulk-${idPrefix}-lifecycle-comment`}>
            {LIFECYCLE_COMMENT_LABEL}
          </FieldLabel>
          <Textarea
            id={`bulk-${idPrefix}-lifecycle-comment`}
            maxLength={1000}
            onChange={(event) => setComment(event.target.value)}
            value={comment}
          />
          <FieldDescription>{BULK_LIFECYCLE_COMMENT_DESCRIPTION}</FieldDescription>
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
            {isSubmitting ? LIFECYCLE_PENDING_LABELS[action] : LIFECYCLE_ACTION_LABELS[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The floating toolbar the map-based selections use: a count, the action, and a way to clear. It is
 * the trigger for the dialog above, not a second implementation of it.
 */
export function BulkResourceLifecycleActions({
  onClear,
  ...submission
}: BulkResourceLifecycleSubmissionProps & {
  /** Empties the selection without acting on it. The toolbar's own affordance: a panel-hosted
   * trigger unchecks a row where the row is. */
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const { action, selectedIds, singular } = submission
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
            variant={action === 'reactivate' ? 'default' : 'destructive'}
          >
            {LIFECYCLE_ACTION_LABELS[action]} selected
          </Button>
          <Button aria-label="Clear selection" onClick={onClear} size="icon-sm" variant="ghost">
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
      <BulkResourceLifecycleDialog {...submission} onOpenChange={setOpen} open={open} />
    </>
  )
}
