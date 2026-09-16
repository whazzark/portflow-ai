import { isInEffect } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

type ProductLot = DischargeDetailDto['productLots'][number]
type PlanningShift = DischargeDetailDto['shifts'][number]

/**
 * Planning is only ever offered on a planned discharge, so "current" reads the same as the detail's
 * "in effect" there. The rule itself stays `isInEffect`'s, never a second copy of it.
 */
const current = (period: { effectiveTo: string | null }) => isInEffect(period, 'PLANNED')

/** The doors currently assigned to a lot. */
export function currentDoorIds(lot: Pick<ProductLot, 'doorAssignments'>) {
  return lot.doorAssignments.filter(current).map((assignment) => assignment.warehouseDoor.id)
}

/** The lot a door is currently assigned to within the discharge, if any. */
export function lotHoldingDoor(detail: Pick<DischargeDetailDto, 'productLots'>, doorId: string) {
  return detail.productLots.find((lot) => currentDoorIds(lot).includes(doorId)) ?? null
}

/** The planned shifts that currently have the door selected. */
export function plannedShiftsSelectingDoor(
  detail: Pick<DischargeDetailDto, 'shifts'>,
  doorId: string,
) {
  return detail.shifts.filter(
    (shift) =>
      shift.status === 'PLANNED' &&
      shift.warehouseDoors.some(
        (selection) => current(selection) && selection.warehouseDoor.id === doorId,
      ),
  )
}

/** What a lot's save changes: checked doors it does not hold, and held doors left unchecked. */
export function lotDoorChangeSet(lot: Pick<ProductLot, 'doorAssignments'>, chosenIds: string[]) {
  const held = currentDoorIds(lot)

  return {
    assign: chosenIds.filter((id) => !held.includes(id)),
    withdraw: held.filter((id) => !chosenIds.includes(id)),
  }
}

/**
 * The doors a save took from another lot, read from the API's answer rather than the page's
 * earlier state: another lot's assignment of the door that ended at the very instant this lot's
 * began. A colleague may have moved the door in between, and only the answer knows.
 */
export function movedDoors(
  response: Pick<DischargeDetailDto, 'productLots'>,
  lotId: string,
  assignedIds: string[],
) {
  const lot = response.productLots.find((candidate) => candidate.id === lotId)

  return assignedIds.flatMap((doorId) => {
    const started = lot?.doorAssignments.find(
      (period) => current(period) && period.warehouseDoor.id === doorId,
    )
    const fromLot = response.productLots.find(
      (candidate) =>
        candidate.id !== lotId &&
        candidate.doorAssignments.some(
          (period) =>
            period.warehouseDoor.id === doorId &&
            period.effectiveTo !== null &&
            period.effectiveTo === started?.effectiveFrom,
        ),
    )

    return fromLot ? [{ doorId, fromLot }] : []
  })
}

/** How a lot is named wherever planning refers to it. */
export function lotLabel(lot: Pick<ProductLot, 'customer' | 'productName'>) {
  return `${lot.customer.name} · ${lot.productName}`
}

/**
 * The lots a save would take a door from, read from the choices rather than from the answer as
 * `movedDoors` does. A door belongs to one lot of a discharge at a time, so checking one another
 * lot holds moves it; saying so before the request is what keeps that silent.
 */
export function movesPending(
  detail: Pick<DischargeDetailDto, 'productLots'>,
  lot: Pick<ProductLot, 'id' | 'doorAssignments'>,
  chosenIds: string[],
) {
  return lotDoorChangeSet(lot, chosenIds).assign.flatMap((doorId) => {
    const holder = lotHoldingDoor(detail, doorId)

    return holder && holder.id !== lot.id ? [{ doorId, fromLot: holder }] : []
  })
}

/**
 * The planned shifts still using each door the choices let go of, keyed by door. Mirrors the API's
 * `selectedByPlannedShift`, so a removal the server would refuse is held back on the page first.
 */
export function lockedRemovals(
  detail: Pick<DischargeDetailDto, 'shifts'>,
  lot: Pick<ProductLot, 'doorAssignments'>,
  chosenIds: string[],
) {
  const locked = new Map<string, PlanningShift[]>()

  for (const doorId of lotDoorChangeSet(lot, chosenIds).withdraw) {
    const shifts = plannedShiftsSelectingDoor(detail, doorId)

    if (shifts.length > 0) {
      locked.set(doorId, shifts)
    }
  }

  return locked
}

/**
 * What a door the lot holds says in the sheet: whether the choices let it go, and the planned
 * shifts that keep it — a lock on a door still held, a refusal on one already let go of.
 */
export function heldDoorRowState(
  detail: Pick<DischargeDetailDto, 'shifts'>,
  doorId: string,
  chosen: ReadonlySet<string>,
) {
  return { removing: !chosen.has(doorId), shifts: plannedShiftsSelectingDoor(detail, doorId) }
}

/**
 * What a door the lot does not hold says in the sheet: the other lot holding it, and whether the
 * choices take it from that lot.
 */
export function offeredDoorRowState(
  detail: Pick<DischargeDetailDto, 'productLots'>,
  lot: Pick<ProductLot, 'id'>,
  doorId: string,
  chosen: ReadonlySet<string>,
) {
  const found = lotHoldingDoor(detail, doorId)
  const holder = found && found.id !== lot.id ? found : null

  return { holder, moving: holder !== null && chosen.has(doorId) }
}

/**
 * A save's changes by door name: doors newly taken, doors let go of, and doors taken from another
 * lot, apart, since those are the ones that change another lot too.
 */
export function lotDoorChangeSummary(
  detail: Pick<DischargeDetailDto, 'productLots'>,
  lot: Pick<ProductLot, 'id' | 'doorAssignments'>,
  chosenIds: string[],
  nameOf: (doorId: string) => string,
) {
  const changes = lotDoorChangeSet(lot, chosenIds)
  const moves = movesPending(detail, lot, chosenIds)
  const moving = new Set(moves.map((move) => move.doorId))

  return {
    adds: changes.assign.filter((id) => !moving.has(id)).map(nameOf),
    removes: changes.withdraw.map(nameOf),
    moves: moves.map((move) => ({ door: nameOf(move.doorId), fromLot: move.fromLot })),
  }
}

type DoorOfColumns = { id: string; name: string; warehouse: { id: string; name: string } }

/**
 * A lot's doors as the transfer dialog lays them out. `Assigned` follows the choices' own order —
 * the doors held, then each one added at the end — so adding never moves a row already listed.
 * `Available` is every other known door, back in its warehouse, by warehouse then door name.
 */
export function lotDoorColumns<Door extends DoorOfColumns>(known: Door[], chosenIds: string[]) {
  const byId = new Map(known.map((door) => [door.id, door]))
  const chosen = new Set(chosenIds)
  const groups = new Map<string, { warehouse: Door['warehouse']; doors: Door[] }>()
  const unchosen = [...byId.values()]
    .filter((door) => !chosen.has(door.id))
    .sort(
      (a, b) => a.warehouse.name.localeCompare(b.warehouse.name) || a.name.localeCompare(b.name),
    )

  for (const door of unchosen) {
    const group = groups.get(door.warehouse.id) ?? {
      warehouse: door.warehouse,
      doors: [] as Door[],
    }
    group.doors.push(door)
    groups.set(door.warehouse.id, group)
  }

  return {
    assigned: chosenIds.flatMap((id) => byId.get(id) ?? []),
    available: [...groups.values()],
  }
}

/**
 * The doors a shift may select: those a lot of its discharge currently holds, as the API requires,
 * each with the lot holding it. Only an available door of an available warehouse can be newly
 * chosen. Listed lot by lot, in the detail's order, then by warehouse and door.
 */
export function shiftDoorOptions(detail: Pick<DischargeDetailDto, 'productLots'>) {
  return detail.productLots.flatMap((lot) =>
    lot.doorAssignments
      .filter(current)
      .map((assignment) => ({
        id: assignment.warehouseDoor.id,
        name: `${assignment.warehouse.name} › ${assignment.warehouseDoor.name}`,
        warehouse: assignment.warehouse,
        warehouseDoor: assignment.warehouseDoor,
        lot,
        canCheck:
          assignment.warehouseDoor.status === 'AVAILABLE' &&
          assignment.warehouse.status === 'AVAILABLE',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export type DescribedIssue = {
  /** The change set list the refusal points into, such as `assign` or `weighingAreas.add`. */
  list: string
  /** The identity at that position, or `null` when the refusal names no position. */
  id: string | null
  /** The API's wording alone, for a place that already names what it refuses. */
  message: string
  text: string
}

/**
 * The API reports a refused choice by its position in the change set that was sent, such as
 * `assign.1`. The page names it instead, by the label of the identity at that position.
 */
export function describeIssues(
  details: Array<{ field: string; message: string }>,
  changeSet: object,
  labelOf: (id: string) => string,
): DescribedIssue[] {
  return details.map(({ field, message }) => {
    const match = /^(.*)\.(\d+)$/.exec(field)
    const list = match ? match[1] : field
    const values = list
      .split('.')
      .reduce<unknown>(
        (node, key) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
        changeSet,
      )
    const id =
      match && Array.isArray(values) ? (values[Number(match[2])] as string | undefined) : undefined

    return id
      ? { list, id, message, text: `${labelOf(id)}: ${message}` }
      : { list, id: null, message, text: message }
  })
}
