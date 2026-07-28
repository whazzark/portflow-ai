import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('POST /api/v1/customers/reactivate', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated requests', async ({ assert, client }) => {
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client.post('/api/v1/customers/reactivate').json({ ids: [customer.id] })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects duplicate IDs', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/customers/reactivate')
      .loginAs(admin)
      .json({ ids: [customer.id, customer.id] })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })

  test('reactivates multiple customers with a shared comment', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const first = await CustomerFactory.apply('archived').create()
    const second = await CustomerFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/customers/reactivate')
      .loginAs(admin)
      .json({
        ids: [first.id, second.id],
        comment: '  Back in service  ',
      })

    response.assertStatus(200)
    assert.isTrue(
      response
        .body()
        .data.updatedCustomers.every(
          (customer: { status: string; reactivationComment: string }) =>
            customer.status === 'AVAILABLE' && customer.reactivationComment === 'Back in service',
        ),
    )
  })

  test('rejects non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const customer = await CustomerFactory.apply('archived').create()
    const response = await client
      .post('/api/v1/customers/reactivate')
      .loginAs(observer)
      .json({ ids: [customer.id] })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })
})
