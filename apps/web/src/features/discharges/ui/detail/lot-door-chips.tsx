import { ArchiveIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { lotDoorCell, lotDoorNotice } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { EffectivePeriod } from '@/features/discharges/ui/detail/effective-period'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { classnames } from '@/libraries/shadcn/helpers'

type ProductLot = DischargeDetailDto['productLots'][number]
type DoorAssignment = ProductLot['doorAssignments'][number]
type DischargeStatus = DischargeDetailDto['status']

const isArchived = (assignment: DoorAssignment) =>
  assignment.warehouseDoor.status === 'ARCHIVED' || assignment.warehouse.status === 'ARCHIVED'

const fullName = (assignment: DoorAssignment) =>
  `${assignment.warehouse.name} › ${assignment.warehouseDoor.name}`

/** A door by its own name; its warehouse is read with it and shown on hover. */
function DoorChip({ assignment }: { assignment: DoorAssignment }) {
  const archived = isArchived(assignment)

  return (
    <Badge
      className="max-w-48"
      title={archived ? `${fullName(assignment)} (Archived)` : fullName(assignment)}
      variant="outline"
    >
      <span className="sr-only">{assignment.warehouse.name} › </span>
      <span className="truncate">{assignment.warehouseDoor.name}</span>
      {archived && (
        <>
          <ArchiveIcon aria-hidden="true" className="text-muted-foreground" />
          <span className="sr-only"> (Archived)</span>
        </>
      )}
    </Badge>
  )
}

function DoorReference({ assignment }: { assignment: DoorAssignment }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <ReferenceLabel name={assignment.warehouse.name} status={assignment.warehouse.status} />
      {' › '}
      <ReferenceLabel
        name={assignment.warehouseDoor.name}
        status={assignment.warehouseDoor.status}
      />
    </span>
  )
}

/** Every door the lot holds, once the chips leave some out. */
function MoreDoorsPopover({ doors, hidden }: { doors: DoorAssignment[]; hidden: number }) {
  return (
    <li>
      <Popover>
        <PopoverTrigger
          aria-label={`Show ${hidden} more warehouse ${hidden === 1 ? 'door' : 'doors'}`}
          className={classnames(
            buttonVariants({ size: 'xs', variant: 'secondary' }),
            'tabular-nums',
          )}
        >
          +{hidden}
        </PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Warehouse doors</PopoverTitle>
          <ul className="grid gap-1">
            {doors.map((assignment) => (
              <li key={assignment.id}>
                <DoorReference assignment={assignment} />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </li>
  )
}

/** The assignments that are over, kept out of the row but a click away. */
function HistoryPopover({
  dischargeStatus,
  history,
  label,
}: {
  dischargeStatus: DischargeStatus
  history: DoorAssignment[]
  label: 'ended' | 'history'
}) {
  return (
    <Popover>
      <PopoverTrigger className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground">
        {label === 'history' ? 'History' : `${history.length} ended`}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>{label === 'history' ? 'Door history' : 'Ended assignments'}</PopoverTitle>
        <ul className="grid gap-2">
          {history.map((assignment) => (
            <li className="grid gap-0.5" key={assignment.id}>
              <DoorReference assignment={assignment} />
              <EffectivePeriod dischargeStatus={dischargeStatus} period={assignment} />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/**
 * A lot's warehouse doors in one table cell: its doors as chips on one line, the rest behind `+N`,
 * and its ended assignments behind a link, so a lot with many doors keeps a row of normal height.
 */
export function LotDoorChips({
  dischargeStatus,
  lot,
}: {
  lot: ProductLot
  dischargeStatus: DischargeStatus
}) {
  const cell = lotDoorCell(lot.doorAssignments, dischargeStatus)

  return (
    // One wrapping line: the chips, then the notice or the history link beside them.
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {cell.doors.length > 0 ? (
        <ul aria-label="Warehouse doors" className="flex flex-wrap items-center gap-1">
          {cell.shown.map((assignment) => (
            <li key={assignment.id}>
              <DoorChip assignment={assignment} />
            </li>
          ))}
          {cell.hidden.length > 0 && (
            <MoreDoorsPopover doors={cell.doors} hidden={cell.hidden.length} />
          )}
        </ul>
      ) : lot.doorAssignments.length === 0 ? (
        // No door yet is the usual state of a lot being prepared: a quiet dash, said in words to
        // assistive technologies.
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">No warehouse door assigned</span>
        </span>
      ) : null}
      {lotDoorNotice(lot, dischargeStatus) === 'NONE_CURRENTLY_ASSIGNED' && (
        <p className="text-muted-foreground text-xs">No warehouse door currently assigned</p>
      )}
      {cell.history.length > 0 && (
        <HistoryPopover
          dischargeStatus={dischargeStatus}
          history={cell.history}
          label={cell.historyLabel}
        />
      )}
    </div>
  )
}
