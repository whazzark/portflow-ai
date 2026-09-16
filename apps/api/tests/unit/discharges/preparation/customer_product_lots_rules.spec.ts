import { test } from '@japa/runner'
import { Decimal } from 'decimal.js'

import {
  type CustomerProductLotsCorrectionRequest,
  planCustomerProductLotsCorrection,
} from '#discharges/product_lots/customer_product_lots_rules'

const CARGILL_ID = '22222222-2222-4222-8222-222222222222'
const SOUFFLET_ID = '33333333-3333-4333-8333-333333333333'
const WHEAT_ID = '55555555-5555-4555-8555-555555555555'
const CARGILL_BARLEY_ID = '66666666-6666-4666-8666-666666666666'
const SOUFFLET_BARLEY_ID = '77777777-7777-4777-8777-777777777777'
const UNKNOWN_ID = '88888888-8888-4888-8888-888888888888'

const LOTS = [
  { id: WHEAT_ID, customerId: CARGILL_ID, productName: 'Blé tendre' },
  { id: CARGILL_BARLEY_ID, customerId: CARGILL_ID, productName: 'Orge' },
  { id: SOUFFLET_BARLEY_ID, customerId: SOUFFLET_ID, productName: 'Orge' },
]

const entry = (productName: string, id?: string) => ({
  ...(id ? { id } : {}),
  productName,
  expectedQuantityTonnes: new Decimal('10'),
  description: null,
})

function request(
  overrides: Partial<CustomerProductLotsCorrectionRequest> = {},
): CustomerProductLotsCorrectionRequest {
  return {
    customerId: CARGILL_ID,
    targetCustomerId: CARGILL_ID,
    productLots: [],
    removedProductLotIds: [],
    ...overrides,
  }
}

function plan(
  overrides: Partial<CustomerProductLotsCorrectionRequest> = {},
  options: { doors?: string[]; targetStatus?: string | null; lots?: typeof LOTS } = {},
) {
  const { doors = [], targetStatus = 'AVAILABLE', lots = LOTS } = options

  return planCustomerProductLotsCorrection(
    request(overrides),
    lots,
    new Set(doors),
    targetStatus === null ? null : { status: targetStatus },
  )
}

function issuesOf(result: ReturnType<typeof plan>) {
  return result.kind === 'ISSUES' ? result.issues.map((issue) => [issue.field, issue.rule]) : []
}

test.group('planCustomerProductLotsCorrection — ownership and partition', () => {
  test('refuses a lot that is not a current lot of the corrected customer', ({ assert }) => {
    for (const id of [UNKNOWN_ID, SOUFFLET_BARLEY_ID, 'not-a-uuid']) {
      assert.deepEqual(plan({ productLots: [entry('Blé', id)] }), { kind: 'LOT_NOT_FOUND' }, id)
      assert.deepEqual(plan({ removedProductLotIds: [id] }), { kind: 'LOT_NOT_FOUND' }, id)
    }
  })

  test('refuses a customer without lots on the discharge, even for lots only added', ({
    assert,
  }) => {
    for (const customerId of [UNKNOWN_ID, 'not-a-uuid']) {
      assert.deepEqual(
        plan({ customerId, targetCustomerId: customerId, productLots: [entry('Blé')] }),
        { kind: 'LOT_NOT_FOUND' },
        customerId,
      )
    }
  })

  test('compares lot identities without regard to case', ({ assert }) => {
    const result = plan({ productLots: [entry('Blé tendre', WHEAT_ID.toUpperCase())] })

    assert.equal(result.kind, 'PLAN')
  })

  test('refuses a lot listed twice, at its later position, before any other rule', ({ assert }) => {
    assert.deepEqual(
      issuesOf(
        plan({
          productLots: [entry('Orge', WHEAT_ID), entry('Orge', WHEAT_ID.toUpperCase())],
        }),
      ),
      [['productLots.1.id', 'productLotListedOnce']],
    )
    assert.deepEqual(
      issuesOf(
        plan({
          productLots: [entry('Blé tendre', WHEAT_ID)],
          removedProductLotIds: [WHEAT_ID, CARGILL_BARLEY_ID],
        }),
      ),
      [['removedProductLotIds.0', 'productLotListedOnce']],
    )
  })

  test('partitions a change into corrections, insertions, and removals', ({ assert }) => {
    const result = plan({
      productLots: [entry(' Blé dur ', WHEAT_ID), entry('Colza')],
      removedProductLotIds: [CARGILL_BARLEY_ID.toUpperCase()],
    })

    assert.equal(result.kind, 'PLAN')
    if (result.kind !== 'PLAN') {
      return
    }
    assert.deepEqual(result.removals, [CARGILL_BARLEY_ID])
    assert.lengthOf(result.corrections, 1)
    assert.containSubset(result.corrections[0], {
      productLotId: WHEAT_ID,
      customerId: CARGILL_ID,
      productName: ' Blé dur ',
      identityChanges: true,
    })
    assert.lengthOf(result.insertions, 1)
    assert.containSubset(result.insertions[0], { customerId: CARGILL_ID, productName: 'Colza' })
  })

  test('plans nothing for an empty change', ({ assert }) => {
    assert.deepEqual(plan(), { kind: 'PLAN', removals: [], corrections: [], insertions: [] })
  })
})

test.group('planCustomerProductLotsCorrection — R5 identity after the change', () => {
  test('accepts two lots swapping their names, both parked first', ({ assert }) => {
    const result = plan({
      productLots: [entry('Orge', WHEAT_ID), entry('Blé tendre', CARGILL_BARLEY_ID)],
    })

    assert.equal(result.kind, 'PLAN')
    assert.deepEqual(
      result.kind === 'PLAN' ? result.corrections.map((lot) => lot.identityChanges) : [],
      [true, true],
    )
  })

  test('does not park a lot renamed only in case, or left unchanged', ({ assert }) => {
    const result = plan({
      productLots: [entry('BLÉ TENDRE', WHEAT_ID), entry('Orge', CARGILL_BARLEY_ID)],
    })

    assert.deepEqual(
      result.kind === 'PLAN' ? result.corrections.map((lot) => lot.identityChanges) : null,
      [false, false],
    )
  })

  test('refuses listed lots that would share a name, at each of them', ({ assert }) => {
    assert.deepEqual(
      issuesOf(
        plan({ productLots: [entry('Colza', WHEAT_ID), entry(' colza ', CARGILL_BARLEY_ID)] }),
      ),
      [
        ['productLots.0.productName', 'productLotIdentityUnique'],
        ['productLots.1.productName', 'productLotIdentityUnique'],
      ],
    )
  })

  test('refuses a lot renamed to the name of a lot of the customer left out of the change', ({
    assert,
  }) => {
    assert.deepEqual(issuesOf(plan({ productLots: [entry('orge', WHEAT_ID)] })), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
  })

  test("accepts a name another customer's lot has, the group staying with its customer", ({
    assert,
  }) => {
    const lots = LOTS.filter((lot) => lot.id !== CARGILL_BARLEY_ID)

    assert.equal(plan({ productLots: [entry('Orge', WHEAT_ID)] }, { lots }).kind, 'PLAN')
  })
})

test.group('planCustomerProductLotsCorrection — R4 and R6 removals and additions', () => {
  test('refuses to remove a lot that has had a warehouse door, at its position', ({ assert }) => {
    const result = plan(
      { removedProductLotIds: [CARGILL_BARLEY_ID, WHEAT_ID] },
      { doors: [WHEAT_ID] },
    )

    assert.deepEqual(result.kind === 'ISSUES' ? result.issues : [], [
      {
        field: 'removedProductLotIds.1',
        rule: 'removableProductLot',
        message: 'This product lot has warehouse door assignments',
      },
    ])
  })

  test('accepts a lot removed and another added under its name', ({ assert }) => {
    const result = plan({
      productLots: [entry('orge')],
      removedProductLotIds: [CARGILL_BARLEY_ID],
    })

    assert.equal(result.kind, 'PLAN')
  })

  test('refuses an added lot taking the name of a lot the customer keeps', ({ assert }) => {
    assert.deepEqual(issuesOf(plan({ productLots: [entry('Colza'), entry('BLÉ TENDRE')] })), [
      ['productLots.1.productName', 'productLotIdentityUnique'],
    ])
  })

  test('refuses to leave the discharge without any lot', ({ assert }) => {
    const lots = LOTS.filter((lot) => lot.customerId === CARGILL_ID)

    assert.deepEqual(plan({ removedProductLotIds: [WHEAT_ID, CARGILL_BARLEY_ID] }, { lots }), {
      kind: 'LAST_LOT',
    })
    assert.equal(
      plan({ removedProductLotIds: [WHEAT_ID, CARGILL_BARLEY_ID] }, { lots: LOTS }).kind,
      'PLAN',
    )
  })

  test('reports a refused removal before saying no lot would be left', ({ assert }) => {
    const lots = LOTS.filter((lot) => lot.customerId === CARGILL_ID)

    assert.deepEqual(
      issuesOf(
        plan({ removedProductLotIds: [WHEAT_ID, CARGILL_BARLEY_ID] }, { lots, doors: [WHEAT_ID] }),
      ),
      [['removedProductLotIds.0', 'removableProductLot']],
    )
  })
})

test.group('planCustomerProductLotsCorrection — R3 and moves', () => {
  const move = (productLots: ReturnType<typeof entry>[]) => ({
    targetCustomerId: SOUFFLET_ID,
    productLots,
  })

  test('refuses to move the lots to a customer that is not available', ({ assert }) => {
    for (const targetStatus of [null, 'ARCHIVED']) {
      assert.deepEqual(
        issuesOf(plan(move([entry('Blé tendre', WHEAT_ID)]), { targetStatus })),
        [['customerId', 'availableCustomer']],
        String(targetStatus),
      )
    }
  })

  test('moves the listed lots to an available customer, parking each of them', ({ assert }) => {
    const lots = LOTS.filter((lot) => lot.id !== SOUFFLET_BARLEY_ID)
    const result = plan(move([entry('Blé tendre', WHEAT_ID), entry('Orge', CARGILL_BARLEY_ID)]), {
      lots,
    })

    assert.equal(result.kind, 'PLAN')
    assert.deepEqual(
      result.kind === 'PLAN'
        ? result.corrections.map((lot) => [lot.customerId, lot.identityChanges])
        : [],
      [
        [SOUFFLET_ID, true],
        [SOUFFLET_ID, true],
      ],
    )
  })

  test("refuses a moved lot taking the name of one of the new customer's lots", ({ assert }) => {
    assert.deepEqual(issuesOf(plan(move([entry('orge', CARGILL_BARLEY_ID)]))), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
  })

  test('leaves a lot the move does not name with its customer', ({ assert }) => {
    // Cargill's barley stays with Cargill, so wheat moved as `Orge` meets Soufflet's barley only.
    assert.deepEqual(issuesOf(plan(move([entry('Orge', WHEAT_ID)]))), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
    assert.equal(plan(move([entry('Blé tendre', WHEAT_ID)])).kind, 'PLAN')
  })

  test('does not check the customer when the lots stay with it', ({ assert }) => {
    const result = plan(
      { targetCustomerId: CARGILL_ID.toUpperCase(), productLots: [entry('Blé tendre', WHEAT_ID)] },
      { targetStatus: null },
    )

    assert.equal(result.kind, 'PLAN')
  })
})
