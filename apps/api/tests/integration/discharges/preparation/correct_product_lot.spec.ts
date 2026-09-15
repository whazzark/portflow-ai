import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import Customer from '#models/customer'
import ProductLot from '#models/product_lot'

import {
  assignDoor,
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from './preparation_scenario.ts'

function lotBody(customerId: string, overrides: Record<string, unknown> = {}) {
  return {
    customerId,
    productName: 'Blé tendre',
    expectedQuantityTonnes: '1000',
    description: 'Corrected manifest',
    ...overrides,
  }
}

test.group('Product lot correction HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, wheat, cargill } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const url = `/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`

    ;(await client.patch(url).json(lotBody(cargill.id))).assertStatus(401)
    ;(await client.patch(url).loginAs(pending).json(lotBody(cargill.id))).assertStatus(401)
    ;(await client.patch(url).loginAs(observer).json(lotBody(cargill.id))).assertStatus(403)

    const unchanged = await ProductLot.findOrFail(wheat.id)
    assert.equal(unchanged.expectedQuantityTonnes.toFixed(3), '1200.500')
  })

  test('corrects a lot for every preparing role, keeping its identity and door assignments', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const prepared = await createPreparedDischarge()
      await assignDoor(prepared, prepared.wheat.id, { ended: false })
      const newCustomer = prepared.soufflet

      const response = await client
        .patch(`/api/v1/discharges/${prepared.discharge.id}/product-lots/${prepared.wheat.id}`)
        .loginAs(await preparer(role))
        .json(lotBody(newCustomer.id, { productName: 'Blé dur' }))

      response.assertStatus(200)
      const data = response.body().data
      assert.equal(data.expectedTonnage, '1800.000')
      const corrected = data.productLots.find((lot: { id: string }) => lot.id === prepared.wheat.id)
      assert.containSubset(corrected, {
        customer: { id: newCustomer.id },
        productName: 'Blé dur',
        expectedQuantityTonnes: '1000.000',
        description: 'Corrected manifest',
      })
      assert.lengthOf(corrected.doorAssignments, 1)
    }
  })

  test('accepts a lot renamed to its own name in another case', async ({ client }) => {
    const { discharge, wheat, cargill } = await createPreparedDischarge()

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`)
      .loginAs(await preparer())
      .json(lotBody(cargill.id, { productName: 'BLÉ TENDRE' }))

    response.assertStatus(200)
  })

  test('answers not found for an unknown discharge and for a lot outside it', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat, cargill } = await createPreparedDischarge()
    const other = await createPreparedDischarge()
    const lead = await preparer()

    for (const [dischargeId, lotId, code] of [
      ['00000000-0000-4000-8000-000000000000', wheat.id, 'E_DISCHARGE_NOT_FOUND'],
      [discharge.id, '00000000-0000-4000-8000-000000000000', 'E_PRODUCT_LOT_NOT_FOUND'],
      [discharge.id, 'not-a-uuid', 'E_PRODUCT_LOT_NOT_FOUND'],
      [discharge.id, other.wheat.id, 'E_PRODUCT_LOT_NOT_FOUND'],
    ] as const) {
      const response = await client
        .patch(`/api/v1/discharges/${dischargeId}/product-lots/${lotId}`)
        .loginAs(lead)
        .json(lotBody(cargill.id))

      response.assertStatus(404)
      assert.equal(response.body().error.code, code)
    }
  })

  test('refuses a correction on an active discharge', async ({ assert, client }) => {
    const { discharge, wheat, cargill } = await createPreparedDischarge('ACTIVE')

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`)
      .loginAs(await preparer())
      .json(lotBody(cargill.id))

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
  })

  test('rejects a correction that would duplicate another lot', async ({ assert, client }) => {
    const { discharge, wheat, soufflet } = await createPreparedDischarge()

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`)
      .loginAs(await preparer())
      .json(lotBody(soufflet.id, { productName: ' orge ' }))

    response.assertStatus(422)
    assert.deepInclude(
      response
        .body()
        .error.details.map((detail: { field: string; rule: string }) => [
          detail.field,
          detail.rule,
        ]),
      ['productName', 'productLotIdentityUnique'],
    )
  })

  test('keeps the current customer without checking it again', async ({ client }) => {
    const { discharge, wheat, cargill } = await createPreparedDischarge()
    // Archived behind the application's back: a customer in use cannot be archived through it.
    await Customer.query().where('id', cargill.id).update({ status: 'ARCHIVED' })

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`)
      .loginAs(await preparer())
      .json(lotBody(cargill.id))

    response.assertStatus(200)
  })
})
