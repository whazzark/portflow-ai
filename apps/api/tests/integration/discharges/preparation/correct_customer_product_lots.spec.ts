import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { Decimal } from 'decimal.js'

import { CustomerFactory } from '#database/factories/customer_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { UserFactory } from '#database/factories/user_factory'
import ProductLot from '#models/product_lot'

import {
  assignDoor,
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from './preparation_scenario.ts'

/** The prepared discharge, whose Cargill customer gets a second lot to correct alongside wheat. */
async function prepareCargillLots(
  status: Parameters<typeof createPreparedDischarge>[0] = 'PLANNED',
) {
  const prepared = await createPreparedDischarge(status)
  const cargillBarley = await ProductLotFactory.merge({
    dischargeId: prepared.discharge.id,
    customerId: prepared.cargill.id,
    productName: 'Orge',
    expectedQuantityTonnes: new Decimal('300.000'),
    description: null,
  }).create()

  return { ...prepared, cargillBarley }
}

type Prepared = Awaited<ReturnType<typeof prepareCargillLots>>

function urlOf(prepared: Prepared, customerId = prepared.cargill.id) {
  return `/api/v1/discharges/${prepared.discharge.id}/customers/${customerId}/product-lots`
}

function lotEntry(productName: string, id?: string, overrides: Record<string, unknown> = {}) {
  return {
    ...(id ? { id } : {}),
    productName,
    expectedQuantityTonnes: '100',
    description: null,
    ...overrides,
  }
}

function correctionBody(prepared: Prepared, overrides: Record<string, unknown> = {}) {
  return {
    customerId: prepared.cargill.id,
    productLots: [],
    removedProductLotIds: [],
    ...overrides,
  }
}

function detailsOf(response: { body: () => { error: { details: unknown[] } } }) {
  return (response.body().error.details as Array<{ field: string; rule: string }>).map((detail) => [
    detail.field,
    detail.rule,
  ])
}

async function lotsOf(prepared: Prepared) {
  const lots = await ProductLot.query().where('dischargeId', prepared.discharge.id).orderBy('id')

  return lots.map((lot) => ({
    id: lot.id,
    customerId: lot.customerId,
    productName: lot.productName,
    expectedQuantityTonnes: lot.expectedQuantityTonnes.toFixed(3),
    description: lot.description,
  }))
}

test.group('Customer product lots correction HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test("corrects a customer's lots for every preparing role, keeping their identities and doors", async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const prepared = await prepareCargillLots()
      await assignDoor(prepared, prepared.wheat.id, { ended: false })

      const response = await client
        .patch(urlOf(prepared))
        .loginAs(await preparer(role))
        .json(
          correctionBody(prepared, {
            productLots: [
              lotEntry('Blé tendre', prepared.wheat.id, { expectedQuantityTonnes: '1000' }),
              lotEntry('Orge', prepared.cargillBarley.id, {
                expectedQuantityTonnes: '350.25',
                description: 'Hold 3',
              }),
            ],
          }),
        )

      response.assertStatus(200)
      const data = response.body().data
      // 1000 + 350.250 for Cargill, and Soufflet's barley untouched at 800.
      assert.equal(data.expectedTonnage, '2150.250')
      const wheat = data.productLots.find((lot: { id: string }) => lot.id === prepared.wheat.id)
      assert.containSubset(wheat, { productName: 'Blé tendre', expectedQuantityTonnes: '1000.000' })
      assert.lengthOf(wheat.doorAssignments, 1)
      assert.containSubset(
        data.productLots.find((lot: { id: string }) => lot.id === prepared.cargillBarley.id),
        { productName: 'Orge', expectedQuantityTonnes: '350.250', description: 'Hold 3' },
      )
    }
  })

  test('accepts two lots of the customer swapping their names', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [
            lotEntry('Orge', prepared.wheat.id),
            lotEntry('Blé tendre', prepared.cargillBarley.id),
          ],
        }),
      )

    response.assertStatus(200)
    const lots = await lotsOf(prepared)
    assert.equal(lots.find((lot) => lot.id === prepared.wheat.id)?.productName, 'Orge')
    assert.equal(
      lots.find((lot) => lot.id === prepared.cargillBarley.id)?.productName,
      'Blé tendre',
    )
  })

  test('rejects a lot renamed to the name of a lot of the customer left out', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [lotEntry('blé tendre ', prepared.cargillBarley.id)],
        }),
      )

    response.assertStatus(422)
    assert.deepEqual(detailsOf(response), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('rejects invalid lot values at their row, and changes nothing', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [
            lotEntry('Blé tendre', prepared.wheat.id, { expectedQuantityTonnes: '0' }),
            lotEntry('   ', prepared.cargillBarley.id),
          ],
        }),
      )

    response.assertStatus(422)
    const fields = detailsOf(response).map(([field]) => field)
    assert.include(fields, 'productLots.0.expectedQuantityTonnes')
    assert.include(fields, 'productLots.1.productName')
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('leaves a lot of the customer the change does not name untouched', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [lotEntry('Blé dur', prepared.wheat.id)],
        }),
      )

    response.assertStatus(200)
    const after = await lotsOf(prepared)
    assert.deepEqual(
      after.find((lot) => lot.id === prepared.cargillBarley.id),
      before.find((lot) => lot.id === prepared.cargillBarley.id),
    )
    assert.equal(after.find((lot) => lot.id === prepared.wheat.id)?.productName, 'Blé dur')
  })
})

test.group('Customer product lots correction guards', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests, changing nothing', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const before = await lotsOf(prepared)
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = correctionBody(prepared, {
      productLots: [lotEntry('Blé dur', prepared.wheat.id)],
    })

    ;(await client.patch(urlOf(prepared)).json(body)).assertStatus(401)
    ;(await client.patch(urlOf(prepared)).loginAs(pending).json(body)).assertStatus(401)
    // An observer is refused before the body is read: an invalid one changes nothing to that.
    ;(await client.patch(urlOf(prepared)).loginAs(observer).json({ customerId: 'x' })).assertStatus(
      403,
    )
    ;(await client.patch(urlOf(prepared)).loginAs(observer).json(body)).assertStatus(403)

    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('refuses a correction on an active or closed discharge', async ({ assert, client }) => {
    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const prepared = await prepareCargillLots(status)
      const before = await lotsOf(prepared)

      const response = await client
        .patch(urlOf(prepared))
        .loginAs(await preparer())
        .json(correctionBody(prepared, { productLots: [lotEntry('Blé dur', prepared.wheat.id)] }))

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.deepEqual(await lotsOf(prepared), before)
    }
  })

  test('answers not found for an unknown discharge', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()
    const lead = await preparer()

    for (const dischargeId of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client
        .patch(`/api/v1/discharges/${dischargeId}/customers/${prepared.cargill.id}/product-lots`)
        .loginAs(lead)
        .json(correctionBody(prepared))

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
  })

  test("refuses a lot that is not one of the customer's lots on this discharge", async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const other = await prepareCargillLots()
    const before = await lotsOf(prepared)
    const lead = await preparer()

    for (const body of [
      correctionBody(prepared, { productLots: [lotEntry('Orge', prepared.barley.id)] }),
      correctionBody(prepared, { productLots: [lotEntry('Blé tendre', other.wheat.id)] }),
      correctionBody(prepared, {
        removedProductLotIds: ['00000000-0000-4000-8000-000000000000'],
      }),
    ]) {
      const response = await client.patch(urlOf(prepared)).loginAs(lead).json(body)

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_PRODUCT_LOT_NOT_FOUND')
    }
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('refuses to add lots through a customer without lots on this discharge', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const archived = await CustomerFactory.apply('archived').create()
    const before = await lotsOf(prepared)
    const lead = await preparer()

    for (const customerId of [archived.id, '00000000-0000-4000-8000-000000000000']) {
      const response = await client
        .patch(urlOf(prepared, customerId))
        .loginAs(lead)
        .json(correctionBody(prepared, { customerId, productLots: [lotEntry('Maïs')] }))

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_PRODUCT_LOT_NOT_FOUND')
    }
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('refuses a lot listed twice', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [lotEntry('Blé tendre', prepared.wheat.id)],
          removedProductLotIds: [prepared.wheat.id],
        }),
      )

    response.assertStatus(422)
    assert.deepEqual(detailsOf(response), [['removedProductLotIds.0', 'productLotListedOnce']])
  })
})

test.group('Customer product lots correction removals and additions', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('corrects, removes, and adds lots of the customer in one change', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [
            lotEntry('Blé tendre', prepared.wheat.id, { expectedQuantityTonnes: '1100' }),
            lotEntry('Colza', undefined, { expectedQuantityTonnes: '250', description: 'Hold 4' }),
          ],
          removedProductLotIds: [prepared.cargillBarley.id],
        }),
      )

    response.assertStatus(200)
    // 1100 + 250 for Cargill, and Soufflet's barley at 800.
    assert.equal(response.body().data.expectedTonnage, '2150.000')
    const cargillLots = (await lotsOf(prepared)).filter(
      (lot) => lot.customerId === prepared.cargill.id,
    )
    assert.sameMembers(
      cargillLots.map((lot) => lot.productName),
      ['Blé tendre', 'Colza'],
    )
    const added = cargillLots.find((lot) => lot.productName === 'Colza')
    assert.isFalse([prepared.wheat.id, prepared.cargillBarley.id].includes(added?.id ?? ''))
    assert.containSubset(added, { expectedQuantityTonnes: '250.000', description: 'Hold 4' })
  })

  test('refuses to remove a lot that has had a warehouse door, changing nothing', async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    await assignDoor(prepared, prepared.cargillBarley.id, { ended: true })
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [lotEntry('Colza')],
          removedProductLotIds: [prepared.cargillBarley.id],
        }),
      )

    response.assertStatus(422)
    assert.deepEqual(detailsOf(response), [['removedProductLotIds.0', 'removableProductLot']])
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('refuses to remove the last lot of the discharge', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()
    await ProductLot.query().whereIn('id', [prepared.barley.id, prepared.cargillBarley.id]).delete()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(correctionBody(prepared, { removedProductLotIds: [prepared.wheat.id] }))

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_DISCHARGE_LAST_PRODUCT_LOT')
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test("removes every lot of a customer while another customer's lots remain", async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          removedProductLotIds: [prepared.wheat.id, prepared.cargillBarley.id],
        }),
      )

    response.assertStatus(200)
    assert.deepEqual(
      (await lotsOf(prepared)).map((lot) => lot.id),
      [prepared.barley.id],
    )
  })

  test('accepts a lot removed and another added under its name', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          productLots: [lotEntry('ORGE')],
          removedProductLotIds: [prepared.cargillBarley.id],
        }),
      )

    response.assertStatus(200)
    const names = (await lotsOf(prepared))
      .filter((lot) => lot.customerId === prepared.cargill.id)
      .map((lot) => lot.productName)
    assert.sameMembers(names, ['Blé tendre', 'ORGE'])
  })
})

test.group('Customer product lots correction moves', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test("moves a customer's lots to another customer, keeping their identities and doors", async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    await assignDoor(prepared, prepared.wheat.id, { ended: false })
    // Soufflet already has `Orge`: renamed out of the way, its lots join the moved ones.
    await ProductLot.query()
      .where('id', prepared.barley.id)
      .update({ productName: 'Orge fourragère' })

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          customerId: prepared.soufflet.id,
          productLots: [
            lotEntry('Blé tendre', prepared.wheat.id),
            lotEntry('Orge', prepared.cargillBarley.id),
          ],
        }),
      )

    response.assertStatus(200)
    const lots = await lotsOf(prepared)
    assert.isTrue(lots.every((lot) => lot.customerId === prepared.soufflet.id))
    const wheat = response
      .body()
      .data.productLots.find((lot: { id: string }) => lot.id === prepared.wheat.id)
    assert.equal(wheat.customer.id, prepared.soufflet.id)
    assert.lengthOf(wheat.doorAssignments, 1)
  })

  test("refuses a moved lot taking the name of one of the new customer's lots", async ({
    assert,
    client,
  }) => {
    const prepared = await prepareCargillLots()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          customerId: prepared.soufflet.id,
          productLots: [lotEntry('Orge', prepared.cargillBarley.id)],
        }),
      )

    response.assertStatus(422)
    assert.deepEqual(detailsOf(response), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
    ])
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('refuses to move the lots to an archived customer', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()
    const archived = await CustomerFactory.apply('archived').create()
    const before = await lotsOf(prepared)

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          customerId: archived.id,
          productLots: [lotEntry('Blé tendre', prepared.wheat.id)],
        }),
      )

    response.assertStatus(422)
    assert.deepEqual(detailsOf(response), [['customerId', 'availableCustomer']])
    assert.deepEqual(await lotsOf(prepared), before)
  })

  test('leaves a lot the move does not name with its customer', async ({ assert, client }) => {
    const prepared = await prepareCargillLots()

    const response = await client
      .patch(urlOf(prepared))
      .loginAs(await preparer())
      .json(
        correctionBody(prepared, {
          customerId: prepared.soufflet.id,
          productLots: [lotEntry('Blé tendre', prepared.wheat.id)],
        }),
      )

    response.assertStatus(200)
    const lots = await lotsOf(prepared)
    assert.equal(lots.find((lot) => lot.id === prepared.wheat.id)?.customerId, prepared.soufflet.id)
    assert.equal(
      lots.find((lot) => lot.id === prepared.cargillBarley.id)?.customerId,
      prepared.cargill.id,
    )
  })
})
