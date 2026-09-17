import type { ShiftStatus } from '#models/shift'
import type User from '#models/user'
import { isEligibleShiftResponsible } from '#users/shared/shift_responsible_eligibility'

/**
 * What a planned shift may still lack to start, in the order the shift panel lists it. A gap is a
 * fact about the shift as it stands, never a verdict on whether it or its discharge can start.
 */
export const READINESS_GAPS = [
  'NO_USABLE_TRUCK',
  'NO_USABLE_WAREHOUSE_DOOR',
  'NO_USABLE_WEIGHING_AREA',
  'RESPONSIBLE_NOT_ELIGIBLE',
] as const

export type ReadinessGap = (typeof READINESS_GAPS)[number]

type Period = { effectiveTo: unknown }

/** The parts of a shift its gaps are read from, as the discharge detail loads them. */
export type ReadinessShift = {
  status: ShiftStatus
  responsible: Pick<User, 'role' | 'accessStatus'>
  truckMemberships: ReadonlyArray<Period & { truckId: string; truck: { status: string } }>
  warehouseDoorMemberships: ReadonlyArray<
    Period & {
      warehouseDoorId: string
      warehouseDoor: { status: string; warehouse: { status: string } }
    }
  >
  weighingAreaMemberships: ReadonlyArray<Period & { weighingArea: { status: string } }>
}

/** The parts of the shift's discharge a resource's usability depends on. */
export type ReadinessDischarge = {
  truckAssignments: ReadonlyArray<{ truckId: string; releasedAt: unknown }>
  productLots: ReadonlyArray<{
    doorAssignments: ReadonlyArray<Period & { warehouseDoorId: string }>
  }>
}

const isCurrent = (period: Period) => period.effectiveTo === null

/**
 * The gaps of a planned shift, or `null` for a shift that has started, where they no longer apply.
 *
 * A resource counts only while the shift could still work with it: a truck selected, held by the
 * discharge, and in service; a door selected, available in an available warehouse, and held by a lot
 * of the discharge; a weighing area selected and available. A shift lacks a kind of resource when
 * none of its selections of that kind counts, whatever else stays selected.
 *
 * GH-65 revalidates these same conditions when a shift starts, and should read them here rather than
 * restate them.
 */
export function plannedShiftReadinessGaps(
  shift: ReadinessShift,
  discharge: ReadinessDischarge,
): ReadinessGap[] | null {
  if (shift.status !== 'PLANNED') {
    return null
  }

  const heldTruckIds = new Set(
    discharge.truckAssignments
      .filter((assignment) => assignment.releasedAt === null)
      .map((assignment) => assignment.truckId.toLowerCase()),
  )
  const assignedDoorIds = new Set(
    discharge.productLots.flatMap((lot) =>
      lot.doorAssignments
        .filter(isCurrent)
        .map((assignment) => assignment.warehouseDoorId.toLowerCase()),
    ),
  )

  const usable = {
    NO_USABLE_TRUCK: shift.truckMemberships.some(
      (membership) =>
        isCurrent(membership) &&
        heldTruckIds.has(membership.truckId.toLowerCase()) &&
        membership.truck.status === 'AVAILABLE',
    ),
    NO_USABLE_WAREHOUSE_DOOR: shift.warehouseDoorMemberships.some(
      (membership) =>
        isCurrent(membership) &&
        membership.warehouseDoor.status === 'AVAILABLE' &&
        membership.warehouseDoor.warehouse.status === 'AVAILABLE' &&
        assignedDoorIds.has(membership.warehouseDoorId.toLowerCase()),
    ),
    NO_USABLE_WEIGHING_AREA: shift.weighingAreaMemberships.some(
      (membership) => isCurrent(membership) && membership.weighingArea.status === 'AVAILABLE',
    ),
    RESPONSIBLE_NOT_ELIGIBLE: isEligibleShiftResponsible(shift.responsible),
  } satisfies Record<ReadinessGap, boolean>

  return READINESS_GAPS.filter((gap) => !usable[gap])
}
