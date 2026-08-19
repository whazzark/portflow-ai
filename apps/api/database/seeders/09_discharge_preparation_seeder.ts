import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import {
  ShiftTruckFactory,
  ShiftWarehouseDoorFactory,
  ShiftWeighingAreaFactory,
} from '#database/factories/shift_resource_membership_factories'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { DISCHARGE_PREPARATION_FIXTURES } from '#database/fixtures/discharge_preparation'
import Discharge from '#models/discharge'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

async function persistFixture(
  // biome-ignore lint/suspicious/noExplicitAny: shared Lucid model contract
  model: any,
  // biome-ignore lint/suspicious/noExplicitAny: shared Lucid factory contract
  factory: any,
  fixture: { id: string; attributes: object },
  // biome-ignore lint/suspicious/noExplicitAny: shared Lucid transaction contract
  trx: any,
) {
  const candidate = await factory
    .client(trx)
    .merge({ id: fixture.id, ...fixture.attributes })
    .make()
  candidate.useTransaction(trx)
  const existing = await model.query({ client: trx }).where('id', fixture.id).first()
  if (existing) {
    existing.merge(candidate.$attributes)
    await existing.save()
    return existing
  }
  await candidate.save()
  return candidate
}

export default class DischargePreparationSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of DISCHARGE_PREPARATION_FIXTURES) {
      await db.transaction(async (trx) => {
        const dischargeFactory =
          fixture.discharge.state === 'planned'
            ? DischargeFactory
            : DischargeFactory.apply(fixture.discharge.state)
        await persistFixture(Discharge, dischargeFactory, fixture.discharge, trx)
        for (const item of fixture.productLots) {
          await persistFixture(ProductLot, ProductLotFactory, item, trx)
        }
        for (const item of fixture.truckAssignments) {
          const factory =
            item.state === 'released'
              ? DischargeTruckAssignmentFactory.apply('released')
              : DischargeTruckAssignmentFactory
          await persistFixture(DischargeTruckAssignment, factory, item, trx)
        }
        for (const item of fixture.shifts) {
          const factory = item.state === 'planned' ? ShiftFactory : ShiftFactory.apply(item.state)
          await persistFixture(Shift, factory, item, trx)
        }
        for (const item of fixture.doorAssignments) {
          await persistFixture(
            WarehouseDoorProductLotAssignment,
            WarehouseDoorProductLotAssignmentFactory,
            item,
            trx,
          )
        }
        for (const item of fixture.shiftTrucks) {
          await persistFixture(ShiftTruck, ShiftTruckFactory, item, trx)
        }
        for (const item of fixture.shiftWarehouseDoors) {
          await persistFixture(ShiftWarehouseDoor, ShiftWarehouseDoorFactory, item, trx)
        }
        for (const item of fixture.shiftWeighingAreas) {
          await persistFixture(ShiftWeighingArea, ShiftWeighingAreaFactory, item, trx)
        }
      })
    }
  }
}
