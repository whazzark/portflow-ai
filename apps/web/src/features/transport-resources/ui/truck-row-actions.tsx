import { EllipsisVerticalIcon, RotateCcwIcon, WrenchIcon } from 'lucide-react'
import { useState } from 'react'

import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FleetTruck } from '@/features/transport-resources/helpers/fleet-view'
import { TruckLifecycleDialog } from '@/features/trucks/truck-lifecycle'

/**
 * A truck's administration from its row: the transition its status calls for most often sits
 * beside the menu — Return to service for a suspended truck, Reactivate for an archived one —
 * and the menu carries the rest, under the same status rules as the API.
 */
export function TruckRowActions({
  fleetTruck,
  onView,
  onEdit,
  disabled = false,
}: {
  fleetTruck: FleetTruck
  onView: () => void
  onEdit: () => void
  /** While another form is open, nothing else is started from here. */
  disabled?: boolean
}) {
  const { truck, status, canReactivate } = fleetTruck
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)

  return (
    <>
      {status === 'suspended' && (
        <Button
          aria-label={`Return ${truck.registration} to service`}
          disabled={disabled}
          onClick={() => setOpenAction('return-to-service')}
          size="icon-sm"
          title="Return to service"
          variant="ghost"
        >
          <WrenchIcon aria-hidden="true" />
        </Button>
      )}
      {status === 'archived' && (
        <Button
          aria-label={`Reactivate ${truck.registration}`}
          disabled={disabled || !canReactivate}
          onClick={() => setOpenAction('reactivate')}
          size="icon-sm"
          title={canReactivate ? 'Reactivate' : 'Reactivate its transport company first'}
          variant="ghost"
        >
          <RotateCcwIcon aria-hidden="true" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${truck.registration}`}
              disabled={disabled}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>View</DropdownMenuItem>
          {status === 'available' && (
            <>
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenAction('suspend')}>Suspend</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setOpenAction('archive')} variant="destructive">
                Archive
              </DropdownMenuItem>
            </>
          )}
          {status === 'suspended' && (
            <DropdownMenuItem onClick={() => setOpenAction('return-to-service')}>
              Return to service
            </DropdownMenuItem>
          )}
          {status === 'archived' && (
            <DropdownMenuItem disabled={!canReactivate} onClick={() => setOpenAction('reactivate')}>
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
