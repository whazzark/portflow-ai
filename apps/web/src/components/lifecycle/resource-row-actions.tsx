import { EllipsisVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIFECYCLE_ACTION_LABELS, type LifecycleAction } from './lifecycle-copy'
import { type ResourceLifecycleConfig, ResourceLifecycleDialog } from './resource-lifecycle-actions'

/**
 * Per-row administration menu, so consulting, correcting, or moving a record through its lifecycle
 * does not require opening the detail pane first. It offers the same actions, under the same status
 * rules and with the same confirmation, as the detail-pane footer.
 */
export function ResourceRowActions<TResult>({
  actions,
  config,
  editable = false,
  onEdit,
  onView,
}: {
  /** The lifecycle actions this record's current status allows. */
  actions: LifecycleAction[]
  config: ResourceLifecycleConfig<TResult>
  /** Whether editing is offered for this record's current status, gated as the detail pane gates it. */
  editable?: boolean
  onEdit?: () => void
  onView?: () => void
}) {
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
              aria-label={`Actions for ${config.name}`}
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
      {/*
        Mounted only while a confirmation is open: a directory can list thousands of rows, and each
        dialog carries its own mutation hooks.
      */}
      {openAction && (
        <ResourceLifecycleDialog
          action={openAction}
          config={config}
          onClose={() => setOpenAction(null)}
        />
      )}
    </>
  )
}
