import { EllipsisVerticalIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIFECYCLE_ACTION_LABELS, type LifecycleAction } from './lifecycle-copy'

type ResourceRowActionsProps = {
  /** Whether editing is offered for this record's current status, gated as the detail pane gates it. */
  editable?: boolean
  /** The record's own display name, which names the trigger for screen readers. */
  name: string
  onEdit?: () => void
  onView?: () => void
} & (
  | {
      /**
       * A resource whose lifecycle slices are not delivered yet offers no transition, and so has no
       * confirmation to build. Requiring a callback that can never fire would state the opposite of
       * what is true.
       */
      actions: readonly []
      renderDialog?: never
    }
  | {
      /** The lifecycle actions this record's current status allows. */
      actions: LifecycleAction[]
      /**
       * Builds the confirmation for the chosen action. It is a callback rather than an element so
       * the feature's mutation hooks run inside the dialog and only while one is open: a directory
       * can list thousands of rows, and an idle row must not carry a mutation observer per
       * lifecycle action.
       *
       * Mandatory alongside offered actions: a menu entry that opens nothing would leave the row
       * looking frozen, with nothing to say why.
       */
      renderDialog: (props: { action: LifecycleAction; onClose: () => void }) => ReactNode
    }
)

/**
 * Per-row administration menu, so consulting, correcting, or moving a record through its lifecycle
 * does not require opening the detail pane first. It offers the same actions, under the same status
 * rules and with the same confirmation, as the detail-pane footer.
 */
export function ResourceRowActions({
  actions,
  editable = false,
  name,
  onEdit,
  onView,
  renderDialog,
}: ResourceRowActionsProps) {
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)
  const canEdit = editable && onEdit !== undefined

  // A menu with nothing in it is not rendered at all, rather than as an empty popup.
  if (onView === undefined && !canEdit && actions.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${name}`}
              className="mr-1 shrink-0"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onView && <DropdownMenuItem onClick={onView}>View</DropdownMenuItem>}
          {canEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
          {actions.map((action) => (
            <DropdownMenuItem
              key={action}
              onClick={() => setOpenAction(action)}
              variant={action === 'archive' ? 'destructive' : 'default'}
            >
              {LIFECYCLE_ACTION_LABELS[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* The optional call is a formality: `openAction` can only come from an offered action, and
          those arrive with the callback that confirms them. */}
      {openAction && renderDialog?.({ action: openAction, onClose: () => setOpenAction(null) })}
    </>
  )
}
