import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { UserFactory } from '#database/factories/user_factory'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

test.group('PATCH /api/v1/customers/:id', (group) => {
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated updates', async ({ assert, client }) => {
    const customer = await CustomerFactory.create()
    const response = await client
      .patch(`/api/v1/customers/${customer.id}`)
      .json({ companyName: 'Updated' })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('rejects updates for non-admin users', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const customer = await CustomerFactory.create()
    const response = await client
      .patch(`/api/v1/customers/${customer.id}`)
      .loginAs(observer)
      .json({ companyName: 'Updated' })

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
  })

  test('updates the customer while preserving its identity', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.merge({ code: 'UPDATE-01' }).create()
    const response = await client
      .patch(`/api/v1/customers/${customer.id}`)
      .loginAs(admin)
      .json({ companyName: 'Acme Maritime' })

    response.assertStatus(200)
    assert.equal(response.body().data.id, customer.id)
    assert.equal(response.body().data.code, 'UPDATE-01')
    assert.equal(response.body().data.companyName, 'Acme Maritime')
  })

  test('rejects invalid and archived updates', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const customer = await CustomerFactory.merge({ code: 'VALIDATION-01' }).create()
    const archived = await CustomerFactory.apply('archived').create()
    const empty = await client.patch(`/api/v1/customers/${customer.id}`).loginAs(admin).json({})
    const blankCode = await client
      .patch(`/api/v1/customers/${customer.id}`)
      .loginAs(admin)
      .json({ code: '   ' })
    const archivedResponse = await client
      .patch(`/api/v1/customers/${archived.id}`)
      .loginAs(admin)
      .json({ code: 'NEW-CODE' })

    empty.assertStatus(422)
    blankCode.assertStatus(422)
    archivedResponse.assertStatus(409)
    assert.equal(empty.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(archivedResponse.body().error.code, 'E_CUSTOMER_ARCHIVED')
  })
})
