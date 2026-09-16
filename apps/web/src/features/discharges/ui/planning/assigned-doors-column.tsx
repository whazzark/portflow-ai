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
  REMOVE_FROM_SHIFT_FIRST,
  type TransferDoor,
} from '@/features/discharges/ui/planning/door-transfer-row'

type ProductLot = DischargeDetailDto['productLots'][number]

type AssignedDoorsColumnProps = {
  discharge: DischargeDetailDto
  lot: ProductLot
  /** In the order they were chosen, so a door added lands last and nothing listed moves. */
  doors: TransferDoor[]
  heldIds: ReadonlySet<string>
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
        const { holder } = offeredDoorRowState(discharge, lot, door.id, chosen)
        const refusal = refusals.get(door.id)
        const notes = (
          [
            // Said with the row, since a locked door has no button to carry it.
            locked ? { text: REMOVE_FROM_SHIFT_FIRST, tone: 'hidden' } : null,
            !held && holder ? { text: `Moves from ${lotLabel(holder)}`, tone: 'warning' } : null,
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
            shifts={locked ? heldDoorRowState(discharge, door.id, chosen).shifts : []}
          />
        )
      })}
    </ul>
  )
}
