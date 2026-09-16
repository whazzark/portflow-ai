import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { InputSearch } from '@/components/ui/input-search'
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

type AvailableDoorsColumnProps = {
  discharge: DischargeDetailDto
  lot: ProductLot
  groups: Array<{ warehouse: TransferDoor['warehouse']; doors: TransferDoor[] }>
  /** The doors the lot held when the dialog opened: one listed here is being let go of. */
  heldIds: ReadonlySet<string>
  chosen: ReadonlySet<string>
  refusals: ReadonlyMap<string, string>
  searchId: string
  actionId: (doorId: string) => string
  /** Moves a door to the lot, then hands the focus to `focusId`. */
  onAdd: (doorId: string, focusId: string) => void
}

function matches(query: string, ...labels: string[]) {
  const needle = query.trim().toLocaleLowerCase()

  return !needle || labels.some((label) => label.toLocaleLowerCase().includes(needle))
}

/** The doors the lot does not take, by warehouse, searchable; only this column is ever searched. */
export function AvailableDoorsColumn({
  actionId,
  chosen,
  discharge,
  groups,
  heldIds,
  lot,
  onAdd,
  refusals,
  searchId,
}: AvailableDoorsColumnProps) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const visible = groups
    .map((group) => ({
      ...group,
      doors: group.doors.filter((door) => matches(query, door.name, group.warehouse.name)),
    }))
    .filter((group) => group.doors.length > 0)
  const actionable = visible.flatMap((group) =>
    group.doors.filter((door) => door.canCheck || heldIds.has(door.id)).map((door) => door.id),
  )

  // The next door down takes the focus, or the one above the last, or the search once none is left.
  const add = (doorId: string) => {
    const at = actionable.indexOf(doorId)
    const neighbour = actionable[at + 1] ?? actionable[at - 1]
    onAdd(doorId, neighbour ? actionId(neighbour) : searchId)
  }

  return (
    <div className="grid content-start gap-3">
      <InputSearch
        id={searchId}
        label="Search doors"
        onValueChange={setQuery}
        placeholder="Search doors"
        value={query}
      />
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">No other warehouse door is available</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">No door matches “{query.trim()}”</p>
      ) : (
        visible.map((group) => (
          <div className="grid gap-1" key={group.warehouse.id}>
            <h4
              className="font-medium text-muted-foreground text-xs"
              id={`${listId}-${group.warehouse.id}`}
            >
              {group.warehouse.name}
            </h4>
            <ul
              aria-labelledby={`${listId}-${group.warehouse.id}`}
              className="divide-y rounded-lg border"
            >
              {group.doors.map((door) => {
                const held = heldIds.has(door.id)
                const { shifts } = heldDoorRowState(discharge, door.id, chosen)
                const { holder } = offeredDoorRowState(discharge, lot, door.id, chosen)
                const locked = held && shifts.length > 0
                const refusal = refusals.get(door.id)
                const notes = (
                  [
                    held && !locked ? { text: 'Will be removed', tone: 'muted' } : null,
                    // A shift took the door after it was let go of: the save is refused until it is back.
                    locked ? { text: REMOVE_FROM_SHIFT_FIRST, tone: 'destructive' } : null,
                    !held && holder ? { text: `Held by ${lotLabel(holder)}`, tone: 'muted' } : null,
                    refusal ? { text: refusal, tone: 'destructive' } : null,
                    ...doorHoldingHints(door.otherDischargeAssignments).map(
                      (hint): DoorNote => ({ text: hint.text, tone: 'hidden' }),
                    ),
                  ] satisfies Array<DoorNote | null>
                ).filter((note) => note !== null)

                return (
                  <DoorTransferRow
                    action={
                      // Taking a door back the lot held is keeping it, even once it is archived.
                      door.canCheck || held
                        ? { id: actionId(door.id), label: 'Add', onClick: () => add(door.id) }
                        : undefined
                    }
                    adornments={
                      <>
                        {(door.archived || (!door.canCheck && !held)) && (
                          <Badge variant="outline">Archived</Badge>
                        )}
                        <DoorHoldings assignments={door.otherDischargeAssignments} />
                      </>
                    }
                    key={door.id}
                    name={door.name}
                    notes={notes}
                    shifts={locked ? shifts : []}
                  />
                )
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
