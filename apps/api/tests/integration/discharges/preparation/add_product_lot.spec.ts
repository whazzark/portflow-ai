import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import ProductLot from '#models/product_lot'

import { createPreparedDischarge, PREPARING_ROLES, preparer } from './preparation_scenario.ts'

const lotCount = async (dischargeId: string) =>
  (await ProductLot.query().where('dischargeId', dischargeId)).length

test.group('Product lot addition HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, cargill } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = {
      customerId: cargill.id,
      productName: 'Maïs',
      expectedQuantityTonnes: '10',
      description: null,
    }
    const url = `/api/v1/discharges/${discharge.id}/product-lots`

    ;(await client.post(url).json(body)).assertStatus(401)
    ;(await client.post(url).loginAs(pending).json(body)).assertStatus(401)
    const forbidden = await client.post(url).loginAs(observer).json(body)

    forbidden.assertStatus(403)
    assert.equal(await lotCount(discharge.id), 2)
  })

  test('adds a lot for every preparing role and includes it in the expected tonnage', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, cargill } = await createPreparedDischarge()

      const response = await client
        .post(`/api/v1/discharges/${discharge.id}/product-lots`)
        .loginAs(await preparer(role))
        .json({
          customerId: cargill.id,
          productName: '  Maïs  ',
          expectedQuantityTonnes: '99.5',
          description: '',
        })

      response.assertStatus(201)
      const data = response.body().data
      assert.equal(data.expectedTonnage, '2100.000')
      const added = data.productLots.find(
        (lot: { productName: string }) => lot.productName === 'Maïs',
      )
      assert.containSubset(added, {
        customer: { id: cargill.id },
        expectedQuantityTonnes: '99.500',
        description: null,
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
        .json({
          customerId: cargill.id,
          productName: 'Maïs',
          expectedQuantityTonnes: '10',
          description: null,
        })

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
  })

  test('refuses a lot on an active or closed discharge', async ({ assert, client }) => {
    const lead = await preparer()

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge, cargill } = await createPreparedDischarge(status)

      const response = await client
        .post(`/api/v1/discharges/${discharge.id}/product-lots`)
        .loginAs(lead)
        .json({
          customerId: cargill.id,
          productName: 'Maïs',
          expectedQuantityTonnes: '10',
          description: null,
        })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.equal(await lotCount(discharge.id), 2)
    }
  })

  test('rejects an invalid quantity, an archived customer, and a duplicate lot', async ({
    assert,
    client,
  }) => {
    const { discharge, cargill } = await createPreparedDischarge()
    const archived = await CustomerFactory.apply('archived').create()
    const lead = await preparer()
    const url = `/api/v1/discharges/${discharge.id}/product-lots`

    for (const [body, field, rule] of [
      [
        {
          customerId: cargill.id,
          productName: 'Maïs',
          expectedQuantityTonnes: '0',
          description: null,
        },
        'expectedQuantityTonnes',
        undefined,
      ],
      [
        {
          customerId: archived.id,
          productName: 'Maïs',
          expectedQuantityTonnes: '10',
          description: null,
        },
        'customerId',
        'availableCustomer',
      ],
      [
        {
          customerId: cargill.id,
          productName: ' BLÉ TENDRE ',
          expectedQuantityTonnes: '10',
          description: null,
        },
        'productName',
        'productLotIdentityUnique',
      ],
    ] as const) {
      const response = await client.post(url).loginAs(lead).json(body)

      response.assertStatus(422)
      const detail = response
        .body()
        .error.details.find((candidate: { field: string }) => candidate.field === field)
      assert.exists(detail, `expected a refusal on ${field}`)
      if (rule) {
        assert.equal(detail.rule, rule)
      }
    }
    assert.equal(await lotCount(discharge.id), 2)
  })
})
