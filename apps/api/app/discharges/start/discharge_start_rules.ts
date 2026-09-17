import type {
  StartHolders,
  StartPlan,
  StartReferenceIds,
  StartReferences,
} from '#discharges/shared/repositories/discharge_start_repository'
import type { CustomerStatus } from '#models/customer'
import type { DockStatus } from '#models/dock'
import type { TruckStatus } from '#models/truck'
import type { UserAccessStatus, UserRole } from '#models/user'
import type { WarehouseStatus } from '#models/warehouse'
import type { WarehouseDoorStatus } from '#models/warehouse_door'
import type { WeighingAreaStatus } from '#models/weighing_area'
import { isEligibleShiftResponsible } from '#users/shared/shift_responsible_eligibility'

/**
 * Why a discharge cannot start, as one closed taxonomy the start check, the start refusal, and the
 * web all share. A discharge that is no longer planned is not a problem of this list: it replaces
 * every other answer with `E_DISCHARGE_NOT_PLANNED`.
 */
export const START_PROBLEM_FAMILIES = [
  'INCOMPLETE_PREPARATION',
  'UNAVAILABLE_REFERENCE',
  'INELIGIBLE_RESPONSIBLE',
  'ACTIVE_DISCHARGE_CONFLICT',
] as const
export type StartProblemFamily = (typeof START_PROBLEM_FAMILIES)[number]

export const START_PROBLEM_CODES = {
  NO_PRODUCT_LOT: 'INCOMPLETE_PREPARATION',
  NO_PLANNED_SHIFT: 'INCOMPLETE_PREPARATION',
  LOT_WITHOUT_WAREHOUSE_DOOR: 'INCOMPLETE_PREPARATION',
  SHIFT_WITHOUT_TRUCK: 'INCOMPLETE_PREPARATION',
  SHIFT_WITHOUT_WAREHOUSE_DOOR: 'INCOMPLETE_PREPARATION',
  SHIFT_WITHOUT_WEIGHING_AREA: 'INCOMPLETE_PREPARATION',
  DOCK_ARCHIVED: 'UNAVAILABLE_REFERENCE',
  CUSTOMER_ARCHIVED: 'UNAVAILABLE_REFERENCE',
  WAREHOUSE_DOOR_ARCHIVED: 'UNAVAILABLE_REFERENCE',
  WEIGHING_AREA_ARCHIVED: 'UNAVAILABLE_REFERENCE',
  TRUCK_ARCHIVED: 'UNAVAILABLE_REFERENCE',
  RESPONSIBLE_INELIGIBLE: 'INELIGIBLE_RESPONSIBLE',
  DOCK_HELD: 'ACTIVE_DISCHARGE_CONFLICT',
  TRUCK_HELD: 'ACTIVE_DISCHARGE_CONFLICT',
  WAREHOUSE_DOOR_HELD: 'ACTIVE_DISCHARGE_CONFLICT',
} as const satisfies Record<string, StartProblemFamily>
export type StartProblemCode = keyof typeof START_PROBLEM_CODES

export type StartProblemRef = {
  type:
    | 'DISCHARGE'
    | 'PRODUCT_LOT'
    | 'SHIFT'
    | 'USER'
    | 'DOCK'
    | 'CUSTOMER'
    | 'WAREHOUSE_DOOR'
    | 'WEIGHING_AREA'
    | 'TRUCK'
  id: string
}

/** Another active discharge using a resource this discharge would claim. */
export type StartHolder = { dischargeId: string; vesselName: string }

export type StartProblem = {
  family: StartProblemFamily
  code: StartProblemCode
  subject: StartProblemRef
  /** The lot or shift the subject was found in, when that is what the user fixes. */
  context?: StartProblemRef
  holder?: StartHolder
}

/**
 * Everything the start rules decide on, read either without locks for the review or under the
 * start's locks. Lists keep the discharge detail's order, which is the order problems are listed in.
 * Identities are lower-case.
 */
export type DischargeStartState = {
  dischargeId: string
  dock: { id: string; status: DockStatus }
  lots: Array<{
    id: string
    customer: { id: string; status: CustomerStatus }
    currentDoorIds: string[]
  }>
  doors: ReadonlyMap<string, { status: WarehouseDoorStatus; warehouseStatus: WarehouseStatus }>
  heldTruckIds: string[]
  firstShift: null | {
    id: string
    responsible: { id: string; accessStatus: UserAccessStatus; role: UserRole }
    trucks: Array<{ id: string; status: TruckStatus }>
    doorIds: string[]
    weighingAreas: Array<{ id: string; status: WeighingAreaStatus }>
  }
  holders: {
    dock: StartHolder | null
    trucks: ReadonlyMap<string, StartHolder>
    doors: ReadonlyMap<string, StartHolder>
  }
}

export type DischargeStartEvaluation = { shiftId: string | null; problems: StartProblem[] }

/**
 * Decides whether a discharge can start, and every reason it cannot. Every applicable problem is
 * listed: each is fixed in a different place, so reporting them one attempt at a time would send the
 * user back and forth.
 */
export function evaluateDischargeStart(state: DischargeStartState): DischargeStartEvaluation {
  const problems = [
    ...preparationProblems(state),
    ...referenceProblems(state),
    ...responsibleProblems(state),
    ...conflictProblems(state),
  ]

  return { shiftId: state.firstShift?.id ?? null, problems: byFamily(problems) }
}

function problem(
  code: StartProblemCode,
  subject: StartProblemRef,
  extra: Pick<StartProblem, 'context' | 'holder'> = {},
): StartProblem {
  return { family: START_PROBLEM_CODES[code], code, subject, ...extra }
}

/**
 * Families come in the taxonomy's order. Within one, problems keep the order they were found in,
 * which follows the plan: the dock, then the lots and their doors, then the first shift.
 */
function byFamily(problems: StartProblem[]) {
  return START_PROBLEM_FAMILIES.flatMap((family) =>
    problems.filter((candidate) => candidate.family === family),
  )
}

const isUsableTruck = (state: DischargeStartState, truck: { id: string; status: TruckStatus }) =>
  truck.status === 'AVAILABLE' && state.heldTruckIds.includes(truck.id)

const isUsableDoor = (state: DischargeStartState, doorId: string) => {
  const door = state.doors.get(doorId)

  return (
    door?.status === 'AVAILABLE' &&
    door.warehouseStatus === 'AVAILABLE' &&
    state.lots.some((lot) => lot.currentDoorIds.includes(doorId))
  )
}

const isArchivedDoor = (state: DischargeStartState, doorId: string) => {
  const door = state.doors.get(doorId)

  return door !== undefined && (door.status === 'ARCHIVED' || door.warehouseStatus === 'ARCHIVED')
}

/**
 * What the preparation still lacks. Only the first shift's resources are required: later shifts
 * are checked when they start. A suspended truck stays part of the plan but cannot count as the
 * shift's truck, since it is out of service.
 */
function* preparationProblems(state: DischargeStartState) {
  const discharge = { type: 'DISCHARGE', id: state.dischargeId } as const

  if (state.lots.length === 0) {
    yield problem('NO_PRODUCT_LOT', discharge)
  }
  if (!state.firstShift) {
    yield problem('NO_PLANNED_SHIFT', discharge)
  }

  for (const lot of state.lots) {
    if (lot.currentDoorIds.length === 0) {
      yield problem('LOT_WITHOUT_WAREHOUSE_DOOR', { type: 'PRODUCT_LOT', id: lot.id })
    }
  }

  const shift = state.firstShift
  if (!shift) {
    return
  }

  const subject = { type: 'SHIFT', id: shift.id } as const
  if (!shift.trucks.some((truck) => isUsableTruck(state, truck))) {
    yield problem('SHIFT_WITHOUT_TRUCK', subject)
  }
  if (!shift.doorIds.some((doorId) => isUsableDoor(state, doorId))) {
    yield problem('SHIFT_WITHOUT_WAREHOUSE_DOOR', subject)
  }
  if (!shift.weighingAreas.some((area) => area.status === 'AVAILABLE')) {
    yield problem('SHIFT_WITHOUT_WEIGHING_AREA', subject)
  }
}

/**
 * References retired from the site. Archival guards keep a planned discharge's references in
 * service, so these only appear for rows written around those guards — seeds, imports, or a race —
 * and must still never enter operations. A door of an archived warehouse is reported as the door.
 */
function* referenceProblems(state: DischargeStartState) {
  if (state.dock.status === 'ARCHIVED') {
    yield problem('DOCK_ARCHIVED', { type: 'DOCK', id: state.dock.id })
  }

  for (const lot of state.lots) {
    const context = { type: 'PRODUCT_LOT', id: lot.id } as const
    if (lot.customer.status === 'ARCHIVED') {
      yield problem('CUSTOMER_ARCHIVED', { type: 'CUSTOMER', id: lot.customer.id }, { context })
    }
    for (const doorId of lot.currentDoorIds) {
      if (isArchivedDoor(state, doorId)) {
        yield problem(
          'WAREHOUSE_DOOR_ARCHIVED',
          { type: 'WAREHOUSE_DOOR', id: doorId },
          { context },
        )
      }
    }
  }

  const shift = state.firstShift
  if (!shift) {
    return
  }

  const context = { type: 'SHIFT', id: shift.id } as const
  for (const doorId of shift.doorIds) {
    if (isArchivedDoor(state, doorId)) {
      yield problem('WAREHOUSE_DOOR_ARCHIVED', { type: 'WAREHOUSE_DOOR', id: doorId }, { context })
    }
  }
  for (const area of shift.weighingAreas) {
    if (area.status === 'ARCHIVED') {
      yield problem('WEIGHING_AREA_ARCHIVED', { type: 'WEIGHING_AREA', id: area.id }, { context })
    }
  }
  for (const truck of shift.trucks) {
    if (truck.status === 'ARCHIVED') {
      yield problem('TRUCK_ARCHIVED', { type: 'TRUCK', id: truck.id }, { context })
    }
  }
}

/** A shift starts under a responsible who may still be accountable for it. */
function* responsibleProblems(state: DischargeStartState) {
  const shift = state.firstShift

  if (shift && !isEligibleShiftResponsible(shift.responsible)) {
    yield problem(
      'RESPONSIBLE_INELIGIBLE',
      { type: 'USER', id: shift.responsible.id },
      { context: { type: 'SHIFT', id: shift.id } },
    )
  }
}

/**
 * What another active discharge already holds. A truck is exclusive through the whole pool and a
 * door through every current assignment, not only through what the first shift uses: once active,
 * the discharge holds all of them.
 */
function* conflictProblems(state: DischargeStartState) {
  if (state.holders.dock) {
    yield problem('DOCK_HELD', { type: 'DOCK', id: state.dock.id }, { holder: state.holders.dock })
  }

  for (const truckId of state.heldTruckIds) {
    const holder = state.holders.trucks.get(truckId)
    if (holder) {
      yield problem('TRUCK_HELD', { type: 'TRUCK', id: truckId }, { holder })
    }
  }

  for (const lot of state.lots) {
    for (const doorId of lot.currentDoorIds) {
      const holder = state.holders.doors.get(doorId)
      if (holder) {
        yield problem(
          'WAREHOUSE_DOOR_HELD',
          { type: 'WAREHOUSE_DOOR', id: doorId },
          { context: { type: 'PRODUCT_LOT', id: lot.id }, holder },
        )
      }
    }
  }
}

/**
 * Joins a plan, the current state of the references it uses, and the active holders of what it
 * would claim into the state the rules read. A reference the reads did not return — which foreign
 * keys make impossible — is taken as archived rather than silently usable.
 */
export function buildStartState(
  dischargeId: string,
  plan: StartPlan,
  references: StartReferences,
  holders: StartHolders,
): DischargeStartState {
  const doorsByLot = new Map<string, string[]>()
  for (const assignment of plan.currentAssignments) {
    doorsByLot.set(assignment.productLotId, [
      ...(doorsByLot.get(assignment.productLotId) ?? []),
      assignment.warehouseDoorId,
    ])
  }
  const shift = plan.firstShift
  const responsible = shift ? references.users.get(shift.responsibleUserId) : undefined

  return {
    dischargeId: dischargeId.toLowerCase(),
    dock: references.dock,
    lots: plan.lots.map((lot) => ({
      id: lot.id,
      customer: {
        id: lot.customerId,
        status: references.customers.get(lot.customerId) ?? 'ARCHIVED',
      },
      currentDoorIds: doorsByLot.get(lot.id) ?? [],
    })),
    doors: references.warehouseDoors,
    heldTruckIds: plan.heldTruckIds,
    firstShift: shift
      ? {
          id: shift.id,
          responsible: {
            id: shift.responsibleUserId,
            accessStatus: responsible?.accessStatus ?? 'DEACTIVATED',
            role: responsible?.role ?? 'OBSERVER',
          },
          trucks: shift.truckIds.map((id) => ({
            id,
            status: references.trucks.get(id) ?? 'ARCHIVED',
          })),
          doorIds: shift.warehouseDoorIds,
          weighingAreas: shift.weighingAreaIds.map((id) => ({
            id,
            status: references.weighingAreas.get(id) ?? 'ARCHIVED',
          })),
        }
      : null,
    holders,
  }
}

/** The identities of every reference a plan uses, for the reads and the claims. */
export function startReferenceIds(dockId: string, plan: StartPlan): StartReferenceIds {
  const shift = plan.firstShift

  return {
    dockId,
    customerIds: plan.lots.map((lot) => lot.customerId),
    userIds: shift ? [shift.responsibleUserId] : [],
    // The first shift's trucks are held by the pool; listing both keeps a stray selection claimed.
    truckIds: [...plan.heldTruckIds, ...(shift?.truckIds ?? [])],
    warehouseDoorIds: [
      ...plan.currentAssignments.map((assignment) => assignment.warehouseDoorId),
      ...(shift?.warehouseDoorIds ?? []),
    ],
    weighingAreaIds: shift?.weighingAreaIds ?? [],
  }
}
