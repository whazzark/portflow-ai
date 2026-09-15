import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import ProductLot from '#models/product_lot'

import {
  assignDoor,
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from './preparation_scenario.ts'

test.group('Product lot removal HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, barley } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const url = `/api/v1/discharges/${discharge.id}/product-lots/${barley.id}`

    ;(await client.delete(url)).assertStatus(401)
    ;(await client.delete(url).loginAs(pending)).assertStatus(401)
    ;(await client.delete(url).loginAs(observer)).assertStatus(403)

    assert.exists(await ProductLot.find(barley.id))
  })

  test('removes a lot for every preparing role and drops it from the expected tonnage', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, barley } = await createPreparedDischarge()

      const response = await client
        .delete(`/api/v1/discharges/${discharge.id}/product-lots/${barley.id}`)
        .loginAs(await preparer(role))

      response.assertStatus(200)
      assert.equal(response.body().data.expectedTonnage, '1200.500')
      assert.notInclude(
        response.body().data.productLots.map((lot: { id: string }) => lot.id),
        barley.id,
      )
      assert.isNull(await ProductLot.find(barley.id))
    }
  })

  test('refuses to remove the only lot of a discharge', async ({ assert, client }) => {
    const { discharge, wheat, barley } = await createPreparedDischarge()
    const lead = await preparer()
    await client
      .delete(`/api/v1/discharges/${discharge.id}/product-lots/${barley.id}`)
      .loginAs(lead)

    const response = await client
      .delete(`/api/v1/discharges/${discharge.id}/product-lots/${wheat.id}`)
      .loginAs(lead)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_DISCHARGE_LAST_PRODUCT_LOT')
    assert.exists(await ProductLot.find(wheat.id))
  })

  test('refuses to remove a lot that has or had a door assignment', async ({ assert, client }) => {
    const lead = await preparer()

    for (const ended of [true, false]) {
      const prepared = await createPreparedDischarge()
      await assignDoor(prepared, prepared.barley.id, { ended })

      const response = await client
        .delete(`/api/v1/discharges/${prepared.discharge.id}/product-lots/${prepared.barley.id}`)
        .loginAs(lead)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS')
      assert.exists(await ProductLot.find(prepared.barley.id))
    }
  })

  test('refuses a removal on an active or closed discharge', async ({ assert, client }) => {
    const lead = await preparer()

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge, barley } = await createPreparedDischarge(status)

      const response = await client
        .delete(`/api/v1/discharges/${discharge.id}/product-lots/${barley.id}`)
        .loginAs(lead)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.exists(await ProductLot.find(barley.id))
    }
  })

  test('answers not found for a lot of another discharge', async ({ assert, client }) => {
    const { discharge } = await createPreparedDischarge()
    const other = await createPreparedDischarge()

    const response = await client
      .delete(`/api/v1/discharges/${discharge.id}/product-lots/${other.barley.id}`)
      .loginAs(await preparer())

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_PRODUCT_LOT_NOT_FOUND')
    assert.exists(await ProductLot.find(other.barley.id))
  })
})
