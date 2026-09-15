import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import Customer from '#models/customer'
import Discharge from '#models/discharge'
import Dock from '#models/dock'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'
import User from '#models/user'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'
import isForeignKeyViolation from '#shared/database/is_foreign_key_violation'
import isUuid from '#shared/database/is_uuid'

import DischargePreparationRepository, {
  type CreatePlannedDischargeCommand,
  type CreatePlannedDischargeResult,
  type DeleteProductLotResult,
  type ProductLotValues,
  type ProductLotWriteResult,
  type UpdateDischargeIdentityCommand,
} from './discharge_preparation_repository.ts'

/** Distinct, well-formed, lower-case identities, in the order every lock is taken: by identity. */
function lockableIds(ids: string[]) {
  return [...new Set(ids.filter((id) => isUuid(id)).map((id) => id.toLowerCase()))].sort()
}

type DatabaseError = { code?: string; constraint?: string; message?: string }

/** A second discharge with the same identity: Postgres names the key, SQLite its own code. */
function isDuplicateDischargeId(error: unknown) {
  const candidate = (error ?? {}) as DatabaseError

  return (
    (candidate.code === '23505' && candidate.constraint === 'discharges_pkey') ||
    candidate.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
  )
}

function isDuplicateLotIdentity(error: unknown) {
  const candidate = (error ?? {}) as DatabaseError

  return (
    (candidate.code === '23505' && candidate.constraint === 'product_lots_identity_unique') ||
    (candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      (candidate.message ?? '').includes('product_lots_identity_unique'))
  )
}

function byId<Row extends { id: string }>(rows: Row[]) {
  return new Map(rows.map((row) => [row.id.toLowerCase(), row]))
}

export default class LucidDischargePreparationRepository extends DischargePreparationRepository {
  lockDischarge(id: string, client: TransactionClientContract) {
    if (!isUuid(id)) {
      return Promise.resolve(null)
    }

    return Discharge.query({ client }).where('id', id.toLowerCase()).forUpdate().first()
  }

  async lockDocks(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    if (lockable.length === 0) {
      return new Map<string, Dock>()
    }

    const query = Dock.query({ client }).whereIn('id', lockable).orderBy('id')
    query.knexQuery.forShare()

    return byId(await query)
  }

  async lockCustomers(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    if (lockable.length === 0) {
      return new Map<string, Customer>()
    }

    const query = Customer.query({ client }).whereIn('id', lockable).orderBy('id')
    query.knexQuery.forShare()

    return byId(await query)
  }

  async lockUsers(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    if (lockable.length === 0) {
      return new Map<string, User>()
    }

    const query = User.query({ client }).whereIn('id', lockable).orderBy('id')
    query.knexQuery.forShare()

    return byId(await query)
  }

  async findDischargeIdentity(id: string, client: TransactionClientContract) {
    const discharge = await Discharge.query({ client }).where('id', id.toLowerCase()).first()

    return discharge?.id ?? null
  }

  /**
   * The inserts run in a savepoint: a unique violation aborts a Postgres transaction, and the
   * outcome it becomes must leave the caller's transaction able to go on or to end cleanly.
   */
  async createPlannedDischarge(
    command: CreatePlannedDischargeCommand,
    client: TransactionClientContract,
  ): Promise<CreatePlannedDischargeResult> {
    const savepoint = await client.transaction()

    try {
      const discharge = await Discharge.create(
        {
          id: command.id.toLowerCase(),
          status: 'PLANNED',
          vesselName: command.vesselName,
          vesselImo: command.vesselImo,
          vesselComment: command.vesselComment,
          dockId: command.dockId.toLowerCase(),
          expectedStartAt: command.expectedStartAt.toUTC(),
        },
        { client: savepoint },
      )
      await ProductLot.createMany(
        command.productLots.map((productLot) => ({
          dischargeId: discharge.id,
          customerId: productLot.customerId.toLowerCase(),
          productName: productLot.productName,
          expectedQuantityTonnes: productLot.expectedQuantityTonnes,
          description: productLot.description,
        })),
        { client: savepoint },
      )
      await Shift.createMany(
        command.shifts.map((shift) => ({
          dischargeId: discharge.id,
          sequence: shift.sequence,
          status: 'PLANNED' as const,
          plannedStartAt: shift.plannedStartAt.toUTC(),
          plannedEndAt: shift.plannedEndAt.toUTC(),
          responsibleUserId: shift.responsibleUserId.toLowerCase(),
        })),
        { client: savepoint },
      )
      await savepoint.commit()

      return { kind: 'CREATED' }
    } catch (error) {
      await savepoint.rollback()

      if (isDuplicateDischargeId(error)) {
        return { kind: 'DUPLICATE_ID' }
      }
      if (isDuplicateLotIdentity(error)) {
        return { kind: 'DUPLICATE_LOT_IDENTITY' }
      }

      throw error
    }
  }

  async updateIdentity(command: UpdateDischargeIdentityCommand, client: TransactionClientContract) {
    const [affectedRows] = await Discharge.query({ client })
      .where('id', command.dischargeId.toLowerCase())
      .where('status', 'PLANNED')
      .update({
        vesselName: command.vesselName,
        vesselImo: command.vesselImo,
        vesselComment: command.vesselComment,
        dockId: command.dockId.toLowerCase(),
        expectedStartAt: command.expectedStartAt.toUTC().toSQL({ includeOffset: false }),
        updatedAt: DateTime.utc().toSQL({ includeOffset: false }),
      })

    if (affectedRows !== 1) {
      throw new Error(`Discharge ${command.dischargeId} changed while its lock was held`)
    }
  }

  async listProductLots(dischargeId: string, client: TransactionClientContract) {
    const lots = await ProductLot.query({ client })
      .where('dischargeId', dischargeId.toLowerCase())
      .select('id', 'customerId', 'productName')
      .orderBy('id')

    return lots.map((lot) => ({
      id: lot.id,
      customerId: lot.customerId,
      productName: lot.productName,
    }))
  }

  async hasDoorAssignments(productLotId: string, client: TransactionClientContract) {
    const assignment = await WarehouseDoorProductLotAssignment.query({ client })
      .where('productLotId', productLotId.toLowerCase())
      .first()

    return assignment !== null
  }

  insertProductLot(
    command: ProductLotValues & { dischargeId: string },
    client: TransactionClientContract,
  ) {
    return this.writeProductLot(client, async (savepoint) => {
      await ProductLot.create(
        {
          dischargeId: command.dischargeId.toLowerCase(),
          customerId: command.customerId.toLowerCase(),
          productName: command.productName,
          expectedQuantityTonnes: command.expectedQuantityTonnes,
          description: command.description,
        },
        { client: savepoint },
      )
      await this.touchDischarge(command.dischargeId, savepoint)
    })
  }

  updateProductLot(
    command: ProductLotValues & { dischargeId: string; productLotId: string },
    client: TransactionClientContract,
  ) {
    return this.writeProductLot(client, async (savepoint) => {
      await ProductLot.query({ client: savepoint })
        .where('id', command.productLotId.toLowerCase())
        .where('dischargeId', command.dischargeId.toLowerCase())
        .update({
          customerId: command.customerId.toLowerCase(),
          productName: command.productName,
          expectedQuantityTonnes: command.expectedQuantityTonnes.toString(),
          description: command.description,
          updatedAt: DateTime.utc().toSQL({ includeOffset: false }),
        })
      await this.touchDischarge(command.dischargeId, savepoint)
    })
  }

  async deleteProductLot(
    command: { dischargeId: string; productLotId: string },
    client: TransactionClientContract,
  ): Promise<DeleteProductLotResult> {
    const savepoint = await client.transaction()

    try {
      await ProductLot.query({ client: savepoint })
        .where('id', command.productLotId.toLowerCase())
        .where('dischargeId', command.dischargeId.toLowerCase())
        .delete()
      await this.touchDischarge(command.dischargeId, savepoint)
      await savepoint.commit()

      return { kind: 'DELETED' }
    } catch (error) {
      await savepoint.rollback()

      if (isForeignKeyViolation(error)) {
        return { kind: 'HAS_DOOR_ASSIGNMENTS' }
      }

      throw error
    }
  }

  /** A lot change is a change of its discharge's preparation. */
  private async touchDischarge(dischargeId: string, client: TransactionClientContract) {
    await Discharge.query({ client })
      .where('id', dischargeId.toLowerCase())
      .update({ updatedAt: DateTime.utc().toSQL({ includeOffset: false }) })
  }

  /** Runs a lot write in a savepoint, so a lot identity clash leaves the transaction usable. */
  private async writeProductLot(
    client: TransactionClientContract,
    write: (savepoint: TransactionClientContract) => Promise<void>,
  ): Promise<ProductLotWriteResult> {
    const savepoint = await client.transaction()

    try {
      await write(savepoint)
      await savepoint.commit()

      return { kind: 'WRITTEN' }
    } catch (error) {
      await savepoint.rollback()

      if (isDuplicateLotIdentity(error)) {
        return { kind: 'DUPLICATE_LOT_IDENTITY' }
      }

      throw error
    }
  }
}
