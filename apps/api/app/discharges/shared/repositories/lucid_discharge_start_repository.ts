import type { QueryClientContract, TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import type { StartHolder } from '#discharges/start/discharge_start_rules'
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
import isUuid from '#shared/database/is_uuid'

import DischargeStartRepository, {
  type ActivationResult,
  type StartHolders,
  type StartReadMode,
  type StartReferenceIds,
  type StartReferences,
} from './discharge_start_repository.ts'

/** Distinct, well-formed, lower-case identities, in the order every lock is taken: by identity. */
function lockableIds(ids: string[]) {
  return [...new Set(ids.filter((id) => isUuid(id)).map((id) => id.toLowerCase()))].sort()
}

const lower = (id: string) => id.toLowerCase()

type LockableQuery = { knexQuery: { forShare(): unknown; forNoKeyUpdate(): unknown } }

/** A shared reference only has to stay as it is; an exclusive one is claimed against other starts. */
function lock(query: LockableQuery, mode: StartReadMode, strength: 'SHARE' | 'CLAIM') {
  if (mode === 'READ') {
    return
  }
  if (strength === 'SHARE') {
    query.knexQuery.forShare()
  } else {
    query.knexQuery.forNoKeyUpdate()
  }
}

type DatabaseError = { code?: string; constraint?: string; message?: string }

/**
 * The active-row indexes an activation can trip. Postgres names the index; SQLite names only the
 * column, which no other unique index on these tables has on its own.
 */
const ACTIVE_ROW_INDEXES = [
  { name: 'discharges_active_dock_unique', columns: 'discharges.dock_id' },
  { name: 'shifts_active_per_discharge_unique', columns: 'shifts.discharge_id' },
] as const

function isActiveRowConflict(error: unknown) {
  const candidate = (error ?? {}) as DatabaseError

  if (candidate.code === '23505') {
    return ACTIVE_ROW_INDEXES.some((index) => index.name === candidate.constraint)
  }

  return (
    candidate.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    ACTIVE_ROW_INDEXES.some((index) =>
      (candidate.message ?? '').endsWith(`UNIQUE constraint failed: ${index.columns}`),
    )
  )
}

function holderMap(
  rows: Array<{ resource_id: string; discharge_id: string; vessel_name: string }>,
) {
  const holders = new Map<string, StartHolder>()

  // Rows come ordered by discharge identity, so the holder named is the same on every read.
  for (const row of rows) {
    const key = lower(row.resource_id)
    if (!holders.has(key)) {
      holders.set(key, { dischargeId: row.discharge_id, vesselName: row.vessel_name })
    }
  }

  return holders
}

export default class LucidDischargeStartRepository extends DischargeStartRepository {
  async findDischarge(id: string, client: QueryClientContract) {
    if (!isUuid(id)) {
      return null
    }

    const discharge = await Discharge.query({ client })
      .where('id', lower(id))
      .select('id', 'status', 'dockId')
      .first()

    return discharge
      ? { id: discharge.id, status: discharge.status, dockId: discharge.dockId }
      : null
  }

  async readStartPlan(dischargeId: string, client: QueryClientContract) {
    const id = lower(dischargeId)
    const lots = await ProductLot.query({ client })
      .select('product_lots.id', 'product_lots.customer_id')
      .join('customers', 'customers.id', 'product_lots.customer_id')
      .where('product_lots.discharge_id', id)
      .orderBy('customers.company_name', 'asc')
      .orderBy('product_lots.product_name', 'asc')
      .orderBy('product_lots.id', 'asc')
    const assignments = await WarehouseDoorProductLotAssignment.query({ client })
      .where('dischargeId', id)
      .whereNull('effectiveTo')
      .select('productLotId', 'warehouseDoorId')
      .orderBy('effective_from', 'asc')
      .orderBy('id', 'asc')
    const pool = await DischargeTruckAssignment.query({ client })
      .where('dischargeId', id)
      .whereNull('releasedAt')
      .select('truckId')
      .orderBy('registration_snapshot', 'asc')
      .orderBy('id', 'asc')
    const shift = await Shift.query({ client })
      .where('dischargeId', id)
      .where('status', 'PLANNED')
      .select('id', 'responsibleUserId')
      .orderBy('planned_start_at', 'asc')
      .orderBy('sequence', 'asc')
      .first()

    return {
      lots: lots.map((lot) => ({ id: lower(lot.id), customerId: lower(lot.customerId) })),
      currentAssignments: assignments.map((assignment) => ({
        productLotId: lower(assignment.productLotId),
        warehouseDoorId: lower(assignment.warehouseDoorId),
      })),
      heldTruckIds: pool.map((row) => lower(row.truckId)),
      firstShift: shift ? await this.readShiftSelections(shift, client) : null,
    }
  }

  async readReferences(
    ids: StartReferenceIds,
    mode: StartReadMode,
    client: QueryClientContract,
  ): Promise<StartReferences> {
    const dockQuery = Dock.query({ client }).where('id', lower(ids.dockId)).select('id', 'status')
    lock(dockQuery, mode, 'CLAIM')
    const dock = await dockQuery.firstOrFail()

    const customerIds = lockableIds(ids.customerIds)
    const customerQuery = Customer.query({ client })
      .whereIn('id', customerIds)
      .select('id', 'status')
      .orderBy('id')
    lock(customerQuery, mode, 'SHARE')
    const customers = customerIds.length > 0 ? await customerQuery : []

    const userIds = lockableIds(ids.userIds)
    const userQuery = User.query({ client })
      .whereIn('id', userIds)
      .select('id', 'accessStatus', 'role')
      .orderBy('id')
    lock(userQuery, mode, 'SHARE')
    const users = userIds.length > 0 ? await userQuery : []

    const truckIds = lockableIds(ids.truckIds)
    const truckQuery = Truck.query({ client })
      .whereIn('id', truckIds)
      .select('id', 'status')
      .orderBy('id')
    lock(truckQuery, mode, 'CLAIM')
    const trucks = truckIds.length > 0 ? await truckQuery : []

    const warehouseDoors = await this.readWarehouseDoors(ids.warehouseDoorIds, mode, client)

    const areaIds = lockableIds(ids.weighingAreaIds)
    const areaQuery = WeighingArea.query({ client })
      .whereIn('id', areaIds)
      .select('id', 'status')
      .orderBy('id')
    lock(areaQuery, mode, 'SHARE')
    const weighingAreas = areaIds.length > 0 ? await areaQuery : []

    return {
      dock: { id: lower(dock.id), status: dock.status },
      customers: new Map(customers.map((customer) => [lower(customer.id), customer.status])),
      users: new Map(
        users.map((user) => [lower(user.id), { accessStatus: user.accessStatus, role: user.role }]),
      ),
      trucks: new Map(trucks.map((truck) => [lower(truck.id), truck.status])),
      warehouseDoors,
      weighingAreas: new Map(weighingAreas.map((area) => [lower(area.id), area.status])),
    }
  }

  async findActiveHolders(
    query: { dischargeId: string; dockId: string; truckIds: string[]; warehouseDoorIds: string[] },
    client: QueryClientContract,
  ): Promise<StartHolders> {
    const dischargeId = lower(query.dischargeId)
    const dock = await Discharge.query({ client })
      .where('dockId', lower(query.dockId))
      .where('status', 'ACTIVE')
      .whereNot('id', dischargeId)
      .select('id', 'vesselName')
      .orderBy('id')
      .first()

    const truckIds = lockableIds(query.truckIds)
    const trucks =
      truckIds.length === 0
        ? []
        : await client
            .from('discharge_truck_assignments')
            .join('discharges', 'discharges.id', 'discharge_truck_assignments.discharge_id')
            .whereIn('discharge_truck_assignments.truck_id', truckIds)
            .whereNull('discharge_truck_assignments.released_at')
            .where('discharges.status', 'ACTIVE')
            .whereNot('discharges.id', dischargeId)
            .select(
              'discharge_truck_assignments.truck_id as resource_id',
              'discharges.id as discharge_id',
              'discharges.vessel_name as vessel_name',
            )
            .orderBy('discharges.id')

    const doorIds = lockableIds(query.warehouseDoorIds)
    const doors =
      doorIds.length === 0
        ? []
        : await client
            .from('warehouse_door_product_lot_assignments')
            .join(
              'discharges',
              'discharges.id',
              'warehouse_door_product_lot_assignments.discharge_id',
            )
            .whereIn('warehouse_door_product_lot_assignments.warehouse_door_id', doorIds)
            .whereNull('warehouse_door_product_lot_assignments.effective_to')
            .where('discharges.status', 'ACTIVE')
            .whereNot('discharges.id', dischargeId)
            .select(
              'warehouse_door_product_lot_assignments.warehouse_door_id as resource_id',
              'discharges.id as discharge_id',
              'discharges.vessel_name as vessel_name',
            )
            .orderBy('discharges.id')

    return {
      dock: dock ? { dischargeId: dock.id, vesselName: dock.vesselName } : null,
      trucks: holderMap(trucks),
      doors: holderMap(doors),
    }
  }

  async activate(
    command: { dischargeId: string; shiftId: string; userId: string; instant: DateTime },
    client: TransactionClientContract,
  ): Promise<ActivationResult> {
    const instant = command.instant.toUTC().toSQL({ includeOffset: false })
    const savepoint = await client.transaction()

    try {
      await Discharge.query({ client: savepoint })
        .where('id', lower(command.dischargeId))
        .where('status', 'PLANNED')
        .update({
          status: 'ACTIVE',
          startedAt: instant,
          startedByUserId: lower(command.userId),
          updatedAt: instant,
        })
      await Shift.query({ client: savepoint })
        .where('id', lower(command.shiftId))
        .where('dischargeId', lower(command.dischargeId))
        .where('status', 'PLANNED')
        .update({
          status: 'ACTIVE',
          actualStartAt: instant,
          startedByUserId: lower(command.userId),
          updatedAt: instant,
        })
      await savepoint.commit()

      return { kind: 'ACTIVATED' }
    } catch (error) {
      await savepoint.rollback()

      if (isActiveRowConflict(error)) {
        return { kind: 'ACTIVE_ROW_CONFLICT' }
      }

      throw error
    }
  }

  private async readShiftSelections(
    shift: { id: string; responsibleUserId: string },
    client: QueryClientContract,
  ) {
    const shiftId = lower(shift.id)
    // By name, then identity: the order problems about the shift's resources are listed in.
    const [trucks, doors, areas] = [
      await ShiftTruck.query({ client })
        .join('trucks', 'trucks.id', 'shift_trucks.truck_id')
        .where('shift_trucks.shift_id', shiftId)
        .whereNull('shift_trucks.effective_to')
        .select('shift_trucks.truck_id')
        .orderByRaw('LOWER(trucks.registration) ASC')
        .orderBy('trucks.id', 'asc'),
      await ShiftWarehouseDoor.query({ client })
        .join('warehouse_doors', 'warehouse_doors.id', 'shift_warehouse_doors.warehouse_door_id')
        .join('warehouses', 'warehouses.id', 'warehouse_doors.warehouse_id')
        .where('shift_warehouse_doors.shift_id', shiftId)
        .whereNull('shift_warehouse_doors.effective_to')
        .select('shift_warehouse_doors.warehouse_door_id')
        .orderByRaw('LOWER(warehouses.name) ASC')
        .orderByRaw('LOWER(warehouse_doors.name) ASC')
        .orderBy('warehouse_doors.id', 'asc'),
      await ShiftWeighingArea.query({ client })
        .join('weighing_areas', 'weighing_areas.id', 'shift_weighing_areas.weighing_area_id')
        .where('shift_weighing_areas.shift_id', shiftId)
        .whereNull('shift_weighing_areas.effective_to')
        .select('shift_weighing_areas.weighing_area_id')
        .orderByRaw('LOWER(weighing_areas.name) ASC')
        .orderBy('weighing_areas.id', 'asc'),
    ]

    return {
      id: shiftId,
      responsibleUserId: lower(shift.responsibleUserId),
      truckIds: trucks.map((row) => lower(row.truckId)),
      warehouseDoorIds: doors.map((row) => lower(row.warehouseDoorId)),
      weighingAreaIds: areas.map((row) => lower(row.weighingAreaId)),
    }
  }

  /**
   * Doors with their warehouse's status. A door never moves to another warehouse, so its warehouse
   * is read before either lock; the warehouses are locked before the doors, as a door or warehouse
   * archive locks them.
   */
  private async readWarehouseDoors(
    ids: string[],
    mode: StartReadMode,
    client: QueryClientContract,
  ) {
    const doorIds = lockableIds(ids)
    const doors = new Map<
      string,
      { status: WarehouseDoor['status']; warehouseStatus: Warehouse['status'] }
    >()
    if (doorIds.length === 0) {
      return doors
    }

    const containment = await WarehouseDoor.query({ client })
      .whereIn('id', doorIds)
      .select('id', 'warehouseId')
    const warehouseQuery = Warehouse.query({ client })
      .whereIn('id', [...new Set(containment.map((door) => lower(door.warehouseId)))].sort())
      .select('id', 'status')
      .orderBy('id')
    lock(warehouseQuery, mode, 'SHARE')
    const warehouses = new Map(
      (await warehouseQuery).map((warehouse) => [lower(warehouse.id), warehouse.status]),
    )

    const doorQuery = WarehouseDoor.query({ client })
      .whereIn('id', doorIds)
      .select('id', 'status', 'warehouseId')
      .orderBy('id')
    lock(doorQuery, mode, 'CLAIM')

    for (const door of await doorQuery) {
      doors.set(lower(door.id), {
        status: door.status,
        warehouseStatus: warehouses.get(lower(door.warehouseId)) ?? 'ARCHIVED',
      })
    }

    return doors
  }
}
