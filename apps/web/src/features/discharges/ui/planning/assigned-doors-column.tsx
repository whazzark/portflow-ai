import { Badge } from '@/components/ui/badge'
import {
  heldDoorRowState,
  lotLabel,
  offeredDoorRowState,
} from '@/features/discharges/discharge-planning-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DoorHoldings, doorHoldingHints } from '@/features/discharges/ui/planning/door-holdings'
import {
  type DoorNote,
  DoorTransferRow,
  removeFromShiftsFirst,
  type TransferDoor,
} from '@/features/discharges/ui/planning/door-transfer-row'

type ProductLot = DischargeDetailDto['productLots'][number]

type AssignedDoorsColumnProps = {
  discharge: DischargeDetailDto
  lot: ProductLot
  /** In the order they were chosen, so a door added lands last and nothing listed moves. */
  doors: TransferDoor[]
  heldIds: ReadonlySet<string>
  /** The lot's doors an active discharge holds, each with the holder's vessel. */
  heldBy?: ReadonlyMap<string, string>
  chosen: ReadonlySet<string>
  refusals: ReadonlyMap<string, string>
  /** Where the focus goes once the last removable door has left. */
  headingId: string
  actionId: (doorId: string) => string
  onRemove: (doorId: string, focusId: string) => void
}

/** The doors the lot will hold once saved: those it keeps, then those it takes. */
export function AssignedDoorsColumn({
  actionId,
  chosen,
  discharge,
  doors,
  headingId,
  heldBy,
  heldIds,
  lot,
  onRemove,
  refusals,
}: AssignedDoorsColumnProps) {
  if (doors.length === 0) {
    return <p className="text-muted-foreground text-sm">No door assigned yet</p>
  }

  const lockedIds = new Set(
    doors
      .filter(
        (door) =>
          heldIds.has(door.id) && heldDoorRowState(discharge, door.id, chosen).shifts.length > 0,
      )
      .map((door) => door.id),
  )
  const removable = doors.filter((door) => !lockedIds.has(door.id)).map((door) => door.id)

  const remove = (doorId: string) => {
    const at = removable.indexOf(doorId)
    const neighbour = removable[at + 1] ?? removable[at - 1]
    onRemove(doorId, neighbour ? actionId(neighbour) : headingId)
  }

  return (
    <ul aria-labelledby={headingId} className="divide-y rounded-lg border">
      {doors.map((door) => {
        const held = heldIds.has(door.id)
        const locked = lockedIds.has(door.id)
        const shifts = locked ? heldDoorRowState(discharge, door.id, chosen).shifts : []
        const holder = heldBy?.get(door.id)
        const { holder: lotHolder } = offeredDoorRowState(discharge, lot, door.id, chosen)
        const refusal = refusals.get(door.id)
        const notes = (
          [
            held && holder
              ? {
                  text: `Held by ${holder} (Active). It blocks this discharge's start until ${holder} releases it.`,
                  tone: 'warning',
                }
              : null,
            // Said with the row, since a locked door has no button to carry it.
            locked ? { text: removeFromShiftsFirst(shifts.length), tone: 'muted' } : null,
            !held && lotHolder
              ? { text: `Moves from ${lotLabel(lotHolder)}`, tone: 'warning' }
              : null,
            refusal ? { text: refusal, tone: 'destructive' } : null,
            ...doorHoldingHints(door.otherDischargeAssignments).map(
              (hint): DoorNote => ({ text: hint.text, tone: 'hidden' }),
            ),
          ] satisfies Array<DoorNote | null>
        ).filter((note) => note !== null)

        return (
          <DoorTransferRow
            action={
              locked
                ? undefined
                : { id: actionId(door.id), label: 'Remove', onClick: () => remove(door.id) }
            }
            adornments={
              <>
                {!held && <Badge variant="secondary">New</Badge>}
                {(door.archived || (!door.canCheck && !held)) && (
                  <Badge variant="outline">Archived</Badge>
                )}
                <DoorHoldings assignments={door.otherDischargeAssignments} />
              </>
            }
            key={door.id}
            name={`${door.warehouse.name} › ${door.name}`}
            notes={notes}
            shifts={shifts}
          />
        )
      })}
    </ul>
  )
}
