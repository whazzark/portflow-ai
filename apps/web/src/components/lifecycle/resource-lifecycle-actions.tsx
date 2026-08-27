import { useId, useState } from 'react'
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
import { parseApiError } from '@/libraries/tuyau/api-error'
import {
  describeLifecycleEffect,
  LIFECYCLE_ACTION_LABELS,
  LIFECYCLE_COMMENT_DESCRIPTION,
  LIFECYCLE_COMMENT_LABEL,
  LIFECYCLE_PENDING_LABELS,
  type LifecycleAction,
  lifecycleDialogTitle,
  lifecycleFailureTitle,
  lifecycleSuccessMessage,
} from './lifecycle-copy'

/** Everything a resource must declare to move one of its records through its lifecycle. Each
 * feature builds this from its own mutation hook; the components below hold no resource-specific
 * knowledge beyond the noun. */
export type ResourceLifecycleConfig<TResult = unknown> = {
  /** Lower-case resource noun, e.g. `dock`, `weighing area`, `transport company`. */
  singular: string
  /** The record's own display name, used to name it in a refusal toast. */
  name: string
  /** Submits one lifecycle request. */
  submit: (action: LifecycleAction, body: { comment: string | null }) => Promise<TResult>
  /** Invalidates the resource's list query. Called after a refusal, not only after a success. */
  refresh: () => void | Promise<void>
  isPending: boolean
  /** Replaces the canonical effect sentence where a resource genuinely says more — a warehouse
   * archives its available doors along with itself. Falls back to the canonical wording. */
  describeEffect?: (action: LifecycleAction) => string
  /** Replaces the canonical success message with one that reports what the server actually did —
   * a warehouse archival names the doors it cascaded to. */
  describeSuccess?: (action: LifecycleAction, result: TResult) => string
}

const ACTION_VARIANTS: Record<LifecycleAction, 'default' | 'destructive' | 'outline'> = {
  archive: 'destructive',
  reactivate: 'default',
  suspend: 'outline',
  'return-to-service': 'default',
}

/**
 * The confirmation half of a lifecycle change, mounted both by detail-pane footers and by per-row
 * action menus so the two always offer the same copy, comment, and refusal handling.
 *
 * A refusal keeps the dialog open with the typed comment intact — `event.preventDefault()` on the
 * confirm action is what stops the dialog primitive from closing on click — so the administrator
 * can correct and resubmit without reopening the record.
 */
export function ResourceLifecycleDialog<TResult>({
  action,
  config,
  onClose,
}: {
  action: LifecycleAction | null
  config: ResourceLifecycleConfig<TResult>
  onClose: () => void
}) {
  const commentId = useId()
  const [comment, setComment] = useState('')

  const close = () => {
    setComment('')
    onClose()
  }

  const submit = async (lifecycleAction: LifecycleAction) => {
    try {
      const result = await config.submit(lifecycleAction, { comment: comment || null })

      close()
      toast.success(
        config.describeSuccess?.(lifecycleAction, result) ??
          lifecycleSuccessMessage(lifecycleAction, config.singular, config.name),
      )
    } catch (cause) {
      // A refusal may mean the record's authoritative state has moved on since this view loaded,
      // so the list is refreshed on the failure path too, not only on the success path.
      void config.refresh()

      const error = parseApiError(cause)

      toast.error(lifecycleFailureTitle(lifecycleAction, config.singular, config.name), {
        // A validation failure's top-level message is only "Validation failure"; the field-level
        // detail is what tells the administrator what to fix.
        description: error.details?.[0]?.message ?? error.message,
      })
    }
  }

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action ? lifecycleDialogTitle(action, config.singular) : ''}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action
              ? (config.describeEffect?.(action) ?? describeLifecycleEffect(action, config.name))
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={commentId}>{LIFECYCLE_COMMENT_LABEL}</FieldLabel>
            <Textarea
              id={commentId}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
            <FieldDescription>{LIFECYCLE_COMMENT_DESCRIPTION}</FieldDescription>
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={config.isPending}
            onClick={(event) => {
              event.preventDefault()
              if (action) {
                void submit(action)
              }
            }}
          >
            {action
              ? config.isPending
                ? LIFECYCLE_PENDING_LABELS[action]
                : LIFECYCLE_ACTION_LABELS[action]
              : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The detail-pane footer: one button per action the record's current status allows, plus the
 * confirmation they all share.
 */
export function ResourceLifecycleActions<TResult>({
  actions,
  className,
  config,
}: {
  actions: LifecycleAction[]
  className?: string
  config: ResourceLifecycleConfig<TResult>
}) {
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)

  if (actions.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            onClick={() => setOpenAction(action)}
            type="button"
            variant={ACTION_VARIANTS[action]}
          >
            {LIFECYCLE_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      <ResourceLifecycleDialog
        action={openAction}
        config={config}
        onClose={() => setOpenAction(null)}
      />
    </div>
  )
}
