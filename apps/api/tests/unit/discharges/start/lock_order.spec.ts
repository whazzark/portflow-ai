import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import DischargeStartRepository, {
  type StartReferenceIds,
} from '#discharges/shared/repositories/discharge_start_repository'
import StartDischargeUseCase from '#discharges/start/start_discharge_use_case'

import {
  DISCHARGE_ID,
  DOCK_ID,
  readyStartRepository,
  SHIFT_ID,
  USER_ID,
} from './start_repository_stub.ts'

const POOL_ONLY_TRUCK = '55555555-5555-4555-8555-555555555555'
const SHIFT_TRUCK = '66666666-6666-4666-8666-666666666666'
const LOT_DOOR = '77777777-7777-4777-8777-777777777777'
const SHIFT_DOOR = '12121212-1212-4212-8212-121212121212'

/**
 * A start locks its discharge first, claims every reference its plan uses, and only then reads the
 * other active discharges. Reading holders before a claim would let a competing start commit
 * between the two and go unseen. Runtime claims on an active discharge (GH-75 to GH-77) must follow
 * the same order.
 */
test.group('Discharge start lock order', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeStartRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the discharge, claims the whole plan, then reads the active holders', async ({
    assert,
  }) => {
    const calls: string[] = []
    const claimed: StartReferenceIds[] = []
    const repository = readyStartRepository(calls, [])
    repository.readStartPlan = () => {
      calls.push('readStartPlan')
      return Promise.resolve({
        lots: [{ id: 'lot-1', customerId: 'customer-1' }],
        currentAssignments: [{ productLotId: 'lot-1', warehouseDoorId: LOT_DOOR }],
        heldTruckIds: [POOL_ONLY_TRUCK, SHIFT_TRUCK],
        firstShift: {
          id: SHIFT_ID,
          responsibleUserId: USER_ID,
          truckIds: [SHIFT_TRUCK],
          warehouseDoorIds: [SHIFT_DOOR],
          weighingAreaIds: [],
        },
      })
    }
    const read = repository.readReferences.bind(repository)
    repository.readReferences = (ids, mode, client) => {
      claimed.push(ids)
      return read(ids, mode, client)
    }
    app.container.swap(DischargeStartRepository, () => repository)
    app.container.swap(
      DischargePreparationRepository,
      () =>
        ({
          lockDischarge: () => {
            calls.push('lockDischarge')
            return Promise.resolve({ id: DISCHARGE_ID, status: 'PLANNED', dockId: DOCK_ID })
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
    const useCase = await app.container.make(StartDischargeUseCase)

    // This plan's references are not all known to the stub, so the start may be refused: the order
    // of the calls is what this test is about, whatever the outcome.
    await useCase.handle({ dischargeId: DISCHARGE_ID, userId: USER_ID }).catch(() => undefined)

    assert.deepEqual(calls.slice(0, 4), [
      'lockDischarge',
      'readStartPlan',
      'readReferences:CLAIM',
      'findActiveHolders',
    ])
    assert.equal(claimed[0].dockId, DOCK_ID)
    assert.includeMembers(claimed[0].truckIds, [POOL_ONLY_TRUCK, SHIFT_TRUCK])
    assert.includeMembers(claimed[0].warehouseDoorIds, [LOT_DOOR, SHIFT_DOOR])
  })
})
