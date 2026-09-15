import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import ReserveTrucksUseCase from '#discharges/truck_pool/reserve_trucks_use_case'
import type Discharge from '#models/discharge'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const FREE = '55555555-5555-4555-8555-555555555555'
const HELD = '66666666-6666-4666-8666-666666666666'
const SUSPENDED = '77777777-7777-4777-8777-777777777777'

type StubOptions = {
  status?: Discharge['status'] | null
}

function stubRepositories({ status = 'PLANNED' }: StubOptions = {}) {
  const calls: string[] = []
  const writes: unknown[] = []
  const detail = { discharge: { id: DISCHARGE_ID }, otherHoldings: new Map() }

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve(status ? { id: DISCHARGE_ID, status } : null)
        },
        lockTrucks: (ids: string[]) => {
          calls.push(`lockTrucks:${ids.join(',')}`)
          return Promise.resolve(
            new Map(
              ids.map((id) => [
                id,
                {
                  id,
                  status: id === SUSPENDED ? 'SUSPENDED' : 'AVAILABLE',
                  registration: `REG-${id.slice(0, 4)}`,
                  transportCompanyId: 'company-1',
                  transportCompanyName: 'Transports du Port',
                },
              ]),
            ),
          )
        },
        listTruckPool: () => {
          calls.push('listTruckPool')
          return Promise.resolve([{ id: 'row-held', truckId: HELD, releasedAt: null }])
        },
        writeTruckReservations: (command: unknown) => {
          calls.push('writeTruckReservations')
          writes.push(command)
          return Promise.resolve({ kind: 'WRITTEN' })
        },
      }) as unknown as DischargePreparationRepository,
  )
  app.container.swap(
    DischargeRepository,
    () => ({ findDetail: () => Promise.resolve(detail) }) as unknown as DischargeRepository,
  )

  return { calls, writes, detail }
}

test.group('Reserve trucks use case', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge, then every requested truck, then reads the pool, then writes', async ({
    assert,
  }) => {
    const { calls, writes, detail } = stubRepositories()
    const useCase = await app.container.make(ReserveTrucksUseCase)

    const read = await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [FREE, HELD] })

    assert.deepEqual(calls, [
      'lockDischarge',
      `lockTrucks:${FREE},${HELD}`,
      'listTruckPool',
      'writeTruckReservations',
    ])
    assert.lengthOf(writes, 1)
    assert.strictEqual(read, detail)
  })

  test('refuses an unknown or no longer planned discharge before locking any truck', async ({
    assert,
  }) => {
    for (const [status, exception] of [
      [null, DischargeNotFoundException],
      ['ACTIVE', DischargeNotPlannedException],
    ] as const) {
      const { calls } = stubRepositories({ status })
      const useCase = await app.container.make(ReserveTrucksUseCase)

      await assert.rejects(
        () => useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [FREE] }),
        exception,
      )
      assert.deepEqual(calls, ['lockDischarge'])
    }
  })

  test('refuses a suspended truck without writing anything', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(ReserveTrucksUseCase)

    await assert.rejects(
      () => useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [FREE, SUSPENDED] }),
      errors.E_VALIDATION_ERROR,
    )
    assert.notInclude(calls, 'writeTruckReservations')
  })

  test('writes nothing when every requested truck is already held, and still answers', async ({
    assert,
  }) => {
    const { calls, detail } = stubRepositories()
    const useCase = await app.container.make(ReserveTrucksUseCase)

    const read = await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [HELD] })

    assert.notInclude(calls, 'writeTruckReservations')
    assert.strictEqual(read, detail)
  })
})
