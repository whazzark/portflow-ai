import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import CorrectDischargeIdentityUseCase, {
  type CorrectDischargeIdentityInput,
} from '#discharges/update/correct_discharge_identity_use_case'
import type Discharge from '#models/discharge'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const CURRENT_DOCK = '11111111-1111-4111-8111-111111111111'
const OTHER_DOCK = '22222222-2222-4222-8222-222222222222'

function stubRepositories(locked: Partial<Discharge> | null) {
  const calls: string[] = []
  const updates: unknown[] = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve(locked)
        },
        lockDocks: (ids: string[]) => {
          calls.push(`lockDocks:${ids.join(',')}`)
          return Promise.resolve(new Map(ids.map((id) => [id, { id, status: 'AVAILABLE' }])))
        },
        updateIdentity: (command: unknown) => {
          calls.push('updateIdentity')
          updates.push(command)
          return Promise.resolve()
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () =>
      ({
        findDetail: () => Promise.resolve({ id: DISCHARGE_ID } as Discharge),
      }) as unknown as DischargeRepository,
  )

  return { calls, updates }
}

function buildInput(overrides: Partial<CorrectDischargeIdentityInput> = {}) {
  return {
    dischargeId: DISCHARGE_ID,
    vesselName: '  MV Corrected ',
    vesselImo: ' ',
    vesselComment: '',
    dockId: CURRENT_DOCK,
    expectedStartAt: DateTime.fromISO('2026-10-02T06:30:00.000Z'),
    ...overrides,
  }
}

test.group('Correct discharge identity use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge first and writes normalized values', async ({ assert }) => {
    const { calls, updates } = stubRepositories({
      id: DISCHARGE_ID,
      status: 'PLANNED',
      dockId: CURRENT_DOCK,
    })
    const useCase = await app.container.make(CorrectDischargeIdentityUseCase)

    await useCase.handle(buildInput())

    assert.deepEqual(calls, ['lockDischarge', 'updateIdentity'])
    assert.containSubset(updates[0], {
      dischargeId: DISCHARGE_ID,
      vesselName: 'MV Corrected',
      vesselImo: null,
      vesselComment: null,
      dockId: CURRENT_DOCK,
    })
  })

  test('locks and checks a dock only when it changes', async ({ assert }) => {
    const { calls } = stubRepositories({
      id: DISCHARGE_ID,
      status: 'PLANNED',
      dockId: CURRENT_DOCK,
    })
    const useCase = await app.container.make(CorrectDischargeIdentityUseCase)

    await useCase.handle(buildInput({ dockId: OTHER_DOCK }))

    assert.deepEqual(calls, ['lockDischarge', `lockDocks:${OTHER_DOCK}`, 'updateIdentity'])
  })

  test('refuses an unknown discharge', async ({ assert }) => {
    const { calls } = stubRepositories(null)
    const useCase = await app.container.make(CorrectDischargeIdentityUseCase)

    await assert.rejects(() => useCase.handle(buildInput()), DischargeNotFoundException)
    assert.notInclude(calls, 'updateIdentity')
  })

  test('refuses a discharge that is no longer planned', async ({ assert }) => {
    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { calls } = stubRepositories({ id: DISCHARGE_ID, status, dockId: CURRENT_DOCK })
      const useCase = await app.container.make(CorrectDischargeIdentityUseCase)

      await assert.rejects(() => useCase.handle(buildInput()), DischargeNotPlannedException)
      assert.notInclude(calls, 'updateIdentity')
    }
  })
})
