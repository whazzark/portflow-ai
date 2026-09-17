import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import Discharge from '#models/discharge'
import type User from '#models/user'

import { preparer, reserveTruck, selectShiftTruck } from '../preparation/preparation_scenario.ts'
import { createStartableDischarge } from './start_scenario.ts'

type Startable = Awaited<ReturnType<typeof createStartableDischarge>>

const ROUNDS = 5

/** Removes everything a round created, children first, since no transaction rolls it back. */
async function removeRound(startables: Startable[], users: User[]) {
  const dischargeIds = startables.map((startable) => startable.discharge.id)
  const shiftIds = startables.flatMap((startable) => [startable.shift.id, startable.laterShift.id])
  const references = startables.map((startable) => startable.references)

  for (const table of ['shift_trucks', 'shift_warehouse_doors', 'shift_weighing_areas']) {
    await db.from(table).whereIn('shift_id', shiftIds).delete()
  }
  for (const table of ['warehouse_door_product_lot_assignments', 'discharge_truck_assignments']) {
    await db.from(table).whereIn('discharge_id', dischargeIds).delete()
  }
  await db.from('shifts').whereIn('id', shiftIds).delete()
  await db.from('product_lots').whereIn('discharge_id', dischargeIds).delete()
  await db.from('discharges').whereIn('id', dischargeIds).delete()
  await db
    .from('trucks')
    .whereIn(
      'id',
      startables.map((startable) => startable.truck.id),
    )
    .delete()
  await db
    .from('transport_companies')
    .whereIn(
      'id',
      startables.map((startable) => startable.truck.transportCompanyId),
    )
    .delete()
  await db
    .from('warehouse_doors')
    .whereIn(
      'id',
      references.flatMap((set) => [set.doorA1.id, set.doorA2.id, set.doorB1.id, set.doorB2.id]),
    )
    .delete()
  await db
    .from('warehouses')
    .whereIn(
      'id',
      references.flatMap((set) => [set.magasinA.id, set.magasinB.id]),
    )
    .delete()
  await db
    .from('weighing_areas')
    .whereIn(
      'id',
      references.flatMap((set) => [set.north.id, set.south.id]),
    )
    .delete()
  await db
    .from('docks')
    .whereIn(
      'id',
      startables.map((startable) => startable.dock.id),
    )
    .delete()
  await db
    .from('customers')
    .whereIn(
      'id',
      startables.flatMap((startable) => [startable.cargill.id, startable.soufflet.id]),
    )
    .delete()
  await db
    .from('users')
    .whereIn('id', [
      ...startables.map((startable) => startable.responsible.id),
      ...users.map((user) => user.id),
    ])
    .delete()
}

/**
 * Deliberately outside a global transaction: under one, both requests would share its single
 * connection, and nothing about the start's claims could be observed. Each start here commits for
 * real, and each round removes what it created.
 *
 * Under SQLite, where the suites run, the single pooled connection serializes the two requests'
 * statements, so this proves the invariant end to end — never two active discharges holding one
 * truck — rather than the lock. The lock is proven by running this file against PostgreSQL, as
 * `quickstart.md` describes.
 */
test.group('Discharge start — concurrent starts sharing a truck', () => {
  test('starts exactly one of two discharges that hold the same truck', async ({
    assert,
    client,
  }) => {
    for (let round = 0; round < ROUNDS; round += 1) {
      const first = await createStartableDischarge()
      const second = await createStartableDischarge()
      await reserveTruck(second.discharge, first.truck)
      await selectShiftTruck(second.shift, first.truck)
      const users = [await preparer(), await preparer('OPERATIONS_ADMIN')]

      try {
        const responses = await Promise.all([
          client.post(`/api/v1/discharges/${first.discharge.id}/start`).loginAs(users[0]),
          client.post(`/api/v1/discharges/${second.discharge.id}/start`).loginAs(users[1]),
        ])
        const statuses = responses.map((response) => response.status()).sort()
        const loser = responses.find((response) => response.status() !== 200)

        assert.deepEqual(statuses, [200, 409], `round ${round}`)
        assert.oneOf(loser?.body().error.code, [
          'E_DISCHARGE_START_REFUSED',
          'E_DISCHARGE_PLANNING_CONFLICT',
        ])
        const active = await Discharge.query()
          .whereIn('id', [first.discharge.id, second.discharge.id])
          .where('status', 'ACTIVE')
        assert.lengthOf(active, 1, `round ${round}`)
      } finally {
        await removeRound([first, second], users)
      }
    }
  })
})
