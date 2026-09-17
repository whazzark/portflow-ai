import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { Decimal } from 'decimal.js'
import type { DateTime } from 'luxon'
import type { ShiftResourceSelectionPlan } from '#discharges/shared/planned_shift_rules'
import type { ReservationPlan, ShiftSelectionPlan } from '#discharges/shared/truck_pool_rules'
import type Customer from '#models/customer'
import type Discharge from '#models/discharge'
import type Dock from '#models/dock'
import type { ShiftStatus } from '#models/shift'
import type { TruckStatus } from '#models/truck'
import type User from '#models/user'
import type { WarehouseStatus } from '#models/warehouse'
import type { WarehouseDoorStatus } from '#models/warehouse_door'
import type { WeighingAreaStatus } from '#models/weighing_area'

export type CreatePlannedDischargeCommand = {
  id: string
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: DateTime
  productLots: Array<{
    customerId: string
    productName: string
    expectedQuantityTonnes: Decimal
    description: string | null
  }>
  shifts: Array<{
    sequence: number
    plannedStartAt: DateTime
    plannedEndAt: DateTime
    responsibleUserId: string
  }>
}

export type UpdateDischargeIdentityCommand = {
  dischargeId: string
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: DateTime
}

export type ProductLotValues = {
  customerId: string
  productName: string
  expectedQuantityTonnes: Decimal
  description: string | null
}

export type ProductLotWriteResult = { kind: 'WRITTEN' } | { kind: 'DUPLICATE_LOT_IDENTITY' }

export type DeleteProductLotResult = { kind: 'DELETED' } | { kind: 'HAS_DOOR_ASSIGNMENTS' }

/** One customer's lots corrected at once, as `planCustomerProductLotsCorrection` decided them. */
export type WriteCustomerProductLotsCorrectionCommand = {
  dischargeId: string
  removals: string[]
  corrections: Array<ProductLotValues & { productLotId: string; identityChanges: boolean }>
  insertions: ProductLotValues[]
}

export type CustomerProductLotsWriteResult =
  | { kind: 'WRITTEN' }
  | { kind: 'DUPLICATE_LOT_IDENTITY' }
  | { kind: 'HAS_DOOR_ASSIGNMENTS' }

/** A truck read under its share lock, with the company whose name a reservation captures. */
export type LockedTruck = {
  id: string
  status: TruckStatus
  registration: string
  transportCompanyId: string | null
  transportCompanyName: string
}

/** One row of a discharge's pool: held while `releasedAt` is `null`. */
export type TruckPoolRow = { id: string; truckId: string; releasedAt: DateTime | null }

/** A truck currently selected for a planned shift: a membership that has not ended. */
export type ShiftTruckSelectionRow = { id: string; shiftId: string; truckId: string }

/** A warehouse door read under its share lock, with the status of the warehouse holding it. */
export type LockedWarehouseDoor = {
  id: string
  status: WarehouseDoorStatus
  warehouseStatus: WarehouseStatus
}

/** A weighing area read under its share lock. */
export type LockedWeighingArea = { id: string; status: WeighingAreaStatus }

/** One shift of a discharge as its period rules and its numbering read it. */
export type ShiftPlanRow = {
  id: string
  sequence: number
  status: ShiftStatus
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsibleUserId: string
}

/** A warehouse door or weighing area currently selected for a shift: a membership not ended. */
export type ShiftResourceSelectionRow = { id: string; resourceId: string }

export type WriteTruckReservationsCommand = {
  dischargeId: string
} & Omit<Extract<ReservationPlan, { kind: 'PLAN' }>, 'kind'>

export type WriteShiftTruckSelectionCommand = {
  dischargeId: string
  shiftId: string
} & Omit<Extract<ShiftSelectionPlan, { kind: 'PLAN' }>, 'kind'>

type ShiftResourceSelectionChange = Omit<
  Extract<ShiftResourceSelectionPlan, { kind: 'PLAN' }>,
  'kind'
>

/**
 * A planned shift's correction apart from its trucks, which `writeShiftTruckSelection` writes: its
 * new period and responsible, the sequences `planShiftSequences` changed, and its door and weighing
 * area selection changes.
 */
export type WritePlannedShiftCorrectionCommand = {
  dischargeId: string
  shiftId: string
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsibleUserId: string
  sequences: Array<{ shiftId: string; sequence: number }>
  warehouseDoors: ShiftResourceSelectionChange
  weighingAreas: ShiftResourceSelectionChange
}

/**
 * A planned shift added to a discharge: its values, the sequence `planAddedShiftSequences` gave it
 * and the existing sequences it moved, and the doors and weighing areas it starts with.
 */
export type InsertPlannedShiftCommand = {
  dischargeId: string
  shiftId: string
  sequence: number
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsibleUserId: string
  sequences: Array<{ shiftId: string; sequence: number }>
  warehouseDoors: Pick<ShiftResourceSelectionChange, 'inserts'>
  weighingAreas: Pick<ShiftResourceSelectionChange, 'inserts'>
}

export type InsertPlannedShiftResult = { kind: 'INSERTED' } | { kind: 'DUPLICATE_ID' }

export type ShiftTruckSelectionWriteResult = { kind: 'WRITTEN' } | { kind: 'ALREADY_SELECTED' }

export type TruckReservationWriteResult = { kind: 'WRITTEN' } | { kind: 'ALREADY_HELD' }

export type CurrentDoorAssignment = {
  id: string
  productLotId: string
  warehouseDoorId: string
}

export type CurrentShiftSelections = {
  warehouseDoors: Array<{ id: string; shiftId: string; warehouseDoorId: string }>
  weighingAreas: Array<{ id: string; shiftId: string; weighingAreaId: string }>
}

export type PlanningRowTable = 'DOOR_ASSIGNMENT' | 'SHIFT_DOOR' | 'SHIFT_AREA'

export type PlanningWriteResult = { kind: 'WRITTEN' } | { kind: 'CURRENT_ROW_CONFLICT' }

export type CreatePlannedDischargeResult =
  | { kind: 'CREATED' }
  | { kind: 'DUPLICATE_ID' }
  | { kind: 'DUPLICATE_LOT_IDENTITY' }

/**
 * The locked reads and writes behind preparing and correcting a discharge. Every method runs on the
 * caller's transaction, because each rule a command decides depends on rows read under the locks
 * that same transaction holds.
 *
 * Locks are always taken in one order — the discharge, then docks, then customers, then users, then
 * trucks, then warehouses and their doors, then weighing areas — so two preparation writes can never
 * deadlock each other. The pool, the shifts, and their resource selections take no lock of their
 * own: every writer of those rows locks the discharge first.
 *
 * - The discharge is locked `FOR UPDATE`: corrections of one discharge queue behind each other, and
 *   behind every other writer of its pool, shifts, and memberships, which must take the same lock
 *   first: door assignments (GH-54), the start confirmation (GH-56), shift changes (GH-63, GH-64),
 *   and runtime truck and shift resource changes (GH-76, GH-78).
 * - References are locked `FOR SHARE`: two discharges may use one customer at once, but an archive
 *   (`FOR UPDATE` or a plain `UPDATE`) or a deactivation (`FOR NO KEY UPDATE`) of that reference
 *   waits for the write to commit and then sees it as a usage — or commits first, and this write
 *   then reads the archived status. A row lock alone would not block an insert that references the
 *   row, which is why the lock is taken explicitly before reading the status.
 * - The start confirmation (`DischargeStartRepository`) claims, at their places in this order, the
 *   resources an active discharge holds exclusively — its dock, its pool's trucks, and its current
 *   doors — `FOR NO KEY UPDATE` instead. That mode conflicts with itself, so two starts sharing one of
 *   them queue on it, and the later one reads the earlier as an active holder. Any later writer that
 *   makes a dock, truck, or door held by an active discharge — a dock reassignment (GH-75), a truck
 *   assignment (GH-76), or a door assignment (GH-77) on an active discharge — must take the same
 *   claim before reading the resource's active holders, or it could race a start.
 */
export default abstract class DischargePreparationRepository {
  /** The discharge locked `FOR UPDATE`, or `null` for an unknown or malformed identity. */
  abstract lockDischarge(id: string, client: TransactionClientContract): Promise<Discharge | null>

  /** The docks among `ids` that exist, locked `FOR SHARE` and keyed by lower-case identity. */
  abstract lockDocks(ids: string[], client: TransactionClientContract): Promise<Map<string, Dock>>

  /** The customers among `ids` that exist, locked `FOR SHARE` and keyed by lower-case identity. */
  abstract lockCustomers(
    ids: string[],
    client: TransactionClientContract,
  ): Promise<Map<string, Customer>>

  /** The users among `ids` that exist, locked `FOR SHARE` and keyed by lower-case identity. */
  abstract lockUsers(ids: string[], client: TransactionClientContract): Promise<Map<string, User>>

  /**
   * The trucks among `ids` that exist, locked `FOR SHARE` and keyed by lower-case identity. A
   * truck archive or suspension locks the same row `FOR UPDATE`, so it either waits for this write
   * and then sees the reservation, or commits first and this write reads the new status.
   */
  abstract lockTrucks(
    ids: string[],
    client: TransactionClientContract,
  ): Promise<Map<string, LockedTruck>>

  /**
   * The warehouse doors among `ids` that exist, locked `FOR SHARE` with their warehouses and keyed by
   * lower-case identity. The warehouses are locked first: a door or warehouse archive locks the
   * warehouse before the door, so this write takes them in the same order and either waits for the
   * archive and reads the new status, or makes the archive wait for its commit.
   */
  abstract lockWarehouseDoors(
    ids: string[],
    client: TransactionClientContract,
  ): Promise<Map<string, LockedWarehouseDoor>>

  /**
   * The weighing areas among `ids` that exist, locked `FOR SHARE` and keyed by lower-case identity.
   * A weighing area archive locks the same row `FOR UPDATE`, so it either waits for this write and
   * then sees the selection as a usage, or commits first and this write reads the archived status.
   */
  abstract lockWeighingAreas(
    ids: string[],
    client: TransactionClientContract,
  ): Promise<Map<string, LockedWeighingArea>>

  /** Every pool row of a discharge, held or released, read under the discharge's lock. */
  abstract listTruckPool(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<TruckPoolRow[]>

  /** The current truck selections of the discharge's planned shifts; ended ones are history. */
  abstract listCurrentShiftTruckSelections(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<ShiftTruckSelectionRow[]>

  /** Every shift of a discharge in sequence order, whatever its status, read under its lock. */
  abstract listShifts(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<ShiftPlanRow[]>

  /** The warehouse doors currently selected for a shift; ended memberships are history. */
  abstract listCurrentShiftWarehouseDoors(
    shiftId: string,
    client: TransactionClientContract,
  ): Promise<ShiftResourceSelectionRow[]>

  /** The weighing areas currently selected for a shift; ended memberships are history. */
  abstract listCurrentShiftWeighingAreas(
    shiftId: string,
    client: TransactionClientContract,
  ): Promise<ShiftResourceSelectionRow[]>

  /** A shift of this discharge, or `null` for an unknown, malformed, or foreign identity. */
  abstract findShift(
    dischargeId: string,
    shiftId: string,
    client: TransactionClientContract,
  ): Promise<{ id: string; status: ShiftStatus } | null>

  /**
   * Writes a reservation plan: new pool rows, and released rows held again with their values
   * captured again. A row that already exists for a truck comes back as an outcome rather than an
   * error, and leaves the caller's transaction usable.
   */
  abstract writeTruckReservations(
    command: WriteTruckReservationsCommand,
    client: TransactionClientContract,
  ): Promise<TruckReservationWriteResult>

  /**
   * Writes a planned shift's selection change: removed trucks lose their current row, added ones
   * get one from `effectiveFrom`. A row already written for the same instant comes back as an
   * outcome rather than an error.
   */
  abstract writeShiftTruckSelection(
    command: WriteShiftTruckSelectionCommand,
    client: TransactionClientContract,
  ): Promise<ShiftTruckSelectionWriteResult>

  /**
   * Writes a planned shift's correction: the sequences it changed, its period and responsible, and
   * its door and weighing area selections, whose removed resources lose their current row while
   * added ones get one from `effectiveFrom`. The caller holds the discharge's lock and has checked
   * the shift is planned, so the write cannot miss.
   */
  abstract writePlannedShiftCorrection(
    command: WritePlannedShiftCorrectionCommand,
    client: TransactionClientContract,
  ): Promise<void>

  /** Whether a shift of this discharge already has this identity; a foreign one is not found. */
  abstract findShiftIdentity(
    dischargeId: string,
    shiftId: string,
    client: TransactionClientContract,
  ): Promise<boolean>

  /**
   * Inserts a planned shift with its door and weighing area selections, after moving the shifts
   * whose sequence changes. The caller holds the discharge's lock and has checked its rules. An
   * identity already used by another shift comes back as an outcome rather than an error, with
   * nothing written and the caller's transaction usable.
   */
  abstract insertPlannedShift(
    command: InsertPlannedShiftCommand,
    client: TransactionClientContract,
  ): Promise<InsertPlannedShiftResult>

  /**
   * Deletes a withdrawal: the current selections first, then the held reservations, so no
   * selection ever outlives the reservation it came from. Released rows are never touched.
   */
  abstract deleteTruckWithdrawal(
    command: { dischargeId: string; assignmentIds: string[]; selectionIds: string[] },
    client: TransactionClientContract,
  ): Promise<void>

  /** The discharge's identity when one already has it, locked with the rest of the transaction. */
  abstract findDischargeIdentity(
    id: string,
    client: TransactionClientContract,
  ): Promise<string | null>

  /**
   * Inserts the discharge in the planned status with its lots and planned shifts. A discharge that
   * already holds the identity, or two lots sharing an identity, come back as outcomes rather than
   * errors, and leave the caller's transaction usable.
   */
  abstract createPlannedDischarge(
    command: CreatePlannedDischargeCommand,
    client: TransactionClientContract,
  ): Promise<CreatePlannedDischargeResult>

  /**
   * Writes a planned discharge's vessel description, dock, and expected start. The caller holds the
   * discharge's lock and has checked it is planned, so the write cannot miss.
   */
  abstract updateIdentity(
    command: UpdateDischargeIdentityCommand,
    client: TransactionClientContract,
  ): Promise<void>

  /** The identities of a discharge's lots, read under the discharge's lock. */
  abstract listProductLots(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<Array<{ id: string; customerId: string; productName: string }>>

  /** Whether a lot has ever had a warehouse door assigned, whether that assignment ended or not. */
  abstract hasDoorAssignments(
    productLotId: string,
    client: TransactionClientContract,
  ): Promise<boolean>

  /** Inserts every lot, or none when one of them breaks a rule the database enforces. */
  abstract insertProductLots(
    command: { dischargeId: string; productLots: ProductLotValues[] },
    client: TransactionClientContract,
  ): Promise<ProductLotWriteResult>

  abstract updateProductLot(
    command: ProductLotValues & { dischargeId: string; productLotId: string },
    client: TransactionClientContract,
  ): Promise<ProductLotWriteResult>

  /**
   * Deletes a lot. An assignment written in spite of the discharge's lock — the foreign key
   * restricts it — comes back as an outcome rather than an error.
   */
  abstract deleteProductLot(
    command: { dischargeId: string; productLotId: string },
    client: TransactionClientContract,
  ): Promise<DeleteProductLotResult>

  /** The lots among `productLotIds` that have ever had a warehouse door, lower-cased. */
  abstract listLotIdsWithDoorAssignments(
    productLotIds: string[],
    client: TransactionClientContract,
  ): Promise<Set<string>>

  /**
   * Writes one customer's lot correction in one savepoint, in an order that lets the final state
   * pass the identity index even though it is checked row by row: removed lots are deleted, lots
   * whose identity changes are parked under their own id, every corrected lot gets its final
   * values, and added lots are inserted. A duplicate identity or a door assignment the discharge's
   * lock did not keep out comes back as an outcome, leaving the caller's transaction usable.
   */
  abstract writeCustomerProductLotsCorrection(
    command: WriteCustomerProductLotsCorrectionCommand,
    client: TransactionClientContract,
  ): Promise<CustomerProductLotsWriteResult>

  /** The door assignments of a discharge still in effect, read under the discharge's lock. */
  abstract listCurrentDoorAssignments(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<CurrentDoorAssignment[]>

  /** Every shift selection of a discharge still in effect, doors and weighing areas apart. */
  abstract listCurrentShiftSelections(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<CurrentShiftSelections>

  /**
   * The latest start or end recorded among a discharge's door assignments, ended or not, from which
   * the next recorded instant is kept strictly later.
   */
  abstract latestDoorAssignmentTime(
    dischargeId: string,
    client: TransactionClientContract,
  ): Promise<DateTime | null>

  /** The same, among one shift's door and weighing area selections. */
  abstract latestShiftSelectionTime(
    shiftId: string,
    client: TransactionClientContract,
  ): Promise<DateTime | null>

  /** Ends the given rows still in effect at `instant`. Rows are never deleted. */
  abstract endRows(
    table: PlanningRowTable,
    ids: string[],
    instant: DateTime,
    client: TransactionClientContract,
  ): Promise<void>

  /**
   * Starts assignments in effect from `instant`. A row a current-row index refuses comes back as
   * an outcome, and leaves the caller's transaction usable.
   */
  abstract startDoorAssignments(
    rows: Array<{ dischargeId: string; productLotId: string; warehouseDoorId: string }>,
    instant: DateTime,
    client: TransactionClientContract,
  ): Promise<PlanningWriteResult>

  abstract startShiftDoors(
    rows: Array<{ shiftId: string; warehouseDoorId: string }>,
    instant: DateTime,
    client: TransactionClientContract,
  ): Promise<PlanningWriteResult>

  abstract startShiftAreas(
    rows: Array<{ shiftId: string; weighingAreaId: string }>,
    instant: DateTime,
    client: TransactionClientContract,
  ): Promise<PlanningWriteResult>
}
