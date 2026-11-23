import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'
import ListDockOccupancyUseCase from '#discharges/dock_occupancy/list_dock_occupancy_use_case'
import DockOccupancyTransformer from '#discharges/shared/dock_occupancy_transformer'
import type Discharge from '#models/discharge'

async function listDockOccupancy(dockId: string) {
  return (await app.container.make(ListDockOccupancyUseCase)).handle({ dockId })
}

async function planShift(
  discharge: Discharge,
  sequence: number,
  start: DateTime,
  hours: number,
  state?: 'active' | 'completed',
) {
  const responsible = await UserFactory.apply('active').create()
  const factory = state ? ShiftFactory.apply(state) : ShiftFactory

  return factory
    .merge({
      dischargeId: discharge.id,
      sequence,
      plannedStartAt: start,
      plannedEndAt: start.plus({ hours }),
      responsibleUserId: responsible.id,
    })
    .create()
}

test.group('Dock occupancy repository', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('answers the planned and active discharges of the dock only', async ({ assert }) => {
    const dock = await DockFactory.create()
    const otherDock = await DockFactory.create()
    const start = DateTime.utc(2026, 9, 20, 6)
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const active = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const closed = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    const elsewhere = await DischargeFactory.merge({ dockId: otherDock.id }).create()
    for (const discharge of [planned, active, closed, elsewhere]) {
      await planShift(discharge, 1, start, 8)
    }

    const occupancy = await listDockOccupancy(dock.id)

    assert.sameMembers(
      occupancy.map((item) => item.discharge.id),
      [planned.id, active.id],
    )
  })

  test('omits a discharge without any shift', async ({ assert }) => {
    const dock = await DockFactory.create()
    await DischargeFactory.merge({ dockId: dock.id }).create()

    assert.deepEqual(await listDockOccupancy(dock.id), [])
  })

  test('spans the earliest planned start to the latest planned end of every shift', async ({
    assert,
  }) => {
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    await planShift(discharge, 1, DateTime.utc(2026, 9, 18, 6), 8, 'completed')
    await planShift(discharge, 2, DateTime.utc(2026, 9, 18, 14), 8, 'active')
    await planShift(discharge, 3, DateTime.utc(2026, 9, 19, 22), 8)

    const [item] = await listDockOccupancy(dock.id)

    assert.equal(item.startAt.toUTC().toISO(), '2026-09-18T06:00:00.000Z')
    assert.equal(item.endAt.toUTC().toISO(), '2026-09-20T06:00:00.000Z')
    assert.deepEqual(item.discharge, {
      id: discharge.id,
      vesselName: discharge.vesselName,
      status: 'ACTIVE',
    })
  })

  test('orders by start, then by discharge identity', async ({ assert }) => {
    const dock = await DockFactory.create()
    const late = await DischargeFactory.merge({ dockId: dock.id }).create()
    const early = await DischargeFactory.merge({ dockId: dock.id }).create()
    const tiedA = await DischargeFactory.merge({ dockId: dock.id }).create()
    const tiedB = await DischargeFactory.merge({ dockId: dock.id }).create()
    await planShift(late, 1, DateTime.utc(2026, 9, 25, 6), 8)
    await planShift(early, 1, DateTime.utc(2026, 9, 20, 6), 8)
    await planShift(tiedA, 1, DateTime.utc(2026, 9, 22, 6), 8)
    await planShift(tiedB, 1, DateTime.utc(2026, 9, 22, 6), 8)
    const tied = [tiedA.id, tiedB.id].sort()

    const occupancy = await listDockOccupancy(dock.id)

    assert.deepEqual(
      occupancy.map((item) => item.discharge.id),
      [early.id, ...tied, late.id],
    )
  })

  test('answers nothing for an unknown dock', async ({ assert }) => {
    assert.deepEqual(await listDockOccupancy('00000000-0000-4000-8000-000000000000'), [])
  })
})

test.group('Dock occupancy transformer', () => {
  test('serializes the contract fields only, instants as ISO strings', ({ assert }) => {
    const item = {
      discharge: { id: 'discharge-id', vesselName: 'MV Nordic Breeze', status: 'PLANNED' as const },
      startAt: DateTime.utc(2026, 9, 18, 6),
      endAt: DateTime.utc(2026, 9, 20, 14),
    }

    assert.deepEqual(new DockOccupancyTransformer(item).toObject(), {
      discharge: { id: 'discharge-id', vesselName: 'MV Nordic Breeze', status: 'PLANNED' },
      startAt: '2026-09-18T06:00:00.000Z',
      endAt: '2026-09-20T14:00:00.000Z',
    })
  })
})
