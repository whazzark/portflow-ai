import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'
import ListDischargesUseCase from '#discharges/list/list_discharges_use_case'

async function listDischarges() {
  return (await app.container.make(ListDischargesUseCase)).handle()
}

test.group('Discharge consultation repository', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('returns every status in one collection', async ({ assert }) => {
    const dock = await DockFactory.create()
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const active = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const closed = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()

    const discharges = await listDischarges()
    const byId = new Map(discharges.map((discharge) => [discharge.id, discharge.status]))

    assert.equal(byId.get(planned.id), 'PLANNED')
    assert.equal(byId.get(active.id), 'ACTIVE')
    assert.equal(byId.get(closed.id), 'CLOSED')
  })

  test('orders by expected start ascending with a stable identity tie-breaker', async ({
    assert,
  }) => {
    const dock = await DockFactory.create()
    const sharedStart = DateTime.utc(2026, 5, 2, 8)
    const late = await DischargeFactory.merge({
      dockId: dock.id,
      expectedStartAt: DateTime.utc(2026, 9, 1, 8),
    }).create()
    const [tiedFirst, tiedSecond] = await DischargeFactory.merge([
      { dockId: dock.id, expectedStartAt: sharedStart },
      { dockId: dock.id, expectedStartAt: sharedStart },
    ]).createMany(2)

    const discharges = await listDischarges()
    const seeded = new Set([late.id, tiedFirst.id, tiedSecond.id])
    const ordered = discharges
      .filter((discharge) => seeded.has(discharge.id))
      .map((discharge) => discharge.id)
    const expectedTieOrder = [tiedFirst.id, tiedSecond.id].sort()

    assert.deepEqual(ordered, [...expectedTieOrder, late.id])
  })

  test('exposes the dock, the product lots with their customers, and the shift count', async ({
    assert,
  }) => {
    const dock = await DockFactory.merge({ name: 'Quai Nord' }).create()
    const customer = await CustomerFactory.merge({ companyName: 'Compagnie Céréalière' }).create()
    const responsible = await UserFactory.apply('active').create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()
    await ProductLotFactory.merge({
      customerId: customer.id,
      dischargeId: discharge.id,
      productName: 'Blé tendre',
    }).create()
    await ShiftFactory.merge([
      { dischargeId: discharge.id, responsibleUserId: responsible.id, sequence: 1 },
      { dischargeId: discharge.id, responsibleUserId: responsible.id, sequence: 2 },
    ]).createMany(2)

    const discharges = await listDischarges()
    const found = discharges.find((candidate) => candidate.id === discharge.id)

    assert.equal(found?.dock.name, 'Quai Nord')
    assert.lengthOf(found?.productLots ?? [], 1)
    assert.equal(found?.productLots[0].productName, 'Blé tendre')
    assert.equal(found?.productLots[0].customer.companyName, 'Compagnie Céréalière')
    assert.equal(Number(found?.$extras.shifts_count), 2)
  })

  test('counts shifts of every status, not only planned ones', async ({ assert }) => {
    const dock = await DockFactory.create()
    const responsible = await UserFactory.apply('active').create()
    const discharge = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    await ShiftFactory.apply('completed')
      .merge([
        { dischargeId: discharge.id, responsibleUserId: responsible.id, sequence: 1 },
        { dischargeId: discharge.id, responsibleUserId: responsible.id, sequence: 2 },
      ])
      .createMany(2)

    const discharges = await listDischarges()
    const found = discharges.find((candidate) => candidate.id === discharge.id)

    assert.equal(Number(found?.$extras.shifts_count), 2)
  })

  test('keeps a discharge readable when the dock it uses has been archived', async ({ assert }) => {
    const dock = await DockFactory.apply('archived').merge({ name: 'Quai Retiré' }).create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()

    const discharges = await listDischarges()
    const found = discharges.find((candidate) => candidate.id === discharge.id)

    assert.equal(found?.dock.name, 'Quai Retiré')
    assert.equal(found?.dock.status, 'ARCHIVED')
  })

  test('returns a discharge with no product lot and no shift as an empty preparation', async ({
    assert,
  }) => {
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()

    const discharges = await listDischarges()
    const found = discharges.find((candidate) => candidate.id === discharge.id)

    assert.isEmpty(found?.productLots ?? [])
    assert.equal(Number(found?.$extras.shifts_count), 0)
  })
})
