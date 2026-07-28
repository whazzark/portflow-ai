import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('GET /api/v1/customers/available', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/customers/available')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('returns available customers and excludes archived customers', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const available = await CustomerFactory.merge({ code: 'AVAILABLE' }).create()
    const archived = await CustomerFactory.apply('archived').merge({ code: 'ARCHIVED' }).create()
    const response = await client.get('/api/v1/customers/available').loginAs(admin)

    response.assertStatus(200)
    assert.include(
      response.body().data.map((customer: { id: string }) => customer.id),
      available.id,
    )
    assert.notInclude(
      response.body().data.map((customer: { id: string }) => customer.id),
      archived.id,
    )
  })
})
