import { EllipsisVerticalIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TruckDto } from '@/features/trucks/types'
import {
  TRUCK_LIFECYCLE_COPY,
  type TruckLifecycleAction,
  TruckLifecycleDialog,
  truckLifecycleActions,
} from '@/features/trucks/ui/truck-lifecycle-actions'

type TruckRowActionsProps = {
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  truck: TruckDto
}

/**
 * Per-row administration menu, so correcting or moving a truck through its lifecycle does not
 * require opening the detail pane first. It offers the same actions, under the same status rules,
 * as the detail-pane footer.
 */
export function TruckRowActions({ onEdit, onView, truck }: TruckRowActionsProps) {
  const [openAction, setOpenAction] = useState<TruckLifecycleAction | null>(null)
  const actions = truckLifecycleActions(truck.status)
  // Editing is refused for anything but an available truck, exactly as the detail pane gates it.
  const editable = onEdit !== undefined && truck.status === 'AVAILABLE'

  // Defensive: with the return to service delivered, every status yields at least one action, so
  // this cannot fire for any caller today. It stays as a guard against rendering an empty menu if a
  // future caller withholds `onView` for a status that has no action of its own.
  if (onView === undefined && !editable && actions.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${truck.registration}`}
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
          {onView && <DropdownMenuItem onClick={() => onView(truck.id)}>View</DropdownMenuItem>}
          {editable && <DropdownMenuItem onClick={() => onEdit?.(truck.id)}>Edit</DropdownMenuItem>}
          {actions.map((action) => (
            <DropdownMenuItem
              key={action}
              onClick={() => setOpenAction(action)}
              variant={action === 'archive' ? 'destructive' : 'default'}
            >
              {TRUCK_LIFECYCLE_COPY[action].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {/*
        Mounted only while a confirmation is open: a directory can list thousands of rows, and each
        dialog carries its own mutation hooks.
      */}
      {openAction && (
        <TruckLifecycleDialog
          action={openAction}
          onClose={() => setOpenAction(null)}
          truck={truck}
        />
      )}
    </>
  )
}
