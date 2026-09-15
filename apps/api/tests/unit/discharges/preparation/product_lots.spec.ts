import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { errors } from '@vinejs/vine'

import AddProductLotsUseCase from '#discharges/product_lots/add_product_lots_use_case'
import CorrectCustomerProductLotsUseCase from '#discharges/product_lots/correct_customer_product_lots_use_case'
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
  unavailableCustomerIds?: string[]
  insertOutcome?: 'WRITTEN' | 'DUPLICATE_LOT_IDENTITY'
  hasDoorAssignments?: boolean
  deleteOutcome?: 'DELETED' | 'HAS_DOOR_ASSIGNMENTS'
  lotIdsWithDoors?: string[]
  customerWriteOutcome?: 'WRITTEN' | 'DUPLICATE_LOT_IDENTITY' | 'HAS_DOOR_ASSIGNMENTS'
}

function stubRepositories({
  status = 'PLANNED',
  lots = [
    { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
    { id: BARLEY_ID, customerId: SOUFFLET_ID, productName: 'Orge' },
  ],
  unavailableCustomerIds = [],
  insertOutcome = 'WRITTEN',
  hasDoorAssignments = false,
  deleteOutcome = 'DELETED',
  lotIdsWithDoors = [],
  customerWriteOutcome = 'WRITTEN',
}: StubOptions = {}) {
  const calls: string[] = []
  const commands: unknown[] = []

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
          return Promise.resolve(
            new Map(
              ids.map((id) => [
                id,
                { id, status: unavailableCustomerIds.includes(id) ? 'ARCHIVED' : 'AVAILABLE' },
              ]),
            ),
          )
        },
        insertProductLots: (command: { productLots: unknown[] }) => {
          calls.push(`insertProductLots:${command.productLots.length}`)
          return Promise.resolve({ kind: insertOutcome })
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
        listLotIdsWithDoorAssignments: (ids: string[]) => {
          calls.push(`listLotIdsWithDoorAssignments:${ids.join(',')}`)
          return Promise.resolve(new Set(lotIdsWithDoors.filter((id) => ids.includes(id))))
        },
        writeCustomerProductLotsCorrection: (command: unknown) => {
          calls.push('writeCustomerProductLotsCorrection')
          commands.push(command)
          return Promise.resolve({ kind: customerWriteOutcome })
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

  return { calls, commands }
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
      const add = await app.container.make(AddProductLotsUseCase)
      const correct = await app.container.make(CorrectProductLotUseCase)
      const remove = await app.container.make(RemoveProductLotUseCase)

      await assert.rejects(
        () =>
          add.handle({ dischargeId: DISCHARGE_ID, productLots: [lotValues(CARGILL_ID, 'Maïs')] }),
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

  test('adds several lots in one write after locking each customer once', async ({ assert }) => {
    const { calls } = stubRepositories()
    const add = await app.container.make(AddProductLotsUseCase)

    await add.handle({
      dischargeId: DISCHARGE_ID,
      productLots: [
        lotValues(NEW_CUSTOMER_ID, 'Maïs'),
        lotValues(CARGILL_ID, 'Colza'),
        lotValues(NEW_CUSTOMER_ID, 'Orge'),
      ],
    })

    assert.deepEqual(calls, [
      'lockDischarge',
      'listProductLots',
      `lockCustomers:${NEW_CUSTOMER_ID},${CARGILL_ID}`,
      'insertProductLots:3',
    ])
  })

  test('rejects lots sharing an identity within the batch before any lock', async ({ assert }) => {
    const { calls } = stubRepositories()
    const add = await app.container.make(AddProductLotsUseCase)

    const issues = await issuesOf(
      add.handle({
        dischargeId: DISCHARGE_ID,
        productLots: [lotValues(NEW_CUSTOMER_ID, 'Maïs'), lotValues(NEW_CUSTOMER_ID, ' MAÏS ')],
      }),
    )

    assert.deepEqual(issues, [
      ['productLots.0.productName', 'productLotIdentityUnique'],
      ['productLots.1.productName', 'productLotIdentityUnique'],
    ])
    assert.deepEqual(calls, [])
  })

  test('reports every refused lot at its position and writes none', async ({ assert }) => {
    const { calls } = stubRepositories({ unavailableCustomerIds: [NEW_CUSTOMER_ID] })
    const add = await app.container.make(AddProductLotsUseCase)

    const issues = await issuesOf(
      add.handle({
        dischargeId: DISCHARGE_ID,
        productLots: [
          lotValues(SOUFFLET_ID, 'Colza'),
          lotValues(CARGILL_ID, ' BLÉ TENDRE '),
          lotValues(NEW_CUSTOMER_ID, 'Maïs'),
        ],
      }),
    )

    assert.deepEqual(issues, [
      ['productLots.1.productName', 'productLotIdentityUnique'],
      ['productLots.2.customerId', 'availableCustomer'],
    ])
    assert.notInclude(calls, 'insertProductLots:3')
  })

  test('reports an identity the database refuses on the first lot', async ({ assert }) => {
    stubRepositories({ insertOutcome: 'DUPLICATE_LOT_IDENTITY' })
    const add = await app.container.make(AddProductLotsUseCase)

    const issues = await issuesOf(
      add.handle({ dischargeId: DISCHARGE_ID, productLots: [lotValues(CARGILL_ID, 'Maïs')] }),
    )

    assert.deepEqual(issues, [['productLots.0.productName', 'productLotIdentityUnique']])
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

const correctionEntry = (productName: string, id?: string) => ({
  ...(id ? { id } : {}),
  productName,
  expectedQuantityTonnes: '10',
  description: null as string | null,
})

function correction(overrides: Record<string, unknown> = {}) {
  return {
    dischargeId: DISCHARGE_ID,
    customerId: CARGILL_ID,
    targetCustomerId: CARGILL_ID,
    productLots: [correctionEntry('Blé tendre', WHEAT_ID)],
    removedProductLotIds: [],
    ...overrides,
  }
}

test.group('CorrectCustomerProductLotsUseCase', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test("corrects a customer's lots in one write, locking nothing but the discharge", async ({
    assert,
  }) => {
    const { calls, commands } = stubRepositories()
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    const detail = await useCase.handle(
      correction({
        productLots: [
          {
            id: WHEAT_ID.toUpperCase(),
            productName: '  Blé dur ',
            expectedQuantityTonnes: '1250.5',
            description: '   ',
          },
        ],
      }),
    )

    assert.deepEqual(detail, { id: DISCHARGE_ID } as Discharge)
    assert.deepEqual(calls, [
      'lockDischarge',
      'listProductLots',
      'writeCustomerProductLotsCorrection',
    ])
    const [command] = commands as Array<{
      dischargeId: string
      corrections: Array<{
        productLotId: string
        productName: string
        expectedQuantityTonnes: { toFixed: (digits: number) => string }
        description: string | null
        identityChanges: boolean
      }>
      insertions: unknown[]
      removals: unknown[]
    }>
    assert.equal(command.dischargeId, DISCHARGE_ID)
    assert.lengthOf(command.corrections, 1)
    assert.equal(command.corrections[0].productLotId, WHEAT_ID)
    assert.equal(command.corrections[0].productName, 'Blé dur')
    assert.equal(command.corrections[0].expectedQuantityTonnes.toFixed(3), '1250.500')
    assert.isNull(command.corrections[0].description)
    assert.isTrue(command.corrections[0].identityChanges)
    assert.deepEqual(command.insertions, [])
    assert.deepEqual(command.removals, [])
  })

  test('refuses a correction on an unknown or no longer planned discharge', async ({ assert }) => {
    for (const [status, exception] of [
      [null, DischargeNotFoundException],
      ['ACTIVE', DischargeNotPlannedException],
    ] as const) {
      const { calls } = stubRepositories({ status })
      const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

      await assert.rejects(() => useCase.handle(correction()), exception)
      assert.deepEqual(calls, ['lockDischarge'])
    }
  })

  test('refuses a lot of another customer as a lot that is not there', async ({ assert }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    await assert.rejects(
      () => useCase.handle(correction({ productLots: [correctionEntry('Orge', BARLEY_ID)] })),
      ProductLotNotFoundException,
    )
    assert.notInclude(calls, 'writeCustomerProductLotsCorrection')
  })

  test('reports the rules a correction breaks, and writes nothing', async ({ assert }) => {
    const { calls } = stubRepositories({
      lots: [
        { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
        { id: BARLEY_ID, customerId: CARGILL_ID, productName: 'Orge' },
      ],
    })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    const issues = await issuesOf(
      useCase.handle(correction({ productLots: [correctionEntry(' ORGE', WHEAT_ID)] })),
    )

    assert.deepEqual(issues, [['productLots.0.productName', 'productLotIdentityUnique']])
    assert.notInclude(calls, 'writeCustomerProductLotsCorrection')
  })

  test('reports an identity the database refuses on the first lot', async ({ assert }) => {
    stubRepositories({ customerWriteOutcome: 'DUPLICATE_LOT_IDENTITY' })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    assert.deepEqual(await issuesOf(useCase.handle(correction())), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
  })
})

test.group('CorrectCustomerProductLotsUseCase — removals and additions', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  const CARGILL_LOTS = [
    { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
    { id: BARLEY_ID, customerId: CARGILL_ID, productName: 'Orge' },
  ]

  test('reads the door assignments of removed lots only, before writing', async ({ assert }) => {
    const { calls, commands } = stubRepositories({ lots: CARGILL_LOTS })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    await useCase.handle(
      correction({
        productLots: [correctionEntry('Blé tendre', WHEAT_ID), correctionEntry('Colza')],
        removedProductLotIds: [BARLEY_ID],
      }),
    )

    assert.deepEqual(calls, [
      'lockDischarge',
      'listProductLots',
      `listLotIdsWithDoorAssignments:${BARLEY_ID}`,
      'writeCustomerProductLotsCorrection',
    ])
    assert.containSubset(commands[0], {
      removals: [BARLEY_ID],
      insertions: [{ customerId: CARGILL_ID, productName: 'Colza' }],
    })
  })

  test('refuses to leave the discharge without any lot', async ({ assert }) => {
    const { calls } = stubRepositories({ lots: CARGILL_LOTS })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    await assert.rejects(
      () =>
        useCase.handle(
          correction({ productLots: [], removedProductLotIds: [WHEAT_ID, BARLEY_ID] }),
        ),
      LastProductLotException,
    )
    assert.notInclude(calls, 'writeCustomerProductLotsCorrection')
  })

  test('refuses a removal of a lot with door assignments, found by the rules or the write', async ({
    assert,
  }) => {
    stubRepositories({ lots: CARGILL_LOTS, lotIdsWithDoors: [BARLEY_ID] })
    const assigned = await app.container.make(CorrectCustomerProductLotsUseCase)
    assert.deepEqual(
      await issuesOf(assigned.handle(correction({ removedProductLotIds: [BARLEY_ID] }))),
      [['removedProductLotIds.0', 'removableProductLot']],
    )

    stubRepositories({ lots: CARGILL_LOTS, customerWriteOutcome: 'HAS_DOOR_ASSIGNMENTS' })
    const raced = await app.container.make(CorrectCustomerProductLotsUseCase)
    await assert.rejects(
      () => raced.handle(correction({ removedProductLotIds: [BARLEY_ID] })),
      ProductLotHasDoorAssignmentsException,
    )
  })
})

test.group('CorrectCustomerProductLotsUseCase — moves', (group) => {
  group.each.teardown(() => {
    app.container.restore(DischargePreparationRepository)
    app.container.restore(DischargeRepository)
  })

  test('locks the new customer after the lots, before reading doors and writing', async ({
    assert,
  }) => {
    const { calls, commands } = stubRepositories({
      lots: [
        { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
        { id: BARLEY_ID, customerId: CARGILL_ID, productName: 'Orge' },
      ],
    })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    await useCase.handle(
      correction({
        targetCustomerId: NEW_CUSTOMER_ID,
        productLots: [correctionEntry('Blé tendre', WHEAT_ID)],
        removedProductLotIds: [BARLEY_ID],
      }),
    )

    assert.deepEqual(calls, [
      'lockDischarge',
      'listProductLots',
      `lockCustomers:${NEW_CUSTOMER_ID}`,
      `listLotIdsWithDoorAssignments:${BARLEY_ID}`,
      'writeCustomerProductLotsCorrection',
    ])
    assert.containSubset(commands[0], { corrections: [{ customerId: NEW_CUSTOMER_ID }] })
  })

  test('locks no customer when the lots stay with theirs, whatever its case', async ({
    assert,
  }) => {
    const { calls } = stubRepositories()
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    await useCase.handle(correction({ targetCustomerId: CARGILL_ID.toUpperCase() }))

    assert.notInclude(
      calls.map((call) => call.split(':')[0]),
      'lockCustomers',
    )
  })

  test('refuses to move the lots to a customer no longer available', async ({ assert }) => {
    const { calls } = stubRepositories({ unavailableCustomerIds: [NEW_CUSTOMER_ID] })
    const useCase = await app.container.make(CorrectCustomerProductLotsUseCase)

    assert.deepEqual(
      await issuesOf(useCase.handle(correction({ targetCustomerId: NEW_CUSTOMER_ID }))),
      [['customerId', 'availableCustomer']],
    )
    assert.notInclude(calls, 'writeCustomerProductLotsCorrection')
  })
})
