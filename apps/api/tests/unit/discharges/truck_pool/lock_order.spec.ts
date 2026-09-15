import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import ReserveTrucksUseCase from '#discharges/truck_pool/reserve_trucks_use_case'
import SelectShiftTrucksUseCase from '#discharges/truck_pool/select_shift_trucks_use_case'
import WithdrawTrucksUseCase from '#discharges/truck_pool/withdraw_trucks_use_case'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const SHIFT_ID = '88888888-8888-4888-8888-888888888888'
const HELD = '55555555-5555-4555-8555-555555555555'
const ADDED = '66666666-6666-4666-8666-666666666666'
const FREE = '77777777-7777-4777-8777-777777777777'

/**
 * Every truck plan write locks the discharge before anything else, and trucks only after it. The
 * slices that will write shifts, memberships, or the start confirmation (GH-56, GH-63, GH-64,
 * GH-76, GH-78) must take the same order, or two writes could deadlock.
 */
function recordingRepositories() {
  const calls: string[] = []
  const record =
    <T>(name: string, value: T) =>
    (...args: unknown[]) => {
      calls.push(name === 'lockTrucks' ? `lockTrucks:${(args[0] as string[]).join(',')}` : name)
      return Promise.resolve(value)
    }

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: record('lockDischarge', { id: DISCHARGE_ID, status: 'PLANNED' }),
        findShift: record('findShift', { id: SHIFT_ID, status: 'PLANNED' }),
        listTruckPool: record('listTruckPool', [
          { id: 'pool-held', truckId: HELD, releasedAt: null },
          { id: 'pool-added', truckId: ADDED, releasedAt: null },
        ]),
        listCurrentShiftTruckSelections: record('listCurrentShiftTruckSelections', [
          { id: 'sel-held', shiftId: SHIFT_ID, truckId: HELD },
        ]),
        lockTrucks: (ids: string[]) => {
          calls.push(`lockTrucks:${ids.join(',')}`)
          return Promise.resolve(
            new Map(
              ids.map((id) => [
                id,
                {
                  id,
                  status: 'AVAILABLE',
                  registration: id,
                  transportCompanyId: null,
                  transportCompanyName: 'Transports du Port',
                },
              ]),
            ),
          )
        },
        writeTruckReservations: record('write', { kind: 'WRITTEN' }),
        writeShiftTruckSelection: record('write', { kind: 'WRITTEN' }),
        deleteTruckWithdrawal: record('write', undefined),
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

  return calls
}

test.group('Truck plan lock order', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('a reservation locks the discharge first, then every requested truck', async ({
    assert,
  }) => {
    const calls = recordingRepositories()
    const useCase = await app.container.make(ReserveTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [FREE, HELD] })

    assert.equal(calls[0], 'lockDischarge')
    assert.deepEqual(
      calls.filter((call) => call.startsWith('lockTrucks')),
      [`lockTrucks:${FREE},${HELD}`],
    )
  })

  test('a shift selection locks the discharge first, then only the trucks it adds', async ({
    assert,
  }) => {
    const calls = recordingRepositories()
    const useCase = await app.container.make(SelectShiftTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, shiftId: SHIFT_ID, truckIds: [HELD, ADDED] })

    assert.equal(calls[0], 'lockDischarge')
    assert.deepEqual(
      calls.filter((call) => call.startsWith('lockTrucks')),
      [`lockTrucks:${ADDED}`],
    )
  })

  test('a withdrawal locks the discharge and no truck', async ({ assert }) => {
    const calls = recordingRepositories()
    const useCase = await app.container.make(WithdrawTrucksUseCase)

    await useCase.handle({ dischargeId: DISCHARGE_ID, truckIds: [HELD] })

    assert.equal(calls[0], 'lockDischarge')
    assert.isFalse(calls.some((call) => call.startsWith('lockTrucks')))
  })
})
