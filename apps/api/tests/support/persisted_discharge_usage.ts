import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { ShiftWeighingAreaFactory } from '#database/factories/shift_resource_membership_factories'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import type { DischargeStatus } from '#models/discharge'

export type PersistedUsageScenario = Awaited<ReturnType<typeof createPersistedUsageScenario>>

export type PersistedUsageScenarioOptions = {
  status?: DischargeStatus
  weighingAreaEnded?: boolean
  warehouseDoorAssignmentEnded?: boolean
  truckReservationReleased?: boolean
}

export async function createPersistedUsageScenario({
  status = 'PLANNED',
  weighingAreaEnded = false,
  warehouseDoorAssignmentEnded = false,
  truckReservationReleased = false,
}: PersistedUsageScenarioOptions = {}) {
  const [customer, dock, weighingArea, warehouse, user, truck] = await Promise.all([
    CustomerFactory.create(),
    DockFactory.create(),
    WeighingAreaFactory.create(),
    WarehouseFactory.create(),
    UserFactory.apply('active').create(),
    TruckFactory.create(),
  ])
  const warehouseDoor = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()
  const discharge = await DischargeFactory.merge({ dockId: dock.id, status }).create()
  const productLot = await ProductLotFactory.merge({
    dischargeId: discharge.id,
    customerId: customer.id,
  }).create()
  const shift = await ShiftFactory.merge({
    dischargeId: discharge.id,
    responsibleUserId: user.id,
  }).create()
  const effectiveFrom = DateTime.now().minus({ hours: 2 })
  const effectiveTo = effectiveFrom.plus({ hours: 1 })

  const weighingAreaMembership = await ShiftWeighingAreaFactory.merge({
    shiftId: shift.id,
    weighingAreaId: weighingArea.id,
    effectiveFrom,
    effectiveTo: weighingAreaEnded ? effectiveTo : null,
  }).create()
  const warehouseDoorAssignment = await WarehouseDoorProductLotAssignmentFactory.merge({
    dischargeId: discharge.id,
    warehouseDoorId: warehouseDoor.id,
    productLotId: productLot.id,
    effectiveFrom,
    effectiveTo: warehouseDoorAssignmentEnded ? effectiveTo : null,
  }).create()
  const truckReservation = await DischargeTruckAssignmentFactory.merge({
    dischargeId: discharge.id,
    truckId: truck.id,
    reservedAt: effectiveFrom,
    releasedAt: truckReservationReleased ? effectiveTo : null,
  }).create()

  return {
    customer,
    dock,
    weighingArea,
    warehouse,
    warehouseDoor,
    truck,
    user,
    discharge,
    productLot,
    shift,
    weighingAreaMembership,
    warehouseDoorAssignment,
    truckReservation,
  }
}
