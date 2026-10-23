import { ArchiveIcon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'

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

/** What keeps a lot of a planned discharge from starting on its doors, as its row shows it. */
export type LotDoorRowProblems = {
  noDoor: boolean
  /** The lot's doors an active discharge holds, each with the holder's vessel. */
  heldBy: ReadonlyMap<string, string>
}

/** A door problem in words, so it reads without its amber tone. */
function WarningText({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-warning">
      <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  )
}

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

/** Every door the lot holds, once the chips leave some out, each still saying who holds it. */
function MoreDoorsPopover({
  doors,
  heldBy,
  hidden,
}: {
  doors: DoorAssignment[]
  heldBy?: ReadonlyMap<string, string>
  hidden: number
}) {
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
            {doors.map((assignment) => {
              const holder = heldBy?.get(assignment.warehouseDoor.id)

              return (
                <li key={assignment.id}>
                  <DoorReference assignment={assignment} />
                  {holder && <span className="block text-warning text-xs">Held by {holder}</span>}
                </li>
              )
            })}
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
  problems,
}: {
  lot: ProductLot
  dischargeStatus: DischargeStatus
  /** On a planned discharge, the lot's door problems; each is said in words, not by color only. */
  problems?: LotDoorRowProblems
}) {
  const cell = lotDoorCell(lot.doorAssignments, dischargeStatus)

  return (
    // One wrapping line: the chips, then the notice or the history link beside them.
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {cell.doors.length > 0 ? (
        <ul aria-label="Warehouse doors" className="flex flex-wrap items-center gap-1">
          {cell.shown.map((assignment) => {
            const holder = problems?.heldBy.get(assignment.warehouseDoor.id)

            return (
              <li className="inline-flex flex-wrap items-center gap-x-1.5" key={assignment.id}>
                <DoorChip assignment={assignment} />
                {holder && <WarningText>Held by {holder}</WarningText>}
              </li>
            )
          })}
          {cell.hidden.length > 0 && (
            <MoreDoorsPopover
              doors={cell.doors}
              heldBy={problems?.heldBy}
              hidden={cell.hidden.length}
            />
          )}
        </ul>
      ) : problems?.noDoor ? (
        // On a planned discharge a lot without a door keeps it from starting: said, not hinted.
        <WarningText>No door</WarningText>
      ) : lot.doorAssignments.length === 0 ? (
        // Elsewhere no door is a quiet dash, said in words to assistive technologies.
        <span className="text-muted-foreground">
          <span aria-hidden="true">—</span>
          <span className="sr-only">No warehouse door assigned</span>
        </span>
      ) : null}
      {/* A held door behind +N is still said on the row: the problem never needs the popover. */}
      {cell.hidden.map((assignment) => {
        const holder = problems?.heldBy.get(assignment.warehouseDoor.id)

        return holder ? (
          <WarningText key={assignment.id}>
            {assignment.warehouseDoor.name} held by {holder}
          </WarningText>
        ) : null
      })}
      {!problems?.noDoor && lotDoorNotice(lot, dischargeStatus) === 'NONE_CURRENTLY_ASSIGNED' && (
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
