import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import ProductLot from '#models/product_lot'

import { createPreparedDischarge, PREPARING_ROLES, preparer } from './preparation_scenario.ts'

const lotCount = async (dischargeId: string) =>
  (await ProductLot.query().where('dischargeId', dischargeId)).length

const lot = (customerId: string, productName: string, expectedQuantityTonnes = '10') => ({
  customerId,
  productName,
  expectedQuantityTonnes,
  description: null,
})

const refusedFields = (body: { error: { details: Array<{ field: string; rule: string }> } }) =>
  body.error.details.map((detail) => [detail.field, detail.rule])

test.group('Product lots addition HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, cargill } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = { productLots: [lot(cargill.id, 'Maïs')] }
    const url = `/api/v1/discharges/${discharge.id}/product-lots`

    ;(await client.post(url).json(body)).assertStatus(401)
    ;(await client.post(url).loginAs(pending).json(body)).assertStatus(401)
    const forbidden = await client.post(url).loginAs(observer).json(body)

    forbidden.assertStatus(403)
    assert.equal(await lotCount(discharge.id), 2)
  })

  test('adds several lots for every preparing role and includes them in the expected tonnage', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, cargill, soufflet } = await createPreparedDischarge()

      const response = await client
        .post(`/api/v1/discharges/${discharge.id}/product-lots`)
        .loginAs(await preparer(role))
        .json({
          productLots: [
            { ...lot(cargill.id, '  Maïs  ', '99.5'), description: '' },
            { ...lot(soufflet.id, 'Colza', '100'), description: ' Récolte 2026 ' },
          ],
        })

      response.assertStatus(201)
      const data = response.body().data
      assert.equal(data.expectedTonnage, '2200.000')
      const byName = (name: string) =>
        data.productLots.find(
          (candidate: { productName: string }) => candidate.productName === name,
        )
      assert.containSubset(byName('Maïs'), {
        customer: { id: cargill.id },
        expectedQuantityTonnes: '99.500',
        description: null,
      })
      assert.containSubset(byName('Colza'), {
        customer: { id: soufflet.id },
        expectedQuantityTonnes: '100.000',
        description: 'Récolte 2026',
      })
    }
  })

  test('answers not found for an unknown or malformed discharge', async ({ assert, client }) => {
    const { cargill } = await createPreparedDischarge()
    const lead = await preparer()

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client
        .post(`/api/v1/discharges/${id}/product-lots`)
        .loginAs(lead)
        .json({ productLots: [lot(cargill.id, 'Maïs')] })

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
  })

  test('refuses lots on an active or closed discharge', async ({ assert, client }) => {
    const lead = await preparer()

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge, cargill } = await createPreparedDischarge(status)

      const response = await client
        .post(`/api/v1/discharges/${discharge.id}/product-lots`)
        .loginAs(lead)
        .json({ productLots: [lot(cargill.id, 'Maïs')] })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.equal(await lotCount(discharge.id), 2)
    }
  })

  test('reports each refused lot at its position and adds none of the batch', async ({
    assert,
    client,
  }) => {
    const { discharge, cargill } = await createPreparedDischarge()
    const archived = await CustomerFactory.apply('archived').create()
    const lead = await preparer()
    const url = `/api/v1/discharges/${discharge.id}/product-lots`

    const invalidQuantity = await client
      .post(url)
      .loginAs(lead)
      .json({ productLots: [lot(cargill.id, 'Maïs'), lot(cargill.id, 'Colza', '0')] })
    invalidQuantity.assertStatus(422)
    assert.deepInclude(
      invalidQuantity.body().error.details.map((detail: { field: string }) => detail.field),
      'productLots.1.expectedQuantityTonnes',
    )

    const refusedReferences = await client
      .post(url)
      .loginAs(lead)
      .json({
        productLots: [
          lot(cargill.id, 'Maïs'),
          lot(cargill.id, ' BLÉ TENDRE '),
          lot(archived.id, 'Colza'),
        ],
      })
    refusedReferences.assertStatus(422)
    assert.deepEqual(refusedFields(refusedReferences.body()), [
      ['productLots.1.productName', 'productLotIdentityUnique'],
      ['productLots.2.customerId', 'availableCustomer'],
    ])

    const duplicatedInBatch = await client
      .post(url)
      .loginAs(lead)
      .json({ productLots: [lot(cargill.id, 'Maïs'), lot(cargill.id, 'maïs ')] })
    duplicatedInBatch.assertStatus(422)
    assert.deepEqual(refusedFields(duplicatedInBatch.body()), [
      ['productLots.0.productName', 'productLotIdentityUnique'],
      ['productLots.1.productName', 'productLotIdentityUnique'],
    ])

    assert.equal(await lotCount(discharge.id), 2)
  })

  test('refuses an empty batch, more than 100 lots, and a single lot outside a list', async ({
    assert,
    client,
  }) => {
    const { discharge, cargill } = await createPreparedDischarge()
    const lead = await preparer()
    const url = `/api/v1/discharges/${discharge.id}/product-lots`

    for (const body of [
      { productLots: [] },
      {
        productLots: Array.from({ length: 101 }, (_, index) => lot(cargill.id, `Lot ${index}`)),
      },
      lot(cargill.id, 'Maïs'),
    ]) {
      const response = await client.post(url).loginAs(lead).json(body)

      response.assertStatus(422)
    }
    assert.equal(await lotCount(discharge.id), 2)
  })
})
