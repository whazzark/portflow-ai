import { EllipsisVerticalIcon } from 'lucide-react'
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
import { TransportCompanyLifecycleDialog } from '@/features/transport-companies/transport-company-lifecycle'
import type { FleetGroup } from '@/features/transport-resources/helpers/fleet-view'

export function archiveBlockedReason(availableTrucks: number) {
  return `Still provides ${availableTrucks} available ${availableTrucks === 1 ? 'truck' : 'trucks'}`
}

/**
 * A company's administration from its group header. Archive stays listed while the company still
 * provides available trucks — disabled, with the reason — so the administrator learns what to do
 * rather than wondering where it went.
 */
export function CompanyGroupActions({
  group,
  onViewDetails,
  onEdit,
  onAddTruck,
}: {
  group: FleetGroup
  onViewDetails: () => void
  onEdit: () => void
  onAddTruck: () => void
}) {
  const { company, archiveBlockedBy } = group
  const archived = company.status === 'ARCHIVED'
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)

  return (
    <>
      {archived && (
        <Button onClick={() => setOpenAction('reactivate')} size="sm" variant="outline">
          Reactivate
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${company.name}`}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={onViewDetails}>View details</DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem onClick={() => setOpenAction('reactivate')}>
              Reactivate
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onAddTruck}>Add truck</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex-col items-start gap-0.5 data-disabled:opacity-100"
                disabled={archiveBlockedBy > 0}
                onClick={() => setOpenAction('archive')}
                variant="destructive"
              >
                <span className={archiveBlockedBy > 0 ? 'text-muted-foreground' : undefined}>
                  Archive
                </span>
                {archiveBlockedBy > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {archiveBlockedReason(archiveBlockedBy)}
                  </span>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {openAction && (
        <TransportCompanyLifecycleDialog
          action={openAction}
          company={company}
          onClose={() => setOpenAction(null)}
        />
      )}
    </>
  )
}
