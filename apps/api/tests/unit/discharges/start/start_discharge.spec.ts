import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import type { DateTime } from 'luxon'

import {
  DischargeNotPlannedException,
  DischargePlanningConflictException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import DischargeStartRepository, {
  type ActivationResult,
} from '#discharges/shared/repositories/discharge_start_repository'
import StartDischargeUseCase from '#discharges/start/start_discharge_use_case'
import type Discharge from '#models/discharge'

import { readyStartRepository } from './start_repository_stub.ts'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const DOCK_ID = '11111111-1111-4111-8111-111111111111'
const SHIFT_ID = '88888888-8888-4888-8888-888888888888'
const USER_ID = '99999999-9999-4999-8999-999999999999'

function swapRepositories({
  status = 'PLANNED',
  activation,
}: {
  status?: Discharge['status']
  activation?: ActivationResult
} = {}) {
  const calls: string[] = []
  const activations: Array<{ shiftId: string; userId: string; instant: DateTime }> = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve({ id: DISCHARGE_ID, status, dockId: DOCK_ID })
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(DischargeStartRepository, () =>
    readyStartRepository(calls, activations, activation),
  )
  app.container.swap(
    DischargeRepository,
    () =>
      ({
        findDetail: () => {
          calls.push('findDetail')
          return Promise.resolve({ discharge: { id: DISCHARGE_ID }, otherHoldings: new Map() })
        },
      }) as unknown as DischargeRepository,
  )

  return { calls, activations }
}

test.group('Start discharge use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeStartRepository)
    app.container.restore(DischargeRepository)
  })

  test('activates the discharge and its first shift once, then reads the detail', async ({
    assert,
  }) => {
    const { calls, activations } = swapRepositories()
    const useCase = await app.container.make(StartDischargeUseCase)

    const read = await useCase.handle({ dischargeId: DISCHARGE_ID, userId: USER_ID })

    assert.deepEqual(read.discharge.id, DISCHARGE_ID)
    assert.lengthOf(activations, 1)
    assert.equal(activations[0].shiftId, SHIFT_ID)
    assert.equal(activations[0].userId, USER_ID)
    assert.equal(activations[0].instant.millisecond, 0)
    assert.equal(calls.at(-1), 'findDetail')
    assert.isBelow(calls.indexOf('activate'), calls.indexOf('findDetail'))
  })

  test('maps an active-row index refusal to the planning conflict', async ({ assert }) => {
    swapRepositories({ activation: { kind: 'ACTIVE_ROW_CONFLICT' } })
    const useCase = await app.container.make(StartDischargeUseCase)

    await assert.rejects(
      () => useCase.handle({ dischargeId: DISCHARGE_ID, userId: USER_ID }),
      DischargePlanningConflictException,
    )
  })

  test('refuses a discharge that is no longer planned before reading its plan', async ({
    assert,
  }) => {
    const { calls } = swapRepositories({ status: 'ACTIVE' })
    const useCase = await app.container.make(StartDischargeUseCase)

    await assert.rejects(
      () => useCase.handle({ dischargeId: DISCHARGE_ID, userId: USER_ID }),
      DischargeNotPlannedException,
    )
    assert.deepEqual(calls, ['lockDischarge'])
  })
})
