import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'

/**
 * The database backstops of the start confirmation: whatever reaches the tables, one dock serves at
 * most one active discharge, and one discharge has at most one active shift. Planned and closed
 * rows are never constrained, because planned discharges compete for docks by design.
 */
test.group('Active discharge and shift indexes', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('keeps a dock serving at most one active discharge', async ({ assert }) => {
    const dock = await DockFactory.create()
    await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()

    await DischargeFactory.merge({ dockId: dock.id }).create()
    await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()

    await assert.rejects(() => DischargeFactory.apply('active').merge({ dockId: dock.id }).create())
  })

  test('keeps a discharge with at most one active shift', async ({ assert }) => {
    const responsible = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    const shiftOf = (dischargeId: string, sequence: number) =>
      ShiftFactory.apply('active').merge({
        dischargeId,
        responsibleUserId: responsible.id,
        sequence,
      })
    const [first, second] = await Promise.all([DockFactory.create(), DockFactory.create()])
    const discharge = await DischargeFactory.apply('active').merge({ dockId: first.id }).create()
    const other = await DischargeFactory.apply('active').merge({ dockId: second.id }).create()

    await shiftOf(discharge.id, 1).create()
    await shiftOf(other.id, 1).create()

    await assert.rejects(() => shiftOf(discharge.id, 2).create())
  })
})
