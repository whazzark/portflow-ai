import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import Dock from '#models/dock'
import ShiftWeighingArea from '#models/shift_weighing_area'
import User from '#models/user'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

import { preparer } from '../preparation/preparation_scenario.ts'
import { createStartableDischarge, planRows, startRows } from './start_scenario.ts'

type Startable = Awaited<ReturnType<typeof createStartableDischarge>>
type Problem = { family: string; code: string; subject: { id: string } }

/**
 * One representative refusal per family, each written around the guards that normally keep it out
 * of a planned discharge, so the start is the last line that holds. Active-discharge conflicts are
 * covered by `start_conflicts.spec.ts`.
 */
const CASES: Array<{
  name: string
  break: (startable: Startable) => Promise<unknown>
  expected: (startable: Startable) => Array<Pick<Problem, 'code'> & { id: string }>
}> = [
  {
    name: 'an incomplete preparation',
    break: async ({ barley, shift }) => {
      await WarehouseDoorProductLotAssignment.query().where('productLotId', barley.id).delete()
      await ShiftWeighingArea.query().where('shiftId', shift.id).delete()
    },
    expected: ({ barley, shift }) => [
      { code: 'LOT_WITHOUT_WAREHOUSE_DOOR', id: barley.id },
      { code: 'SHIFT_WITHOUT_WEIGHING_AREA', id: shift.id },
    ],
  },
  {
    name: 'an archived dock',
    break: ({ dock }) =>
      Dock.query()
        .where('id', dock.id)
        .update({ status: 'ARCHIVED', archivedAt: new Date().toISOString() }),
    expected: ({ dock }) => [{ code: 'DOCK_ARCHIVED', id: dock.id }],
  },
  {
    name: 'an ineligible responsible',
    break: ({ responsible }) =>
      User.query().where('id', responsible.id).update({ accessStatus: 'DEACTIVATED' }),
    expected: ({ responsible }) => [{ code: 'RESPONSIBLE_INELIGIBLE', id: responsible.id }],
  },
]

test.group('Discharge start refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  for (const refusal of CASES) {
    test(`refuses ${refusal.name} with the same problems the check lists, changing nothing`, async ({
      assert,
      client,
    }) => {
      const startable = await createStartableDischarge()
      await refusal.break(startable)
      const user = await preparer()
      const before = {
        started: await startRows(startable.discharge.id),
        plan: await planRows(startable.discharge.id),
      }
      const summary = (problems: Problem[]) =>
        problems.map((problem) => ({ code: problem.code, id: problem.subject.id }))

      const check = await client
        .get(`/api/v1/discharges/${startable.discharge.id}/start-check`)
        .loginAs(user)
      const start = await client
        .post(`/api/v1/discharges/${startable.discharge.id}/start`)
        .loginAs(user)

      check.assertStatus(200)
      start.assertStatus(409)
      assert.equal(start.body().error.code, 'E_DISCHARGE_START_REFUSED')
      assert.deepEqual(summary(start.body().error.meta.problems), refusal.expected(startable))
      assert.deepEqual(check.body().data.problems, start.body().error.meta.problems)
      assert.deepEqual(
        {
          started: await startRows(startable.discharge.id),
          plan: await planRows(startable.discharge.id),
        },
        before,
      )
    })
  }
})
