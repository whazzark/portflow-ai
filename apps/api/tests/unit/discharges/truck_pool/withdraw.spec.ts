import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { DischargeNotPlannedException } from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import WithdrawTrucksUseCase from '#discharges/truck_pool/withdraw_trucks_use_case'
import type Discharge from '#models/discharge'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const HELD = '55555555-5555-4555-8555-555555555555'
const NEVER_HELD = '66666666-6666-4666-8666-666666666666'

function stubRepositories({ status = 'PLANNED' }: { status?: Discharge['status'] } = {}) {
  const calls: string[] = []
  const writes: unknown[] = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve({ id: DISCHARGE_ID, status })
        },
        lockTrucks: () => {
          calls.push('lockTrucks')
          return Promise.resolve(new Map())
        },
        listTruckPool: () => {
          calls.push('listTruckPool')
          return Promise.resolve([{ id: 'row-held', truckId: HELD, releasedAt: null }])
        },
        listCurrentShiftTruckSelections: () => {
          calls.push('listCurrentShiftTruckSelections')
          return Promise.resolve([{ id: 'sel-held', shiftId: 'shift-1', truckId: HELD }])
        },
        deleteTruckWithdrawal: (command: unknown) => {
          calls.push('deleteTruckWithdrawal')
          writes.push(command)
          return Promise.resolve()
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

test.group('Withdraw trucks use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge, reads its pool and selections, then deletes, locking no truck', async ({
    assert,
  }) => {
    const { calls, writes } = stubRepositories()
    const useCase = await app.container.make(WithdrawTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [HELD] })

    assert.deepEqual(calls, [
      'lockDischarge',
      'listTruckPool',
      'listCurrentShiftTruckSelections',
      'deleteTruckWithdrawal',
    ])
    assert.deepEqual(writes, [
      { dischargeId: DISCHARGE_ID, assignmentIds: ['row-held'], selectionIds: ['sel-held'] },
    ])
  })

  test('writes nothing when no requested truck is held', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(WithdrawTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [NEVER_HELD] })

    assert.notInclude(calls, 'deleteTruckWithdrawal')
  })

  test('refuses a discharge no longer planned before reading anything', async ({ assert }) => {
    const { calls } = stubRepositories({ status: 'ACTIVE' })
    const useCase = await app.container.make(WithdrawTrucksUseCase)

    await assert.rejects(
      () => useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [HELD] }),
      DischargeNotPlannedException,
    )
    assert.deepEqual(calls, ['lockDischarge'])
  })
})
