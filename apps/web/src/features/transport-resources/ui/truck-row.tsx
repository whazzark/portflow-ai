import type { ReactNode } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'
import type { FleetTruck } from '@/features/transport-resources/helpers/fleet-view'
import { TruckRegistration, TruckStatusPill } from '@/features/trucks/ui/truck-status-pill'
import { formatFullName } from '@/features/users/helpers/name'
import { formatDate } from '@/helpers/dates'

const capacity = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 })

/** "comment · actor, date" — the actor only where the collection read carries one. */
export function LifecycleContextCell({
  comment,
  actor,
  at,
  quoted = false,
}: {
  comment: string | null
  actor?: { firstName: string; lastName: string } | null
  at: string | null
  quoted?: boolean
}) {
  if (!at) {
    return <span className="text-muted-foreground">—</span>
  }

  const by = [actor ? formatFullName(actor) : null, formatDate(at)].filter(Boolean).join(', ')

  return (
    <span className="inline-flex max-w-[28rem] items-baseline gap-1 truncate">
      {comment && <span className="truncate">{quoted ? `“${comment}”` : comment}</span>}
      <span className="shrink-0 text-muted-foreground">{comment ? `· ${by}` : by}</span>
    </span>
  )
}

function lifecycleContext(fleetTruck: FleetTruck) {
  const { truck, status } = fleetTruck

  if (status === 'suspended') {
    return (
      <LifecycleContextCell
        actor={truck.suspendedBy}
        at={truck.suspendedAt}
        comment={truck.suspensionComment}
      />
    )
  }

  if (status === 'archived') {
    return (
      <LifecycleContextCell
        actor={truck.archivedBy}
        at={truck.archivedAt}
        comment={truck.archiveComment}
        quoted={true}
      />
    )
  }

  return <span className="text-muted-foreground">—</span>
}

/** Where focus goes back when the truck's detail closes. */
export function truckViewButtonId(truckId: string) {
  return `truck-view-${truckId}`
}

export function TruckRow({
  fleetTruck,
  expanded = false,
  onView,
  actions,
}: {
  fleetTruck: FleetTruck
  expanded?: boolean
  onView: () => void
  /** The administrator's row actions; absent in read-only mode. */
  actions?: ReactNode
}) {
  const { truck } = fleetTruck

  return (
    <TableRow className="h-[52px] border-t border-b-0 hover:bg-muted/30">
      <TableCell className="pr-3.5 pl-12">
        <button
          aria-expanded={expanded}
          aria-label={`View truck ${truck.registration}`}
          id={truckViewButtonId(truck.id)}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onView}
          type="button"
        >
          <TruckRegistration registration={truck.registration} />
        </button>
      </TableCell>
      <TableCell className="px-3.5">
        {truck.vehicleModel ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="px-3.5 tabular-nums">
        {capacity.format(truck.capacityTonnes)} t
      </TableCell>
      <TableCell className="px-3.5">{lifecycleContext(fleetTruck)}</TableCell>
      <TableCell className="px-3.5">
        <TruckStatusPill status={truck.status} />
      </TableCell>
      <TableCell className="pr-2.5 pl-3.5">
        <div className="flex items-center justify-end gap-1">{actions}</div>
      </TableCell>
    </TableRow>
  )
}
