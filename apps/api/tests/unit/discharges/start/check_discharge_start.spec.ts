import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargeStartRepository from '#discharges/shared/repositories/discharge_start_repository'
import CheckDischargeStartUseCase from '#discharges/start/check_discharge_start_use_case'

import { readyStartRepository } from './start_repository_stub.ts'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const SHIFT_ID = '88888888-8888-4888-8888-888888888888'

test.group('Check discharge start use case', (group) => {
  group.each.teardown(() => app.container.restore(DischargeStartRepository))

  test('evaluates the plan on unlocked reads and changes nothing', async ({ assert }) => {
    const calls: string[] = []
    app.container.swap(DischargeStartRepository, () => readyStartRepository(calls, []))
    const useCase = await app.container.make(CheckDischargeStartUseCase)

    const evaluation = await useCase.handle({ dischargeId: DISCHARGE_ID })

    assert.deepEqual(evaluation, { dischargeId: DISCHARGE_ID, shiftId: SHIFT_ID, problems: [] })
    assert.deepEqual(calls, [
      'findDischarge',
      'readStartPlan',
      'readReferences:READ',
      'findActiveHolders',
    ])
  })

  test('refuses an unknown discharge and one that is no longer planned', async ({ assert }) => {
    for (const [found, exception] of [
      [null, DischargeNotFoundException],
      [{ id: DISCHARGE_ID, status: 'CLOSED', dockId: DISCHARGE_ID }, DischargeNotPlannedException],
    ] as const) {
      const repository = readyStartRepository([], [])
      repository.findDischarge = () => Promise.resolve(found)
      app.container.swap(DischargeStartRepository, () => repository)
      const useCase = await app.container.make(CheckDischargeStartUseCase)

      await assert.rejects(() => useCase.handle({ dischargeId: DISCHARGE_ID }), exception)
    }
  })
})
