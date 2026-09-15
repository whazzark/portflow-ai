import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import Customer from '#models/customer'
import Discharge from '#models/discharge'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import Dock from '#models/dock'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import Truck from '#models/truck'
import User from '#models/user'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'
import WeighingArea from '#models/weighing_area'
import isForeignKeyViolation from '#shared/database/is_foreign_key_violation'
import isUuid from '#shared/database/is_uuid'

import DischargePreparationRepository, {
  type CreatePlannedDischargeCommand,
  type CreatePlannedDischargeResult,
  type DeleteProductLotResult,
  type LockedTruck,
  type LockedWarehouseDoor,
  type LockedWeighingArea,
  type ProductLotValues,
  type ProductLotWriteResult,
  type ShiftTruckSelectionWriteResult,
  type TruckReservationWriteResult,
  type UpdateDischargeIdentityCommand,
  type WritePlannedShiftCorrectionCommand,
  type WriteShiftTruckSelectionCommand,
  type WriteTruckReservationsCommand,
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

/** A second pool row for one truck of one discharge, which the table's unique index forbids. */
function isDuplicatePoolTruck(error: unknown) {
  const candidate = (error ?? {}) as DatabaseError

  return (
    (candidate.code === '23505' &&
      candidate.constraint === 'discharge_truck_assignments_discharge_id_truck_id_unique') ||
    (candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      (candidate.message ?? '').includes('discharge_truck_assignments.truck_id'))
  )
}

/** A second row for one truck of one shift from the same instant, which a replay would write. */
function isDuplicateShiftTruck(error: unknown) {
  const candidate = (error ?? {}) as DatabaseError

  return (
    (candidate.code === '23505' &&
      candidate.constraint === 'shift_trucks_shift_id_truck_id_effective_from_unique') ||
    (candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      (candidate.message ?? '').includes('shift_trucks.truck_id'))
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

  async lockTrucks(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    const trucks = new Map<string, LockedTruck>()
    if (lockable.length === 0) {
      return trucks
    }

    const query = Truck.query({ client })
      .whereIn('id', lockable)
      .preload('transportCompany')
      .orderBy('id')
    query.knexQuery.forShare()

    for (const truck of await query) {
      trucks.set(truck.id.toLowerCase(), {
        id: truck.id,
        status: truck.status,
        registration: truck.registration,
        transportCompanyId: truck.transportCompanyId,
        // Every truck has a company today; the label keeps a reservation readable if one ever
        // does not, as the persisted scenarios already name it.
        transportCompanyName: truck.transportCompany?.name ?? 'Transport non référencé',
      })
    }

    return trucks
  }

  async lockWarehouseDoors(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    const doors = new Map<string, LockedWarehouseDoor>()
    if (lockable.length === 0) {
      return doors
    }

    // A door never moves to another warehouse, so its warehouse can be read before either lock.
    const containment = await WarehouseDoor.query({ client })
      .whereIn('id', lockable)
      .select('id', 'warehouseId')
    const warehouseQuery = Warehouse.query({ client })
      .whereIn('id', [...new Set(containment.map((door) => door.warehouseId))].sort())
      .orderBy('id')
    warehouseQuery.knexQuery.forShare()
    const warehouses = byId(await warehouseQuery)

    const doorQuery = WarehouseDoor.query({ client }).whereIn('id', lockable).orderBy('id')
    doorQuery.knexQuery.forShare()

    for (const door of await doorQuery) {
      doors.set(door.id.toLowerCase(), {
        id: door.id,
        status: door.status,
        warehouseStatus: warehouses.get(door.warehouseId.toLowerCase())?.status ?? 'ARCHIVED',
      })
    }

    return doors
  }

  async lockWeighingAreas(ids: string[], client: TransactionClientContract) {
    const lockable = lockableIds(ids)
    const areas = new Map<string, LockedWeighingArea>()
    if (lockable.length === 0) {
      return areas
    }

    const query = WeighingArea.query({ client }).whereIn('id', lockable).orderBy('id')
    query.knexQuery.forShare()

    for (const area of await query) {
      areas.set(area.id.toLowerCase(), { id: area.id, status: area.status })
    }

    return areas
  }

  async listTruckPool(dischargeId: string, client: TransactionClientContract) {
    const rows = await DischargeTruckAssignment.query({ client })
      .where('dischargeId', dischargeId.toLowerCase())
      .select('id', 'truckId', 'releasedAt')
      .orderBy('id')

    return rows.map((row) => ({ id: row.id, truckId: row.truckId, releasedAt: row.releasedAt }))
  }

  async listCurrentShiftTruckSelections(dischargeId: string, client: TransactionClientContract) {
    const rows = await ShiftTruck.query({ client })
      .join('shifts', 'shifts.id', 'shift_trucks.shift_id')
      .where('shifts.discharge_id', dischargeId.toLowerCase())
      .where('shifts.status', 'PLANNED')
      .whereNull('shift_trucks.effective_to')
      .select('shift_trucks.id', 'shift_trucks.shift_id', 'shift_trucks.truck_id')
      .orderBy('shift_trucks.id')

    return rows.map((row) => ({ id: row.id, shiftId: row.shiftId, truckId: row.truckId }))
  }

  async listShifts(dischargeId: string, client: TransactionClientContract) {
    const shifts = await Shift.query({ client })
      .where('dischargeId', dischargeId.toLowerCase())
      .orderBy('sequence')

    return shifts.map((shift) => ({
      id: shift.id,
      sequence: shift.sequence,
      status: shift.status,
      plannedStartAt: shift.plannedStartAt,
      plannedEndAt: shift.plannedEndAt,
      responsibleUserId: shift.responsibleUserId,
    }))
  }

  async listCurrentShiftWarehouseDoors(shiftId: string, client: TransactionClientContract) {
    const rows = await ShiftWarehouseDoor.query({ client })
      .where('shiftId', shiftId.toLowerCase())
      .whereNull('effectiveTo')
      .select('id', 'warehouseDoorId')
      .orderBy('id')

    return rows.map((row) => ({ id: row.id, resourceId: row.warehouseDoorId }))
  }

  async listCurrentShiftWeighingAreas(shiftId: string, client: TransactionClientContract) {
    const rows = await ShiftWeighingArea.query({ client })
      .where('shiftId', shiftId.toLowerCase())
      .whereNull('effectiveTo')
      .select('id', 'weighingAreaId')
      .orderBy('id')

    return rows.map((row) => ({ id: row.id, resourceId: row.weighingAreaId }))
  }

  async findShift(dischargeId: string, shiftId: string, client: TransactionClientContract) {
    if (!isUuid(shiftId)) {
      return null
    }

    const shift = await Shift.query({ client })
      .where('id', shiftId.toLowerCase())
      .where('dischargeId', dischargeId.toLowerCase())
      .select('id', 'status')
      .first()

    return shift ? { id: shift.id, status: shift.status } : null
  }

  /** In a savepoint, so a replay racing this write leaves the caller's transaction usable. */
  async writeTruckReservations(
    command: WriteTruckReservationsCommand,
    client: TransactionClientContract,
  ): Promise<TruckReservationWriteResult> {
    const savepoint = await client.transaction()

    try {
      if (command.inserts.length > 0) {
        await DischargeTruckAssignment.createMany(
          command.inserts.map((reservation) => ({
            dischargeId: command.dischargeId.toLowerCase(),
            truckId: reservation.truckId.toLowerCase(),
            registrationSnapshot: reservation.registrationSnapshot,
            transportCompanyId: reservation.transportCompanyId,
            transportCompanyNameSnapshot: reservation.transportCompanyNameSnapshot,
            reservedAt: reservation.reservedAt.toUTC(),
            releasedAt: null,
          })),
          { client: savepoint },
        )
      }
      for (const reservation of command.reactivations) {
        await DischargeTruckAssignment.query({ client: savepoint })
          .where('id', reservation.assignmentId)
          .where('dischargeId', command.dischargeId.toLowerCase())
          .update({
            registrationSnapshot: reservation.registrationSnapshot,
            transportCompanyId: reservation.transportCompanyId,
            transportCompanyNameSnapshot: reservation.transportCompanyNameSnapshot,
            reservedAt: reservation.reservedAt.toUTC().toSQL({ includeOffset: false }),
            releasedAt: null,
            updatedAt: DateTime.utc().toSQL({ includeOffset: false }),
          })
      }
      await this.touchDischarge(command.dischargeId, savepoint)
      await savepoint.commit()

      return { kind: 'WRITTEN' }
    } catch (error) {
      await savepoint.rollback()

      if (isDuplicatePoolTruck(error)) {
        return { kind: 'ALREADY_HELD' }
      }

      throw error
    }
  }

  async writeShiftTruckSelection(
    command: WriteShiftTruckSelectionCommand,
    client: TransactionClientContract,
  ): Promise<ShiftTruckSelectionWriteResult> {
    const savepoint = await client.transaction()

    try {
      if (command.deleteIds.length > 0) {
        await ShiftTruck.query({ client: savepoint })
          .whereIn('id', command.deleteIds)
          .where('shiftId', command.shiftId.toLowerCase())
          .whereNull('effectiveTo')
          .delete()
      }
      if (command.inserts.length > 0) {
        await ShiftTruck.createMany(
          command.inserts.map((selection) => ({
            shiftId: command.shiftId.toLowerCase(),
            truckId: selection.truckId.toLowerCase(),
            effectiveFrom: selection.effectiveFrom.toUTC(),
            effectiveTo: null,
          })),
          { client: savepoint },
        )
      }
      await this.touchDischarge(command.dischargeId, savepoint)
      await savepoint.commit()

      return { kind: 'WRITTEN' }
    } catch (error) {
      await savepoint.rollback()

      if (isDuplicateShiftTruck(error)) {
        return { kind: 'ALREADY_SELECTED' }
      }

      throw error
    }
  }

  async writePlannedShiftCorrection(
    command: WritePlannedShiftCorrectionCommand,
    client: TransactionClientContract,
  ) {
    const dischargeId = command.dischargeId.toLowerCase()
    const shiftId = command.shiftId.toLowerCase()
    const now = DateTime.utc().toSQL({ includeOffset: false })

    await this.renumberShifts(dischargeId, command.sequences, client)

    const [affectedRows] = await Shift.query({ client })
      .where('id', shiftId)
      .where('dischargeId', dischargeId)
      .where('status', 'PLANNED')
      .update({
        plannedStartAt: command.plannedStartAt.toUTC().toSQL({ includeOffset: false }),
        plannedEndAt: command.plannedEndAt.toUTC().toSQL({ includeOffset: false }),
        responsibleUserId: command.responsibleUserId.toLowerCase(),
        updatedAt: now,
      })

    if (affectedRows !== 1) {
      throw new Error(`Shift ${command.shiftId} changed while its discharge's lock was held`)
    }

    if (command.warehouseDoors.deleteIds.length > 0) {
      await ShiftWarehouseDoor.query({ client })
        .whereIn('id', command.warehouseDoors.deleteIds)
        .where('shiftId', shiftId)
        .whereNull('effectiveTo')
        .delete()
    }
    if (command.warehouseDoors.inserts.length > 0) {
      await ShiftWarehouseDoor.createMany(
        command.warehouseDoors.inserts.map((selection) => ({
          shiftId,
          warehouseDoorId: selection.resourceId.toLowerCase(),
          effectiveFrom: selection.effectiveFrom.toUTC(),
          effectiveTo: null,
        })),
        { client },
      )
    }
    if (command.weighingAreas.deleteIds.length > 0) {
      await ShiftWeighingArea.query({ client })
        .whereIn('id', command.weighingAreas.deleteIds)
        .where('shiftId', shiftId)
        .whereNull('effectiveTo')
        .delete()
    }
    if (command.weighingAreas.inserts.length > 0) {
      await ShiftWeighingArea.createMany(
        command.weighingAreas.inserts.map((selection) => ({
          shiftId,
          weighingAreaId: selection.resourceId.toLowerCase(),
          effectiveFrom: selection.effectiveFrom.toUTC(),
          effectiveTo: null,
        })),
        { client },
      )
    }
    await this.touchDischarge(dischargeId, client)
  }

  async deleteTruckWithdrawal(
    command: { dischargeId: string; assignmentIds: string[]; selectionIds: string[] },
    client: TransactionClientContract,
  ) {
    if (command.selectionIds.length > 0) {
      await ShiftTruck.query({ client })
        .whereIn('id', command.selectionIds)
        .whereNull('effectiveTo')
        .delete()
    }
    if (command.assignmentIds.length > 0) {
      await DischargeTruckAssignment.query({ client })
        .whereIn('id', command.assignmentIds)
        .where('dischargeId', command.dischargeId.toLowerCase())
        .whereNull('releasedAt')
        .delete()
    }
    await this.touchDischarge(command.dischargeId, client)
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

  insertProductLots(
    command: { dischargeId: string; productLots: ProductLotValues[] },
    client: TransactionClientContract,
  ) {
    return this.writeProductLot(client, async (savepoint) => {
      await ProductLot.createMany(
        command.productLots.map((productLot) => ({
          dischargeId: command.dischargeId.toLowerCase(),
          customerId: productLot.customerId.toLowerCase(),
          productName: productLot.productName,
          expectedQuantityTonnes: productLot.expectedQuantityTonnes,
          description: productLot.description,
        })),
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

  /** A lot, truck plan, or shift change is a change of its discharge's preparation. */
  private async touchDischarge(dischargeId: string, client: TransactionClientContract) {
    await Discharge.query({ client })
      .where('id', dischargeId.toLowerCase())
      .update({ updatedAt: DateTime.utc().toSQL({ includeOffset: false }) })
  }

  /**
   * Gives shifts their new sequences without ever holding two equal ones, which the unique index
   * checks row by row. The renumbered shifts are first parked above the discharge's highest
   * sequence, where no shift can be, and only then take their final numbers: those never exceed the
   * number of shifts, so they cannot meet a parked one, nor a shift whose number did not change.
   */
  private async renumberShifts(
    dischargeId: string,
    sequences: WritePlannedShiftCorrectionCommand['sequences'],
    client: TransactionClientContract,
  ) {
    if (sequences.length === 0) {
      return
    }

    const shiftIds = sequences.map((change) => change.shiftId.toLowerCase())
    const highest = await client
      .from('shifts')
      .where('discharge_id', dischargeId)
      .max('sequence as sequence')
      .first()
    const parking = Number(highest?.sequence ?? 0)

    await client
      .from('shifts')
      .where('discharge_id', dischargeId)
      .whereIn('id', shiftIds)
      .update({ sequence: client.raw('sequence + ?', [parking]) })
    for (const change of sequences) {
      await client
        .from('shifts')
        .where('discharge_id', dischargeId)
        .where('id', change.shiftId.toLowerCase())
        .update({
          sequence: change.sequence,
          updated_at: DateTime.utc().toSQL({ includeOffset: false }),
        })
    }
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
