import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import {
  ShiftNotFoundException,
  ShiftNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import SelectShiftTrucksUseCase from '#discharges/truck_pool/select_shift_trucks_use_case'
import type { ShiftStatus } from '#models/shift'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const SHIFT_ID = '88888888-8888-4888-8888-888888888888'
const OTHER_SHIFT_ID = '99999999-9999-4999-8999-999999999999'
const KEPT = '55555555-5555-4555-8555-555555555555'
const ADDED = '66666666-6666-4666-8666-666666666666'
const UNHELD = '77777777-7777-4777-8777-777777777777'

function stubRepositories({ shiftStatus = 'PLANNED' }: { shiftStatus?: ShiftStatus | null } = {}) {
  const calls: string[] = []
  const writes: unknown[] = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve({ id: DISCHARGE_ID, status: 'PLANNED' })
        },
        findShift: () => {
          calls.push('findShift')
          return Promise.resolve(shiftStatus ? { id: SHIFT_ID, status: shiftStatus } : null)
        },
        listTruckPool: () => {
          calls.push('listTruckPool')
          return Promise.resolve([
            { id: 'pool-kept', truckId: KEPT, releasedAt: null },
            { id: 'pool-added', truckId: ADDED, releasedAt: null },
          ])
        },
        listCurrentShiftTruckSelections: () => {
          calls.push('listCurrentShiftTruckSelections')
          return Promise.resolve([
            { id: 'row-kept', shiftId: SHIFT_ID, truckId: KEPT },
            { id: 'row-other-shift', shiftId: OTHER_SHIFT_ID, truckId: ADDED },
          ])
        },
        lockTrucks: (ids: string[]) => {
          calls.push(`lockTrucks:${ids.join(',')}`)
          return Promise.resolve(
            new Map(ids.map((id) => [id, { id, status: 'AVAILABLE', registration: id }])),
          )
        },
        writeShiftTruckSelection: (command: unknown) => {
          calls.push('writeShiftTruckSelection')
          writes.push(command)
          return Promise.resolve({ kind: 'WRITTEN' })
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () =>
      ({
        findDetail: () =>
          Promise.resolve({ discharge: { id: DISCHARGE_ID }, otherHoldings: new Map() }),
      }) as unknown as DischargeRepository,
  )

  return { calls, writes }
}

test.group('Select shift trucks use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge, reads the shift and its pool, locks only the added trucks, then writes', async ({
    assert,
  }) => {
    const { calls, writes } = stubRepositories()
    const useCase = await app.container.make(SelectShiftTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, shiftId: SHIFT_ID, truckIds: [KEPT, ADDED] })

    assert.deepEqual(calls, [
      'lockDischarge',
      'findShift',
      'listTruckPool',
      'listCurrentShiftTruckSelections',
      `lockTrucks:${ADDED}`,
      'writeShiftTruckSelection',
    ])
    assert.containsSubset(writes[0], { shiftId: SHIFT_ID, deleteIds: [] })
  })

  test('refuses an unknown or no longer planned shift before locking any truck', async ({
    assert,
  }) => {
    for (const [shiftStatus, exception] of [
      [null, ShiftNotFoundException],
      ['ACTIVE', ShiftNotPlannedException],
    ] as const) {
      const { calls } = stubRepositories({ shiftStatus })
      const useCase = await app.container.make(SelectShiftTrucksUseCase)

      await assert.rejects(
        () => useCase.handle({ dischargeId: DISCHARGE_ID, shiftId: SHIFT_ID, truckIds: [ADDED] }),
        exception,
      )
      assert.deepEqual(calls, ['lockDischarge', 'findShift'])
    }
  })

  test('refuses a truck the discharge does not hold without writing', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(SelectShiftTrucksUseCase)

    await assert.rejects(
      () => useCase.handle({ dischargeId: DISCHARGE_ID, shiftId: SHIFT_ID, truckIds: [UNHELD] }),
      errors.E_VALIDATION_ERROR,
    )
    assert.notInclude(calls, 'writeShiftTruckSelection')
  })
})
