import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { Decimal } from 'decimal.js'
import type { DateTime } from 'luxon'

import type Customer from '#models/customer'
import type Discharge from '#models/discharge'
import type Dock from '#models/dock'
import type User from '#models/user'

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

export type CreatePlannedDischargeResult =
  | { kind: 'CREATED' }
  | { kind: 'DUPLICATE_ID' }
  | { kind: 'DUPLICATE_LOT_IDENTITY' }

/**
 * The locked reads and writes behind preparing and correcting a discharge. Every method runs on the
 * caller's transaction, because each rule a command decides depends on rows read under the locks
 * that same transaction holds.
 *
 * Locks are always taken in one order — the discharge, then docks, then customers, then users — so
 * two preparation writes can never deadlock each other.
 *
 * - The discharge is locked `FOR UPDATE`: corrections of one discharge queue behind each other, and
 *   behind the activation and assignment writers that must take the same lock (GH-54, GH-56).
 * - References are locked `FOR SHARE`: two discharges may use one customer at once, but an archive
 *   (`FOR UPDATE` or a plain `UPDATE`) or a deactivation (`FOR NO KEY UPDATE`) of that reference
 *   waits for the write to commit and then sees it as a usage — or commits first, and this write
 *   then reads the archived status. A row lock alone would not block an insert that references the
 *   row, which is why the lock is taken explicitly before reading the status.
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

  abstract insertProductLot(
    command: ProductLotValues & { dischargeId: string },
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
}
