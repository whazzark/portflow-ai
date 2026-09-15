import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import AddProductLotUseCase from '#discharges/product_lots/add_product_lot_use_case'
import CorrectProductLotUseCase from '#discharges/product_lots/correct_product_lot_use_case'
import RemoveProductLotUseCase from '#discharges/product_lots/remove_product_lot_use_case'
import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
  LastProductLotException,
  ProductLotHasDoorAssignmentsException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import type Discharge from '#models/discharge'

const DISCHARGE_ID = '44444444-4444-4444-8444-444444444444'
const WHEAT_ID = '55555555-5555-4555-8555-555555555555'
const BARLEY_ID = '66666666-6666-4666-8666-666666666666'
const CARGILL_ID = '22222222-2222-4222-8222-222222222222'
const SOUFFLET_ID = '33333333-3333-4333-8333-333333333333'
const NEW_CUSTOMER_ID = '77777777-7777-4777-8777-777777777777'

type StubOptions = {
  status?: Discharge['status'] | null
  lots?: Array<{ id: string; customerId: string; productName: string }>
  hasDoorAssignments?: boolean
  deleteOutcome?: 'DELETED' | 'HAS_DOOR_ASSIGNMENTS'
}

function stubRepositories({
  status = 'PLANNED',
  lots = [
    { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
    { id: BARLEY_ID, customerId: SOUFFLET_ID, productName: 'Orge' },
  ],
  hasDoorAssignments = false,
  deleteOutcome = 'DELETED',
}: StubOptions = {}) {
  const calls: string[] = []

  app.container.swap(
    DischargePreparationRepository,
    () =>
      ({
        lockDischarge: () => {
          calls.push('lockDischarge')
          return Promise.resolve(status ? { id: DISCHARGE_ID, status } : null)
        },
        listProductLots: () => {
          calls.push('listProductLots')
          return Promise.resolve(lots)
        },
        lockCustomers: (ids: string[]) => {
          calls.push(`lockCustomers:${ids.join(',')}`)
          return Promise.resolve(new Map(ids.map((id) => [id, { id, status: 'AVAILABLE' }])))
        },
        insertProductLot: () => {
          calls.push('insertProductLot')
          return Promise.resolve({ kind: 'WRITTEN' })
        },
        updateProductLot: () => {
          calls.push('updateProductLot')
          return Promise.resolve({ kind: 'WRITTEN' })
        },
        hasDoorAssignments: () => {
          calls.push('hasDoorAssignments')
          return Promise.resolve(hasDoorAssignments)
        },
        deleteProductLot: () => {
          calls.push('deleteProductLot')
          return Promise.resolve({ kind: deleteOutcome })
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

  return { calls }
}

const lotValues = (customerId: string, productName: string) => ({
  customerId,
  productName,
  expectedQuantityTonnes: '10',
  description: null,
})

async function issuesOf(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (error instanceof errors.E_VALIDATION_ERROR) {
      return (error.messages as { field: string; rule: string }[]).map((issue) => [
        issue.field,
        issue.rule,
      ])
    }

    throw error
  }

  throw new Error('expected the change to be rejected')
}

test.group('Product lot use cases', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('refuses every lot change on an unknown or no longer planned discharge', async ({
    assert,
  }) => {
    for (const [status, exception] of [
      [null, DischargeNotFoundException],
      ['ACTIVE', DischargeNotPlannedException],
      ['CLOSED', DischargeNotPlannedException],
    ] as const) {
      const { calls } = stubRepositories({ status })
      const add = await app.container.make(AddProductLotUseCase)
      const correct = await app.container.make(CorrectProductLotUseCase)
      const remove = await app.container.make(RemoveProductLotUseCase)

      await assert.rejects(
        () => add.handle({ dischargeId: DISCHARGE_ID, ...lotValues(CARGILL_ID, 'Maïs') }),
        exception,
      )
      await assert.rejects(
        () =>
          correct.handle({
            dischargeId: DISCHARGE_ID,
            productLotId: WHEAT_ID,
            ...lotValues(CARGILL_ID, 'Blé'),
          }),
        exception,
      )
      await assert.rejects(
        () => remove.handle({ dischargeId: DISCHARGE_ID, productLotId: BARLEY_ID }),
        exception,
      )
      assert.deepEqual(
        calls.filter((call) => call !== 'lockDischarge'),
        [],
      )
    }
  })

  test('adds a lot with a new customer after locking that customer', async ({ assert }) => {
    const { calls } = stubRepositories()
    const add = await app.container.make(AddProductLotUseCase)

    await add.handle({ dischargeId: DISCHARGE_ID, ...lotValues(NEW_CUSTOMER_ID, 'Maïs') })

    assert.deepEqual(calls, [
      'lockDischarge',
      'listProductLots',
      `lockCustomers:${NEW_CUSTOMER_ID}`,
      'insertProductLot',
    ])
  })

  test('rejects an added lot sharing an existing identity', async ({ assert }) => {
    const { calls } = stubRepositories()
    const add = await app.container.make(AddProductLotUseCase)

    const issues = await issuesOf(
      add.handle({ dischargeId: DISCHARGE_ID, ...lotValues(CARGILL_ID, ' BLÉ TENDRE ') }),
    )

    assert.deepEqual(issues, [['productName', 'productLotIdentityUnique']])
    assert.notInclude(calls, 'insertProductLot')
  })

  test('corrects a lot without locking its unchanged customer, ignoring its own identity', async ({
    assert,
  }) => {
    const { calls } = stubRepositories()
    const correct = await app.container.make(CorrectProductLotUseCase)

    await correct.handle({
      dischargeId: DISCHARGE_ID,
      productLotId: WHEAT_ID,
      ...lotValues(CARGILL_ID, 'BLÉ TENDRE'),
    })

    assert.deepEqual(calls, ['lockDischarge', 'listProductLots', 'updateProductLot'])
  })

  test('rejects a correction clashing with another lot before any write', async ({ assert }) => {
    const { calls } = stubRepositories()
    const correct = await app.container.make(CorrectProductLotUseCase)

    const issues = await issuesOf(
      correct.handle({
        dischargeId: DISCHARGE_ID,
        productLotId: WHEAT_ID,
        ...lotValues(SOUFFLET_ID, 'orge'),
      }),
    )

    assert.deepEqual(issues, [['productName', 'productLotIdentityUnique']])
    assert.notInclude(calls, 'updateProductLot')
  })

  test('refuses to correct or remove a lot outside the discharge', async ({ assert }) => {
    stubRepositories()
    const correct = await app.container.make(CorrectProductLotUseCase)
    const remove = await app.container.make(RemoveProductLotUseCase)
    const outsider = '88888888-8888-4888-8888-888888888888'

    await assert.rejects(
      () =>
        correct.handle({
          dischargeId: DISCHARGE_ID,
          productLotId: outsider,
          ...lotValues(CARGILL_ID, 'Blé'),
        }),
      ProductLotNotFoundException,
    )
    await assert.rejects(
      () => remove.handle({ dischargeId: DISCHARGE_ID, productLotId: 'not-a-uuid' }),
      ProductLotNotFoundException,
    )
  })

  test('removes a lot only when it is not the last and has no door assignment', async ({
    assert,
  }) => {
    const last = stubRepositories({
      lots: [{ id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' }],
    })
    await assert.rejects(
      async () =>
        (await app.container.make(RemoveProductLotUseCase)).handle({
          dischargeId: DISCHARGE_ID,
          productLotId: WHEAT_ID,
        }),
      LastProductLotException,
    )
    assert.notInclude(last.calls, 'deleteProductLot')

    const assigned = stubRepositories({ hasDoorAssignments: true })
    await assert.rejects(
      async () =>
        (await app.container.make(RemoveProductLotUseCase)).handle({
          dischargeId: DISCHARGE_ID,
          productLotId: BARLEY_ID,
        }),
      ProductLotHasDoorAssignmentsException,
    )
    assert.notInclude(assigned.calls, 'deleteProductLot')

    const raced = stubRepositories({ deleteOutcome: 'HAS_DOOR_ASSIGNMENTS' })
    await assert.rejects(
      async () =>
        (await app.container.make(RemoveProductLotUseCase)).handle({
          dischargeId: DISCHARGE_ID,
          productLotId: BARLEY_ID,
        }),
      ProductLotHasDoorAssignmentsException,
    )
    assert.include(raced.calls, 'deleteProductLot')

    const removable = stubRepositories()
    await (await app.container.make(RemoveProductLotUseCase)).handle({
      dischargeId: DISCHARGE_ID,
      productLotId: BARLEY_ID,
    })
    assert.deepEqual(removable.calls, [
      'lockDischarge',
      'listProductLots',
      'hasDoorAssignments',
      'deleteProductLot',
    ])
  })
})
