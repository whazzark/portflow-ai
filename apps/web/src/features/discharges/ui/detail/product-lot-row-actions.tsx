import { EllipsisVerticalIcon } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ProductLotRowActionsProps = {
  /** The lot as users know it, `Customer · Product`, which names the trigger. */
  name: string
  /** Why the lot cannot be removed, when it cannot. */
  removalBlocked: string | null
  onEdit: () => void
  onRemove: () => void
}

/**
 * A lot's menu. A lot that cannot be removed still lists Remove, disabled, with its reason in a
 * tooltip and tied to it: a disabled item stays focusable in the menu, so the reason is heard.
 */
export function ProductLotRowActions({
  name,
  removalBlocked,
  onEdit,
  onRemove,
}: ProductLotRowActionsProps) {
  const reasonId = useId()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label={`Actions for ${name}`} size="icon-sm" type="button" variant="ghost" />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        {removalBlocked ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuItem
                  aria-describedby={reasonId}
                  // Pointer events stay on so hovering the disabled item still opens its reason.
                  className="data-disabled:pointer-events-auto"
                  disabled={true}
                  variant="destructive"
                />
              }
            >
              Remove
              <span aria-hidden="true" className="sr-only" id={reasonId}>
                {removalBlocked}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">{removalBlocked}</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuItem onClick={onRemove} variant="destructive">
            Remove
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
