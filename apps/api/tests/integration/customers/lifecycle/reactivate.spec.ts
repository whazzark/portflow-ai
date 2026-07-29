import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('POST /api/v1/customers/:id/reactivate', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated reactivation', async ({ assert, client }) => {
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client.post(`/api/v1/customers/${customer.id}/reactivate`)

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects reactivation for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/customers/${customer.id}/reactivate`)
      .loginAs(observer)

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('reactivates the same customer identity with lifecycle metadata', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/customers/${customer.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Returning to operations' })

    response.assertStatus(200)
    assert.equal(response.body().data.id, customer.id)
    assert.equal(response.body().data.status, 'AVAILABLE')
    assert.equal(response.body().data.reactivationComment, 'Returning to operations')
    assert.equal(response.body().data.reactivatedByUserId, admin.id)
  })

  test('rejects an overlong comment before changing state', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client
      .post(`/api/v1/customers/${customer.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'a'.repeat(1001) })

    response.assertStatus(422)
    await customer.refresh()
    assert.equal(customer.status, 'ARCHIVED')
  })
})
