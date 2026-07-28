import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('GET /api/v1/customers', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/customers')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('allows active operational users to browse all customers', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const available = await CustomerFactory.merge({ code: 'LIST-AVAILABLE' }).create()
    const archived = await CustomerFactory.apply('archived')
      .merge({ code: 'LIST-ARCHIVED' })
      .create()

    const response = await client.get('/api/v1/customers').loginAs(observer)

    response.assertStatus(200)
    assert.includeMembers(
      response.body().data.map((customer: { id: string }) => customer.id),
      [available.id, archived.id],
    )
  })

  test('returns archived lifecycle metadata', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const archived = await CustomerFactory.apply('archived')
      .merge({ code: 'LIST-METADATA' })
      .create()
    archived.archivedByUserId = admin.id
    archived.archiveComment = 'Legacy account'
    await archived.save()

    const response = await client.get('/api/v1/customers').loginAs(admin)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().data.find((customer: { id: string }) => customer.id === archived.id)
        .archivedBy,
      { id: admin.id, firstName: admin.firstName, lastName: admin.lastName },
    )
  })
})
