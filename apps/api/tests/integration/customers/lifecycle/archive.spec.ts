import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { createPersistedUsageScenario } from '../../../support/persisted_discharge_usage.js'

test.group('POST /api/v1/customers/:id/archive', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated archival', async ({ assert, client }) => {
    const customer = await CustomerFactory.create()
    const response = await client.post(`/api/v1/customers/${customer.id}/archive`).json({})

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects archival for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const customer = await CustomerFactory.create()
    const response = await client.post(`/api/v1/customers/${customer.id}/archive`).loginAs(observer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('archives a customer with lifecycle metadata', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post(`/api/v1/customers/${customer.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Retired account' })

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
    assert.equal(response.body().data.archiveComment, 'Retired account')
    assert.equal(response.body().data.archivedByUserId, admin.id)
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .post(`/api/v1/customers/${customer.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await customer.refresh()
    assert.equal(customer.status, 'AVAILABLE')
  })

  test('rejects archival when the customer is used by a planned or active discharge', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    for (const status of ['PLANNED', 'ACTIVE'] as const) {
      const { customer } = await createPersistedUsageScenario({ status })
      const response = await client
        .post(`/api/v1/customers/${customer.id}/archive`)
        .loginAs(admin)
        .json({})

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_CUSTOMER_IN_USE')
      await customer.refresh()
      assert.equal(customer.status, 'AVAILABLE')
      assert.isNull(customer.archivedAt)
      assert.isNull(customer.archivedByUserId)
      assert.isNull(customer.archiveComment)
    }
  })

  test('allows archival when only a closed discharge references the customer', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const { customer } = await createPersistedUsageScenario({ status: 'CLOSED' })
    const response = await client
      .post(`/api/v1/customers/${customer.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.equal(response.body().data.status, 'ARCHIVED')
  })
})
