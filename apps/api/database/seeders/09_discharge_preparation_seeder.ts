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

async function createFixture(
  // biome-ignore lint/suspicious/noExplicitAny: shared Lucid factory contract
  factory: any,
  fixture: { id: string; attributes: object },
  // biome-ignore lint/suspicious/noExplicitAny: shared Lucid transaction contract
  trx: any,
) {
  await factory
    .client(trx)
    .merge({ id: fixture.id, ...fixture.attributes })
    .create()
}

/** Rows of a fixture discharge's plan, children first, so a new seed replaces the previous plan. */
// biome-ignore lint/suspicious/noExplicitAny: shared Lucid transaction contract
async function deletePlan(dischargeId: string, trx: any) {
  const shiftIds = trx.from('shifts').select('id').where('discharge_id', dischargeId)
  for (const table of ['shift_trucks', 'shift_warehouse_doors', 'shift_weighing_areas']) {
    await trx.from(table).whereIn('shift_id', shiftIds).delete()
  }
  for (const table of [
    'shifts',
    'warehouse_door_product_lot_assignments',
    'discharge_truck_assignments',
    'product_lots',
  ]) {
    await trx.from(table).where('discharge_id', dischargeId).delete()
  }
}

// The fixtures carry every status and date, so the factories are used without their states, which
// would otherwise overwrite them.
const plan = [
  ['productLots', ProductLotFactory],
  ['truckAssignments', DischargeTruckAssignmentFactory],
  ['shifts', ShiftFactory],
  ['doorAssignments', WarehouseDoorProductLotAssignmentFactory],
  ['shiftTrucks', ShiftTruckFactory],
  ['shiftWarehouseDoors', ShiftWarehouseDoorFactory],
  ['shiftWeighingAreas', ShiftWeighingAreaFactory],
] as const

export default class DischargePreparationSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    for (const fixture of DISCHARGE_PREPARATION_FIXTURES) {
      await db.transaction(async (trx) => {
        await persistFixture(Discharge, DischargeFactory, fixture.discharge, trx)
        await deletePlan(fixture.discharge.id, trx)
        for (const [key, factory] of plan) {
          for (const item of fixture[key]) {
            await createFixture(factory, item, trx)
          }
        }
      })
    }
  }
}
